import type { RankedVenue, Venue } from "@/types/recommendation";

const TOP_N = 5;

function priceDiff(v: Venue, budgetPerPerson: number): number {
  return Math.abs(v.pricePerPerson - budgetPerPerson);
}

function compareWithinBudget(a: Venue, b: Venue, budgetPerPerson: number): number {
  if (a.rating !== b.rating) return b.rating - a.rating;
  if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount;
  if (a.viewCount !== b.viewCount) return b.viewCount - a.viewCount;
  return priceDiff(a, budgetPerPerson) - priceDiff(b, budgetPerPerson);
}

function compareOverBudget(a: Venue, b: Venue, budgetPerPerson: number): number {
  const diff = priceDiff(a, budgetPerPerson) - priceDiff(b, budgetPerPerson);
  if (diff !== 0) return diff;
  return b.rating - a.rating;
}

/**
 * 예산 이내 장소가 항상 예산 초과 장소보다 먼저 오도록 1차 분리한 뒤,
 * 이내 그룹은 평점→리뷰수→조회수(예산 근접도 tie-break) 순, 초과 그룹은
 * 예산에 가까운 순(spec 시나리오 3)으로 각각 정렬한다. 자르지 않고 전체를 반환한다 —
 * 다양성 선택(pickDiverseTopN) 등 상위 N개보다 더 넓은 풀이 필요한 경우를 위해.
 */
export function sortVenueCandidates(venues: Venue[], budgetPerPerson: number): RankedVenue[] {
  const within = venues
    .filter((v) => v.pricePerPerson <= budgetPerPerson)
    .sort((a, b) => compareWithinBudget(a, b, budgetPerPerson));
  const over = venues
    .filter((v) => v.pricePerPerson > budgetPerPerson)
    .sort((a, b) => compareOverBudget(a, b, budgetPerPerson));

  return [...within, ...over].map((venue) => ({
    venue,
    withinBudget: venue.pricePerPerson <= budgetPerPerson,
  }));
}

/** {@link sortVenueCandidates}로 정렬한 뒤 상위 5곳만 반환한다 */
export function rankVenueCandidates(venues: Venue[], budgetPerPerson: number): RankedVenue[] {
  return sortVenueCandidates(venues, budgetPerPerson).slice(0, TOP_N);
}

/**
 * 이미 순위가 매겨진 후보에서 업종이 최대한 겹치지 않도록 상위 topN개를 고른다.
 * 1차로 순위 순서를 훑으며 업종별 최고 순위 후보를 하나씩 채우고(업종 다양성 우선),
 * 그래도 슬롯이 남으면(서로 다른 업종이 topN개보다 적을 때) 남은 후보를 원래 순위
 * 그대로 채워 항상 topN개를 반환한다.
 */
export function pickDiverseTopN(ranked: RankedVenue[], topN: number): RankedVenue[] {
  const picked: RankedVenue[] = [];
  const usedCategories = new Set<string>();

  for (const candidate of ranked) {
    if (picked.length >= topN) break;
    if (usedCategories.has(candidate.venue.category)) continue;
    picked.push(candidate);
    usedCategories.add(candidate.venue.category);
  }

  if (picked.length < topN) {
    const pickedIds = new Set(picked.map((p) => p.venue.id));
    for (const candidate of ranked) {
      if (picked.length >= topN) break;
      if (pickedIds.has(candidate.venue.id)) continue;
      picked.push(candidate);
    }
  }

  return picked;
}
