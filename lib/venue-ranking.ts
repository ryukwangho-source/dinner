import { getVenuesByRegion } from "@/config/venues";
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
 * 예산에 가까운 순(spec 시나리오 3)으로 각각 정렬하고 합쳐 상위 5곳을 반환한다.
 */
export function rankVenues(region: string, budgetPerPerson: number): RankedVenue[] {
  const venues = getVenuesByRegion(region);

  const within = venues
    .filter((v) => v.pricePerPerson <= budgetPerPerson)
    .sort((a, b) => compareWithinBudget(a, b, budgetPerPerson));
  const over = venues
    .filter((v) => v.pricePerPerson > budgetPerPerson)
    .sort((a, b) => compareOverBudget(a, b, budgetPerPerson));

  return [...within, ...over]
    .slice(0, TOP_N)
    .map((venue) => ({ venue, withinBudget: venue.pricePerPerson <= budgetPerPerson }));
}
