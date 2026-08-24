import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  COURSE_TWO_CATEGORIES,
  GENERATION_MODEL,
  MAX_WALKING_MINUTES,
  RATING_MIN,
  RELAXED_REVIEW_MIN,
  SONNET_5_PRICE_PER_TOKEN,
  WEB_SEARCH_MAX_USES,
} from "@/config/venue-generation";
import { getAnthropic } from "@/lib/anthropic";
import { rankVenueCandidates } from "@/lib/venue-ranking";
import { venueManualGenerationFixture } from "@/services/fixtures/venue-manual-generation-fixture";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RankedVenue, RegionRecommendation, Venue } from "@/types/recommendation";

const TOP_N = 5;

const manualVenueSchema = z.object({
  name: z.string(),
  category: z.string(),
  rating: z.coerce.number(),
  reviewCount: z.coerce.number(),
  viewCount: z.coerce.number().optional(),
  pricePerPerson: z.coerce.number(),
  walkingMinutes: z.coerce.number().nullable().optional(),
});
type ManualVenue = z.infer<typeof manualVenueSchema>;

const manualResultSchema = z.object({
  found: z.boolean().optional().default(true),
  place: manualVenueSchema.optional(),
  courseTwo: z.array(manualVenueSchema).optional().default([]),
});
export interface ManualResearchResult {
  place: ManualVenue;
  courseTwo: ManualVenue[];
}

function manualResearchPrompt(place: string, partySize: number): string {
  return `당신은 회식 장소 리서처다. 웹검색으로 아래 특정 장소 하나를 조사하고, 그 장소를 기준으로 2차 후보도 함께 조사하라.

- 조사할 장소(1차, 이미 정해짐): "${place}"
- 인원: ${partySize}명

1단계 — "${place}" 자체를 조사한다:
- 정확한 이름(오타면 교정), 업종, 평점(5점 만점 환산), 리뷰 수, 조회수, 1인 예상 비용(원화, 식사+음주 대략치)을 조사한다
- 평점·리뷰수는 네이버 플레이스 페이지 기준(500·1000 같은 임의 반올림 금지), 없으면 카카오맵·구글맵 등 다른 지도 페이지를 참고해 신뢰할 만한 근사치를 채운다
- 조회수는 네이버 플레이스 실제 조회수, 정확한 값을 못 찾으면 리뷰수·인기도로 추정한 실제 있을 법한 값
- 웹검색으로 실제 존재 여부를 최대한 확인한다. 검색해도 도저히 찾을 수 없거나 존재를 확인할 수 없으면 이름을 지어내지 말고 찾지 못했다고 표시한다

2단계 — 1단계에서 장소를 확인했을 때만: "${place}"에서 도보 ${MAX_WALKING_MINUTES}분 이내 2차(간단한 술) 후보를 조사한다
- 업종: ${COURSE_TWO_CATEGORIES.join("·")} — 이 중에서 최소 5곳
- 도보 시간을 확인할 수 없는 곳은 후보에서 뺀다
- 나머지 조사 항목(평점·리뷰수·조회수·1인 예상 비용·도보시간)은 1단계와 동일한 기준`;
}

const META_JSON_SHAPE = `{ "found": boolean, "place": { "name": string, "category": string, "rating": number, "reviewCount": number, "viewCount": number, "pricePerPerson": number } | null, "courseTwo": [ { "name": string, "category": string, "rating": number, "reviewCount": number, "viewCount": number, "pricePerPerson": number, "walkingMinutes": number | null } ] }`;

function looseJsonClean(s: string): string {
  return s.replace(/\/\/[^\n\r]*/g, "").replace(/,(\s*[}\]])/g, "$1");
}

function jsonCandidates(text: string): string[] {
  const out: string[] = [];
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  out.push(...fences.reverse());
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) out.push(text.slice(start, end + 1));
  return out;
}

/** Agent 응답 텍스트에서 1차 장소·2차 후보 JSON을 추출·검증한다 (관대한 파싱) */
export function parseManualResultFromText(text: string): ManualResearchResult {
  for (const candidate of jsonCandidates(text)) {
    for (const raw of [candidate, looseJsonClean(candidate)]) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      const parsed = manualResultSchema.safeParse(json);
      if (!parsed.success) continue;
      if (!parsed.data.found || !parsed.data.place) {
        throw new Error("장소를 찾지 못했습니다");
      }
      return { place: parsed.data.place, courseTwo: parsed.data.courseTwo };
    }
  }
  throw new Error("생성 결과 JSON 파싱에 실패했습니다");
}

function toVenue(raw: ManualVenue, region: string): Venue {
  return {
    id: randomUUID(),
    name: raw.name,
    category: raw.category,
    region,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    viewCount: raw.viewCount && raw.viewCount > 0 ? raw.viewCount : Math.round(raw.reviewCount * 8),
    pricePerPerson: raw.pricePerPerson,
    walkingMinutes: raw.walkingMinutes ?? null,
  };
}

const COURSE_TWO_ALLOWED = new Set<string>(COURSE_TWO_CATEGORIES);

/**
 * 2차 후보를 업종 화이트리스트(이자카야·호프)·평점·리뷰수 문턱·도보거리로 필터링해 Venue로 변환한다.
 * venue-generator.ts의 toVenues와 동일한 품질 기준 — 1차(사용자 지정 장소)와 달리 2차는 LLM이
 * 새로 조사한 후보이므로 같은 방어가 필요하다.
 */
export function toCourseTwoVenues(raw: ManualVenue[], place: string): Venue[] {
  return raw
    .filter((v) => COURSE_TWO_ALLOWED.has(v.category))
    .filter((v) => v.rating >= RATING_MIN && v.reviewCount >= RELAXED_REVIEW_MIN)
    .filter(
      (v) => v.walkingMinutes !== null && v.walkingMinutes !== undefined && v.walkingMinutes <= MAX_WALKING_MINUTES,
    )
    .map((v) => toVenue(v, place));
}

function toRecommendation(
  research: ManualResearchResult,
  place: string,
  budgetPerPerson: number,
): RegionRecommendation {
  const placeVenue = toVenue(research.place, place);
  placeVenue.walkingMinutes = null; // 기준점 자체이므로 도보시간 의미 없음
  const courseOneRanked: RankedVenue = {
    venue: placeVenue,
    withinBudget: placeVenue.pricePerPerson <= budgetPerPerson,
  };

  const courseTwoVenues = toCourseTwoVenues(research.courseTwo, place);

  return {
    region: place,
    courseOne: [courseOneRanked],
    courseTwo: rankVenueCandidates(courseTwoVenues, budgetPerPerson).slice(0, TOP_N),
  };
}

// ── 직접 API 경로 (ANTHROPIC_API_KEY 있을 때) ──

interface RawUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null | undefined;
  cache_read_input_tokens: number | null | undefined;
}

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
  place: string,
  partySize: number,
): Promise<{ research: string; usages: RawUsage[] }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${manualResearchPrompt(place, partySize)}\n\n검색을 마치면 조사한 내용을 정리해 출력하라.` },
  ];
  let research = "";
  const usages: RawUsage[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({
      model: GENERATION_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
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
  if (!research.trim()) throw new Error("장소 조사에 실패했습니다");
  return { research, usages };
}

async function extractResult(
  client: Anthropic,
  research: string,
): Promise<{ result: ManualResearchResult; usage: RawUsage }> {
  const response = await client.messages.parse({
    model: GENERATION_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: `다음은 특정 장소·주변 2차 조사 결과다. 스키마에 맞게 정규화하라.\n\n${research}` }],
    output_config: { format: zodOutputFormat(manualResultSchema), effort: "low" },
  });
  if (!response.parsed_output) throw new Error("조사 결과 정규화에 실패했습니다");
  const parsed = response.parsed_output;
  if (!parsed.found || !parsed.place) {
    throw new Error("장소를 찾지 못했습니다");
  }
  return { result: { place: parsed.place, courseTwo: parsed.courseTwo }, usage: response.usage };
}

// ── Agent SDK 경로 (ANTHROPIC_API_KEY 없을 때 — 구독 인증 폴백) ──

async function runAgentGeneration(
  place: string,
  partySize: number,
): Promise<{ result: ManualResearchResult; usage: GenerationUsage | null }> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const prompt = `${manualResearchPrompt(place, partySize)}

**절대 규칙 — 반드시 JSON으로 끝낸다**:
- 마지막 답변은 아래 스키마에 맞는 JSON 하나만 담은 \`\`\`json 코드 블록 하나로 끝내라. 그 외 설명·중간 요약·산문 나열은 하지 말라.
- 권한(WebFetch 등) 요청, 되묻기, "조사를 중단하겠습니다" 같은 보고성 응답은 절대 금지. 필요하면 WebSearch·WebFetch를 직접 써서 확인하라.
- 장소를 도저히 확인할 수 없을 때만 found:false로 답하라. 그 외에는 확인한 수치를 우선 쓰되, 못 찾은 값은 신뢰할 만한 근사치로 채워 무조건 JSON을 완성한다.

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
        `[venue-manual-generation] usage(${place}) — model:${models.join(",") || "?"} input:${u.input_tokens} output:${u.output_tokens} cacheRead:${u.cache_read_input_tokens} cacheWrite:${u.cache_creation_input_tokens} cost:$${cost.toFixed(4)}`,
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
  if (!resultText.trim()) throw new Error("장소 조사에 실패했습니다");
  return { result: parseManualResultFromText(resultText), usage };
}

/**
 * 사용자가 직접 입력한 1차 장소 하나를 웹검색으로 조사(평점·리뷰수·조회수·업종 확인, 업종
 * 화이트리스트 검증 없음) + 그 장소 기준 도보 {@link MAX_WALKING_MINUTES}분 이내 2차 상위 5곳을 반환한다.
 * ANTHROPIC_API_KEY가 있으면 직접 API, 없으면 Agent SDK(구독 인증) 경로를 쓴다.
 * GENERATE_FIXTURE=1이면 실제 웹검색 없이 고정 fixture를 쓴다(테스트·E2E 전용, 비용 회피).
 */
export async function generateManualVenues(
  place: string,
  partySize: number,
  budgetPerPerson: number,
  client?: Anthropic,
): Promise<{ results: RegionRecommendation[]; usage: GenerationUsage | null }> {
  let research: ManualResearchResult;
  let usage: GenerationUsage | null = null;

  if (process.env.GENERATE_FIXTURE === "1") {
    const fixture = venueManualGenerationFixture(place);
    research = fixture;
  } else if (!client && !process.env.ANTHROPIC_API_KEY) {
    const agentResult = await runAgentGeneration(place, partySize);
    research = agentResult.result;
    usage = agentResult.usage;
  } else {
    const api = client ?? getAnthropic();
    const { research: researchText, usages } = await runResearch(api, place, partySize);
    const { result, usage: extractUsage } = await extractResult(api, researchText);
    research = result;
    usage = toGenerationUsage([...usages, extractUsage]);
  }

  return { results: [toRecommendation(research, place, budgetPerPerson)], usage };
}
