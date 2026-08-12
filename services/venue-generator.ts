import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ALLOWED_CATEGORIES,
  CANDIDATE_COUNT,
  GENERATION_MODEL,
  RATING_MIN,
  RELAXED_REVIEW_MIN,
  REVIEW_MIN,
} from "@/config/venue-generation";
import { rankVenueCandidates } from "@/lib/venue-ranking";
import { venueGenerationFixture } from "@/services/fixtures/venue-generation-fixture";
import type { RankedVenue, Venue } from "@/types/recommendation";

const TOP_N = 5;

const generatedVenueSchema = z.object({
  name: z.string(),
  category: z.string(),
  rating: z.coerce.number(),
  reviewCount: z.coerce.number(),
  pricePerPerson: z.coerce.number(),
});
type GeneratedVenue = z.infer<typeof generatedVenueSchema>;

const generatedVenuesSchema = z.object({
  venues: z.array(generatedVenueSchema),
});

function researchPrompt(region: string, partySize: number): string {
  return `당신은 회식 장소 리서처다. 웹검색으로 "${region}" 지역의 회식하기 좋은 실제 장소를 조사하라.

- 지역: ${region}
- 인원: ${partySize}명
- 업종: 반드시 다음 중 하나여야 한다 — ${ALLOWED_CATEGORIES.join("·")}. 카페·디저트카페·편의점 등 회식과 무관한 곳은 제외한다.
- 조사 대상: ${CANDIDATE_COUNT}곳

각 장소마다 조사할 것:
1. 정확한 이름
2. 업종 (위 목록 중 하나)
3. 평점(5점 만점 환산)과 리뷰 수 — 실제 검색·페이지 확인 수치를 우선한다(500·1000 같은 임의 반올림 금지). 정확한 값을 못 찾으면 신뢰할 만한 근사치라도 채운다
4. 1인 예상 비용(원화, 식사+음주 포함 대략치)

우선순위: 평점 ${RATING_MIN} 이상, 리뷰 ${REVIEW_MIN}개 이상인 곳 위주로 조사하되, 부족하면 리뷰 ${RELAXED_REVIEW_MIN}개 이상까지 포함해도 좋다.

조사를 마치면 아래 JSON 형식 하나만 담은 코드 블록으로 답하라. 다른 설명은 덧붙이지 않는다:
\`\`\`json
{ "venues": [ { "name": "...", "category": "...", "rating": 0, "reviewCount": 0, "pricePerPerson": 0 } ] }
\`\`\`
새 장소를 지어내지 않는다 — 조사 결과에 있는 장소만 담는다.`;
}

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
    }));
}

async function runAgentGeneration(region: string, partySize: number): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const prompt = researchPrompt(region, partySize);

  let resultText = "";
  for await (const message of query({
    prompt,
    options: {
      allowedTools: ["WebSearch", "WebFetch"],
      maxTurns: 20,
      model: GENERATION_MODEL,
    },
  })) {
    if (message.type === "result") {
      if (message.subtype !== "success") {
        throw new Error(`장소 생성 실패: ${message.subtype}`);
      }
      resultText = message.result;
    }
  }
  if (!resultText.trim()) throw new Error("회식 장소 조사에 실패했습니다");
  return resultText;
}

/**
 * 지역·인원수·예산으로 회식 장소를 실시간 생성해 상위 5곳을 반환한다.
 * GENERATE_FIXTURE=1이면 실제 웹검색 없이 고정 fixture를 쓴다(테스트·E2E 전용, 수 분·토큰 비용 회피).
 */
export async function generateVenues(
  region: string,
  partySize: number,
  budgetPerPerson: number,
): Promise<RankedVenue[]> {
  const candidates =
    process.env.GENERATE_FIXTURE === "1"
      ? venueGenerationFixture(region)
      : toVenues(parseVenuesFromText(await runAgentGeneration(region, partySize)), region);

  return rankVenueCandidates(candidates, budgetPerPerson).slice(0, TOP_N);
}
