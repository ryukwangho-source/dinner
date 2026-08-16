import { MAX_PAIR_WALKING_MINUTES, PAIR_COUNT } from "@/config/venue-generation";
import type { Venue, VenuePair } from "@/types/recommendation";

/** 순위를 매기기 전, 조사로 묶인 1차+2차 원본 페어 */
export interface RawVenuePair {
  courseOne: Venue;
  courseTwo: Venue;
  /** 1차·2차 사이 도보 예상 시간(분) */
  walkingBetweenMinutes: number;
}

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

/** 예산 이내 장소가 항상 예산 초과 장소보다 먼저 오도록 분리한 뒤 각 그룹 기준으로 비교 */
function compareVenueQuality(a: Venue, b: Venue, budgetPerPerson: number): number {
  const aWithin = a.pricePerPerson <= budgetPerPerson;
  const bWithin = b.pricePerPerson <= budgetPerPerson;
  if (aWithin !== bWithin) return aWithin ? -1 : 1;
  return aWithin
    ? compareWithinBudget(a, b, budgetPerPerson)
    : compareOverBudget(a, b, budgetPerPerson);
}

/**
 * 1차·2차 사이 도보 {@link MAX_PAIR_WALKING_MINUTES}분 이내인 페어를 항상 먼저 두고,
 * 그 안에서는 1차 장소 품질(예산 이내 → 평점 → 리뷰수 → 조회수 → 예산 근접도)로 정렬해
 * 상위 {@link PAIR_COUNT}쌍을 반환한다.
 */
export function rankVenuePairs(pairs: RawVenuePair[], budgetPerPerson: number): VenuePair[] {
  const sorted = [...pairs].sort((a, b) => {
    const aNear = a.walkingBetweenMinutes <= MAX_PAIR_WALKING_MINUTES;
    const bNear = b.walkingBetweenMinutes <= MAX_PAIR_WALKING_MINUTES;
    if (aNear !== bNear) return aNear ? -1 : 1;

    const quality = compareVenueQuality(a.courseOne, b.courseOne, budgetPerPerson);
    if (quality !== 0) return quality;
    return a.walkingBetweenMinutes - b.walkingBetweenMinutes;
  });

  return sorted.slice(0, PAIR_COUNT).map((p) => ({
    courseOne: { venue: p.courseOne, withinBudget: p.courseOne.pricePerPerson <= budgetPerPerson },
    courseTwo: { venue: p.courseTwo, withinBudget: p.courseTwo.pricePerPerson <= budgetPerPerson },
    walkingBetweenMinutes: p.walkingBetweenMinutes,
  }));
}
