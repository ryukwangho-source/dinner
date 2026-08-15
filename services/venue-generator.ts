import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  ALLOWED_CATEGORIES,
  CANDIDATE_COUNT,
  COURSE_ONE_CATEGORIES,
  COURSE_TWO_CATEGORIES,
  GENERATION_MODEL,
  RATING_MIN,
  RELAXED_REVIEW_MIN,
  REVIEW_MIN,
  WEB_SEARCH_MAX_USES,
} from "@/config/venue-generation";
import { getAnthropic } from "@/lib/anthropic";
import { rankVenueCandidates } from "@/lib/venue-ranking";
import { venueGenerationFixture } from "@/services/fixtures/venue-generation-fixture";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RegionRecommendation, Venue } from "@/types/recommendation";

const TOP_N = 5;

const generatedVenueSchema = z.object({
  name: z.string(),
  category: z.string(),
  rating: z.coerce.number(),
  reviewCount: z.coerce.number(),
  pricePerPerson: z.coerce.number(),
  walkingMinutes: z.coerce.number().nullable().optional(),
});
type GeneratedVenue = z.infer<typeof generatedVenueSchema>;

const generatedVenuesSchema = z.object({
  venues: z.array(generatedVenueSchema),
});

function researchPrompt(region: string, partySize: number): string {
  return `당신은 회식 장소 리서처다. 웹검색으로 "${region}" 지역의 회식하기 좋은 실제 장소를 조사하라.

- 지역(기준점): ${region}
- 인원: ${partySize}명
- 1차(식사 위주) 업종: ${COURSE_ONE_CATEGORIES.join("·")} — 이 중에서 최소 7곳
- 2차(1차 이후 갈 만한 간단한 술자리) 업종: ${COURSE_TWO_CATEGORIES.join("·")} — 이 중에서 최소 5곳
- 총 조사 대상(비용 절감을 위해 딱 필요한 만큼만): ${CANDIDATE_COUNT}곳. 그 이상은 조사하지 않는다. 카페·디저트카페·편의점 등 회식과 무관한 곳은 제외한다.
- 검색은 필요한 만큼만 — 같은 정보를 여러 번 다시 찾지 말고, 한 번에 여러 후보를 확인할 수 있으면 한 번에 확인하라.

각 장소마다 조사할 것:
1. 정확한 이름
2. 업종 (위 목록 중 하나)
3. 평점(5점 만점 환산)과 리뷰 수 — 실제 검색·페이지 확인 수치를 우선한다(500·1000 같은 임의 반올림 금지). 정확한 값을 못 찾으면 신뢰할 만한 근사치라도 채운다
4. 1인 예상 비용(원화, 식사+음주 포함 대략치)
5. "${region}"에서 도보 예상 시간(분) — 지도상 대략적인 도보 거리로 추정. 도저히 알 수 없으면 null

우선순위: 평점 ${RATING_MIN} 이상, 리뷰 ${REVIEW_MIN}개 이상인 곳 위주로 조사하되, 부족하면 리뷰 ${RELAXED_REVIEW_MIN}개 이상까지 포함해도 좋다.`;
}

const META_JSON_SHAPE = `{ "venues": [ { "name": string, "category": string, "rating": number, "reviewCount": number, "pricePerPerson": number, "walkingMinutes": number | null } ] }`;

/** 흔한 LLM JSON 오류(트레일링 콤마·// 주석)를 관대하게 정리 */
function looseJsonClean(s: string): string {
  return s.replace(/\/\/[^\n\r]*/g, "").replace(/,(\s*[}\]])/g, "$1");
}

/** 텍스트에서 JSON 후보들을 뽑는다: 코드펜스(뒤에서부터) → 최대 균형 중괄호 블록 */
function jsonCandidates(text: string): string[] {
  const out: string[] = [];
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  out.push(...fences.reverse());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) out.push(text.slice(start, end + 1));
  return out;
}

/** Agent 응답 텍스트에서 후보 목록 JSON을 추출·검증한다 (관대한 파싱) */
export function parseVenuesFromText(text: string): GeneratedVenue[] {
  for (const candidate of jsonCandidates(text)) {
    for (const raw of [candidate, looseJsonClean(candidate)]) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      const parsed = generatedVenuesSchema.safeParse(json);
      if (parsed.success) return parsed.data.venues;
    }
  }
  throw new Error("생성 결과 JSON 파싱에 실패했습니다");
}

/**
 * 업종 화이트리스트·품질 문턱으로 필터링해 Venue 형태로 변환한다.
 * 조회수는 웹검색으로 신뢰성 있게 구할 수 없어 리뷰수 기반 근사치를 쓴다
 * (rankVenueCandidates의 3순위 tie-break라 순위에 미치는 영향이 작다).
 */
export function toVenues(raw: GeneratedVenue[], region: string): Venue[] {
  const allowed = new Set<string>(ALLOWED_CATEGORIES);
  return raw
    .filter((v) => allowed.has(v.category))
    .filter((v) => v.rating >= RATING_MIN && v.reviewCount >= RELAXED_REVIEW_MIN)
    .map((v) => ({
      id: randomUUID(),
      name: v.name,
      category: v.category,
      region,
      rating: v.rating,
      reviewCount: v.reviewCount,
      viewCount: Math.round(v.reviewCount * 8),
      pricePerPerson: v.pricePerPerson,
      walkingMinutes: v.walkingMinutes ?? null,
    }));
}

/** 업종으로 1차(식사)·2차(술) 후보를 나눈다 */
export function splitByCourse(venues: Venue[]): { courseOne: Venue[]; courseTwo: Venue[] } {
  const courseOneSet = new Set<string>(COURSE_ONE_CATEGORIES);
  const courseTwoSet = new Set<string>(COURSE_TWO_CATEGORIES);
  return {
    courseOne: venues.filter((v) => courseOneSet.has(v.category)),
    courseTwo: venues.filter((v) => courseTwoSet.has(v.category)),
  };
}

// ── 직접 API 경로 (ANTHROPIC_API_KEY 있을 때 — web_search tool로 검색 횟수 상한 강제) ──

async function runResearch(client: Anthropic, region: string, partySize: number): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${researchPrompt(region, partySize)}\n\n검색을 마치면 조사한 장소를 정리해 출력하라.` },
  ];
  let research = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const stream = client.messages.stream({
      model: GENERATION_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: WEB_SEARCH_MAX_USES }],
      messages,
    });
    const message = await stream.finalMessage();
    research += message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  if (!research.trim()) throw new Error("회식 장소 조사에 실패했습니다");
  return research;
}

async function extractVenues(client: Anthropic, research: string): Promise<GeneratedVenue[]> {
  const response = await client.messages.parse({
    model: GENERATION_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: `다음은 회식 장소 조사 결과다. 스키마에 맞게 정규화하라.\n\n${research}` }],
    output_config: { format: zodOutputFormat(generatedVenuesSchema), effort: "low" },
  });
  if (!response.parsed_output) throw new Error("조사 결과 정규화에 실패했습니다");
  return response.parsed_output.venues;
}

// ── Agent SDK 경로 (ANTHROPIC_API_KEY 없을 때 — 구독 인증 폴백) ──

async function runAgentGeneration(
  region: string,
  partySize: number,
): Promise<{ venues: GeneratedVenue[]; usage: GenerationUsage | null }> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const prompt = `${researchPrompt(region, partySize)}

**절대 규칙 — 반드시 JSON으로 끝낸다**:
- 마지막 답변은 아래 스키마에 맞는 JSON 하나만 담은 \`\`\`json 코드 블록 하나로 끝내라. 그 외 설명·중간 요약·산문 나열은 하지 말라.
- 권한(WebFetch 등) 요청, 되묻기, "조사를 중단하겠습니다" 같은 보고성 응답은 절대 금지. 필요하면 WebSearch·WebFetch를 직접 써서 확인하라.
- 일부 평점·리뷰 수가 불확실해도 절대 멈추지 말라. 확인한 수치를 우선 쓰되, 못 찾은 값은 신뢰할 만한 근사치로 채워 무조건 JSON을 완성한다. 완벽하지 않아도 된다.

스키마:
${META_JSON_SHAPE}`;

  let resultText = "";
  let usage: GenerationUsage | null = null;
  for await (const message of query({
    prompt,
    options: {
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 40,
      model: GENERATION_MODEL,
    },
  })) {
    if (message.type === "result") {
      if (message.subtype !== "success") {
        throw new Error(`장소 생성 실패: ${message.subtype}`);
      }
      resultText = message.result;
      const u = message.usage;
      const cost = message.total_cost_usd;
      const models = Object.keys(message.modelUsage ?? {});
      console.log(
        `[venue-generation] usage(${region}) — model:${models.join(",") || "?"} input:${u.input_tokens} output:${u.output_tokens} cacheRead:${u.cache_read_input_tokens} cacheWrite:${u.cache_creation_input_tokens} cost:$${cost.toFixed(4)}`,
      );
      usage = {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens,
        cacheWriteTokens: u.cache_creation_input_tokens,
        costUsd: cost,
        models,
      };
    }
  }
  if (!resultText.trim()) throw new Error("회식 장소 조사에 실패했습니다");
  return { venues: parseVenuesFromText(resultText), usage };
}

/** 지역 하나에 대해 후보를 모은다 (fixture / 직접 API / Agent SDK 중 하나) */
async function generateCandidatesForRegion(
  region: string,
  partySize: number,
  client?: Anthropic,
): Promise<{ candidates: Venue[]; usage: GenerationUsage | null }> {
  if (process.env.GENERATE_FIXTURE === "1") {
    return { candidates: venueGenerationFixture(region), usage: null };
  }
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    const agentResult = await runAgentGeneration(region, partySize);
    return { candidates: toVenues(agentResult.venues, region), usage: agentResult.usage };
  }
  const api = client ?? getAnthropic();
  const research = await runResearch(api, region, partySize);
  const venues = await extractVenues(api, research);
  return { candidates: toVenues(venues, region), usage: null };
}

function mergeUsage(usages: (GenerationUsage | null)[]): GenerationUsage | null {
  const present = usages.filter((u): u is GenerationUsage => u !== null);
  if (present.length === 0) return null;
  return present.reduce((acc, u) => ({
    inputTokens: acc.inputTokens + u.inputTokens,
    outputTokens: acc.outputTokens + u.outputTokens,
    cacheReadTokens: acc.cacheReadTokens + u.cacheReadTokens,
    cacheWriteTokens: acc.cacheWriteTokens + u.cacheWriteTokens,
    costUsd: acc.costUsd + u.costUsd,
    models: Array.from(new Set([...acc.models, ...u.models])),
  }));
}

/**
 * 지역마다 회식 장소를 실시간 생성해 1차(식사)·2차(간단한 술) 각각 상위 5곳을 반환한다.
 * ANTHROPIC_API_KEY가 있으면 직접 API(web_search tool, 검색 횟수 상한 강제 + 구조화 출력),
 * 없으면 Agent SDK(구독 인증) 경로를 쓴다.
 * GENERATE_FIXTURE=1이면 실제 웹검색 없이 고정 fixture를 쓴다(테스트·E2E 전용, 비용 회피).
 */
export async function generateVenues(
  regions: string[],
  partySize: number,
  budgetPerPerson: number,
  client?: Anthropic,
): Promise<{ results: RegionRecommendation[]; usage: GenerationUsage | null }> {
  const perRegion = await Promise.all(
    regions.map(async (region) => {
      const { candidates, usage } = await generateCandidatesForRegion(region, partySize, client);
      const { courseOne, courseTwo } = splitByCourse(candidates);
      return {
        region,
        courseOne: rankVenueCandidates(courseOne, budgetPerPerson).slice(0, TOP_N),
        courseTwo: rankVenueCandidates(courseTwo, budgetPerPerson).slice(0, TOP_N),
        usage,
      };
    }),
  );

  return {
    results: perRegion.map(({ region, courseOne, courseTwo }) => ({ region, courseOne, courseTwo })),
    usage: mergeUsage(perRegion.map((r) => r.usage)),
  };
}
