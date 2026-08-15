import { describe, expect, it } from "vitest";
import { rankVenueCandidates } from "@/lib/venue-ranking";
import type { Venue } from "@/types/recommendation";

function makeVenue(id: string, overrides: Partial<Venue> = {}): Venue {
  return {
    id,
    name: id,
    category: "고깃집",
    region: "테스트지역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: 25000,
    walkingMinutes: null,
    ...overrides,
  };
}

describe("rankVenueCandidates", () => {
  it("전달받은 venues 배열만으로 정렬한다", () => {
    const venues = [
      makeVenue("a", { pricePerPerson: 40000 }),
      makeVenue("b", { pricePerPerson: 25000, rating: 4.9 }),
    ];
    const ranked = rankVenueCandidates(venues, 30000);
    expect(ranked[0].venue.id).toBe("b");
    expect(ranked[0].withinBudget).toBe(true);
    expect(ranked[1].venue.id).toBe("a");
    expect(ranked[1].withinBudget).toBe(false);
  });

  it("6곳 이상 주어져도 상위 5곳으로 자른다", () => {
    const venues = Array.from({ length: 8 }, (_, i) => makeVenue(`v${i}`, { rating: 4.0 + i * 0.05 }));
    expect(rankVenueCandidates(venues, 30000)).toHaveLength(5);
  });

  it("예산 이내 장소가 예산 초과 장소보다 항상 먼저 나온다", () => {
    const venues = [
      makeVenue("over", { pricePerPerson: 42000 }),
      makeVenue("in1", { pricePerPerson: 28000 }),
      makeVenue("in2", { pricePerPerson: 27000 }),
    ];
    const ranked = rankVenueCandidates(venues, 30000);
    expect(ranked.map((r) => r.venue.id)).toEqual(["in1", "in2", "over"]);
  });

  it("후보 전원이 예산 초과이면 모두 withinBudget:false이고 예산에 가까운 순으로 정렬된다", () => {
    const venues = [
      makeVenue("a", { pricePerPerson: 38000 }),
      makeVenue("b", { pricePerPerson: 22000 }),
      makeVenue("c", { pricePerPerson: 31000 }),
    ];
    const ranked = rankVenueCandidates(venues, 15000);
    expect(ranked.every((r) => r.withinBudget === false)).toBe(true);
    const diffs = ranked.map((r) => Math.abs(r.venue.pricePerPerson - 15000));
    expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
  });

  it("후보가 5곳 미만이면 있는 만큼만 반환한다", () => {
    const venues = [makeVenue("a"), makeVenue("b"), makeVenue("c")];
    expect(rankVenueCandidates(venues, 30000)).toHaveLength(3);
  });

  it("후보가 없으면 빈 배열을 반환한다", () => {
    expect(rankVenueCandidates([], 30000)).toEqual([]);
  });
});
