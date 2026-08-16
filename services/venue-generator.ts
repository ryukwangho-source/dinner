import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  CANDIDATE_PAIR_COUNT,
  COURSE_ONE_CATEGORIES,
  COURSE_TWO_CATEGORIES,
  GENERATION_MODEL,
  MAX_PAIR_WALKING_MINUTES,
  MAX_WALKING_MINUTES,
  RATING_MIN,
  RELAXED_REVIEW_MIN,
  REVIEW_MIN,
  SONNET_5_PRICE_PER_TOKEN,
  WEB_SEARCH_MAX_USES,
} from "@/config/venue-generation";
import { getAnthropic } from "@/lib/anthropic";
import { type RawVenuePair, rankVenuePairs } from "@/lib/venue-ranking";
import { venueGenerationFixture } from "@/services/fixtures/venue-generation-fixture";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RegionRecommendation, Venue } from "@/types/recommendation";

const generatedVenueRoleSchema = z.object({
  name: z.string(),
  category: z.string(),
  rating: z.coerce.number(),
  reviewCount: z.coerce.number(),
  pricePerPerson: z.coerce.number(),
});

/** 1차 장소만 지역 기준점에서의 도보 시간을 추가로 담는다 (2차 거리는 1차와의 거리로 근사한다) */
const generatedPairSchema = z.object({
  courseOne: generatedVenueRoleSchema.extend({
    walkingMinutes: z.coerce.number().nullable().optional(),
  }),
  courseTwo: generatedVenueRoleSchema,
  walkingBetweenMinutes: z.coerce.number(),
});
type GeneratedPair = z.infer<typeof generatedPairSchema>;

const generatedPairsSchema = z.object({
  pairs: z.array(generatedPairSchema),
});

function researchPrompt(region: string, partySize: number): string {
  return `당신은 회식 코스 리서처다. 웹검색으로 "${region}" 지역에서 회식하기 좋은 1차(식사)+2차(간단한 술) 조합을 조사하라.

- 지역(기준점): ${region}
- 인원: ${partySize}명
- 1차 업종: ${COURSE_ONE_CATEGORIES.join("·")} 중 하나. "${region}"에서 도보 ${MAX_WALKING_MINUTES}분 이내여야 한다. 도보 시간을 확인할 수 없는 곳은 후보에서 뺀다.
- 2차 업종: ${COURSE_TWO_CATEGORIES.join("·")} 중 하나. 그 1차 장소에서 도보 ${MAX_PAIR_WALKING_MINUTES}분 이내인 곳을 우선 찾되, 정 없으면 그 1차에서 가장 가까운 곳이라도 반드시 짝지어 포함한다.
- 조합(페어) ${CANDIDATE_PAIR_COUNT}개를 조사한다(비용 절감을 위해 딱 필요한 만큼만). 카페·디저트카페·편의점 등 회식과 무관한 곳은 제외한다.
- 검색은 필요한 만큼만 — 같은 정보를 여러 번 다시 찾지 말고, 한 번에 여러 후보를 확인할 수 있으면 한 번에 확인하라.

각 조합(페어)마다 조사할 것:
1. 1차 장소: 정확한 이름, 업종, 평점(5점 만점 환산)과 리뷰 수(실제 검색·페이지 확인 수치 우선 — 500·1000 같은 임의 반올림 금지, 정확한 값을 못 찾으면 신뢰할 만한 근사치라도 채운다), 1인 예상 비용(원화), "${region}"에서 도보 예상 시간(분, 도저히 알 수 없으면 null)
2. 2차 장소: 정확한 이름, 업종, 평점, 리뷰 수, 1인 예상 비용(원화)
3. 1차와 2차 사이 도보 예상 시간(분) — 지도상 대략적인 도보 거리로 추정

우선순위: 1차·2차 모두 평점 ${RATING_MIN} 이상, 리뷰 ${REVIEW_MIN}개 이상인 곳 위주로 조사하되, 부족하면 리뷰 ${RELAXED_REVIEW_MIN}개 이상까지 포함해도 좋다.`;
}

const META_JSON_SHAPE = `{ "pairs": [ { "courseOne": { "name": string, "category": string, "rating": number, "reviewCount": number, "pricePerPerson": number, "walkingMinutes": number | null }, "courseTwo": { "name": string, "category": string, "rating": number, "reviewCount": number, "pricePerPerson": number }, "walkingBetweenMinutes": number } ] }`;

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

/** Agent 응답 텍스트에서 페어(1차+2차) 목록 JSON을 추출·검증한다 (관대한 파싱) */
export function parsePairsFromText(text: string): GeneratedPair[] {
  for (const candidate of jsonCandidates(text)) {
    for (const raw of [candidate, looseJsonClean(candidate)]) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      const parsed = generatedPairsSchema.safeParse(json);
      if (parsed.success) return parsed.data.pairs;
    }
  }
  throw new Error("생성 결과 JSON 파싱에 실패했습니다");
}

function toVenue(
  raw: GeneratedPair["courseOne"] | GeneratedPair["courseTwo"],
  region: string,
  walkingMinutes: number | null,
): Venue {
  return {
    id: randomUUID(),
    name: raw.name,
    category: raw.category,
    region,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    viewCount: Math.round(raw.reviewCount * 8),
    pricePerPerson: raw.pricePerPerson,
    walkingMinutes,
  };
}

/**
 * 업종 화이트리스트·품질 문턱·지역 도보 거리로 페어를 필터링해 RawVenuePair로 변환한다.
 * 2차의 지역-거리는 따로 조사하지 않으므로 1차 거리 + 1차·2차 사이 거리로 근사한다.
 * 조회수는 웹검색으로 신뢰성 있게 구할 수 없어 리뷰수 기반 근사치를 쓴다.
 */
export function toVenuePairs(raw: GeneratedPair[], region: string): RawVenuePair[] {
  const courseOneSet = new Set<string>(COURSE_ONE_CATEGORIES);
  const courseTwoSet = new Set<string>(COURSE_TWO_CATEGORIES);
  const passesQuality = (v: GeneratedPair["courseOne"] | GeneratedPair["courseTwo"]) =>
    v.rating >= RATING_MIN && v.reviewCount >= RELAXED_REVIEW_MIN;

  return raw
    .filter((p) => courseOneSet.has(p.courseOne.category) && courseTwoSet.has(p.courseTwo.category))
    .filter((p) => passesQuality(p.courseOne) && passesQuality(p.courseTwo))
    .filter(
      (p): p is GeneratedPair & { courseOne: { walkingMinutes: number } } =>
        p.courseOne.walkingMinutes != null && p.courseOne.walkingMinutes <= MAX_WALKING_MINUTES,
    )
    .map((p) => ({
      courseOne: toVenue(p.courseOne, region, p.courseOne.walkingMinutes),
      courseTwo: toVenue(p.courseTwo, region, p.courseOne.walkingMinutes + p.walkingBetweenMinutes),
      walkingBetweenMinutes: p.walkingBetweenMinutes,
    }));
}

// ── 직접 API 경로 (ANTHROPIC_API_KEY 있을 때 — web_search tool로 검색 횟수 상한 강제) ──

interface RawUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null | undefined;
  cache_read_input_tokens: number | null | undefined;
}

/** 여러 API 콜의 usage를 합산해 GenerationUsage로 변환 (claude-sonnet-5 요금 기준 비용 추정 포함) */
function toGenerationUsage(usages: RawUsage[]): GenerationUsage {
  const totals = usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.input_tokens,
      outputTokens: acc.outputTokens + u.output_tokens,
      cacheReadTokens: acc.cacheReadTokens + (u.cache_read_input_tokens ?? 0),
      cacheWriteTokens: acc.cacheWriteTokens + (u.cache_creation_input_tokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
  const costUsd =
    totals.inputTokens * SONNET_5_PRICE_PER_TOKEN.input +
    totals.outputTokens * SONNET_5_PRICE_PER_TOKEN.output +
    totals.cacheReadTokens * SONNET_5_PRICE_PER_TOKEN.cacheRead +
    totals.cacheWriteTokens * SONNET_5_PRICE_PER_TOKEN.cacheWrite;
  return { ...totals, costUsd, models: [GENERATION_MODEL] };
}

async function runResearch(
  client: Anthropic,
  region: string,
  partySize: number,
): Promise<{ research: string; usages: RawUsage[] }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${researchPrompt(region, partySize)}\n\n검색을 마치면 조사한 조합을 정리해 출력하라.` },
  ];
  let research = "";
  const usages: RawUsage[] = [];
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
    usages.push(message.usage);
    research += message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  if (!research.trim()) throw new Error("회식 장소 조사에 실패했습니다");
  return { research, usages };
}

async function extractVenues(
  client: Anthropic,
  research: string,
): Promise<{ pairs: GeneratedPair[]; usage: RawUsage }> {
  const response = await client.messages.parse({
    model: GENERATION_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: `다음은 회식 코스(1차+2차) 조사 결과다. 스키마에 맞게 정규화하라.\n\n${research}` }],
    output_config: { format: zodOutputFormat(generatedPairsSchema), effort: "low" },
  });
  if (!response.parsed_output) throw new Error("조사 결과 정규화에 실패했습니다");
  return { pairs: response.parsed_output.pairs, usage: response.usage };
}

// ── Agent SDK 경로 (ANTHROPIC_API_KEY 없을 때 — 구독 인증 폴백) ──

async function runAgentGeneration(
  region: string,
  partySize: number,
): Promise<{ pairs: GeneratedPair[]; usage: GenerationUsage | null }> {
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
  return { pairs: parsePairsFromText(resultText), usage };
}

/** 지역 하나에 대해 페어(1차+2차) 후보를 모은다 (fixture / 직접 API / Agent SDK 중 하나) */
async function generateCandidatesForRegion(
  region: string,
  partySize: number,
  client?: Anthropic,
): Promise<{ pairs: RawVenuePair[]; usage: GenerationUsage | null }> {
  if (process.env.GENERATE_FIXTURE === "1") {
    return { pairs: venueGenerationFixture(region), usage: null };
  }
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    const agentResult = await runAgentGeneration(region, partySize);
    return { pairs: toVenuePairs(agentResult.pairs, region), usage: agentResult.usage };
  }
  const api = client ?? getAnthropic();
  const { research, usages } = await runResearch(api, region, partySize);
  const { pairs, usage: extractUsage } = await extractVenues(api, research);
  return {
    pairs: toVenuePairs(pairs, region),
    usage: toGenerationUsage([...usages, extractUsage]),
  };
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
 * 지역마다 회식 코스를 실시간 생성해, 요청 지역에서 도보 {@link MAX_WALKING_MINUTES}분 이내인
 * 1차 장소와 그 근처(도보 {@link MAX_PAIR_WALKING_MINUTES}분 우선) 2차 장소를 묶은 페어를 반환한다.
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
      const { pairs, usage } = await generateCandidatesForRegion(region, partySize, client);
      return { region, pairs: rankVenuePairs(pairs, budgetPerPerson), usage };
    }),
  );

  return {
    results: perRegion.map(({ region, pairs }) => ({ region, pairs })),
    usage: mergeUsage(perRegion.map((r) => r.usage)),
  };
}
