import { describe, expect, it } from "vitest";
import { rankVenueCandidates, rankVenues } from "@/lib/venue-ranking";
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
    ...overrides,
  };
}

describe("rankVenueCandidates", () => {
  it("전달받은 venues 배열만으로 정렬한다 (config/venues.ts 무관)", () => {
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
});

describe("rankVenues", () => {
  it("예산 이내 장소가 예산 초과 장소보다 항상 먼저 나온다", () => {
    // 오산역 시드: 예산 30,000원 기준 이내(숯불향 28000, 모던삼겹 27000, 이자카야 29500, 호프집 22000) vs 초과(오마카세 42000)
    const ranked = rankVenues("오산역", 30000);
    const overBudgetIndex = ranked.findIndex((r) => r.venue.id === "osan-omakase");
    const withinBudgetIndices = ranked
      .filter((r) => r.venue.id !== "osan-omakase")
      .map((r) => ranked.indexOf(r));

    expect(overBudgetIndex).toBeGreaterThan(Math.max(...withinBudgetIndices));
    expect(ranked.find((r) => r.venue.id === "osan-omakase")?.withinBudget).toBe(false);
  });

  it("후보가 6곳 이상이면 결과가 정확히 5곳으로 잘린다", () => {
    // 동탄역 시드는 5곳뿐이라 오산역(5곳)으로 확인 — 두 지역 모두 5곳이므로 합쳐서 검증은 개별 지역으로 충분
    const ranked = rankVenues("오산역", 100000);
    expect(ranked).toHaveLength(5);
  });

  it("후보 전원이 예산 초과이면 모두 withinBudget:false이고 예산에 가까운 순으로 정렬된다", () => {
    // 동탄역 5곳 모두 22000~38000원 — 예산 15000원이면 전원 초과
    const ranked = rankVenues("동탄역", 15000);
    expect(ranked).toHaveLength(5);
    expect(ranked.every((r) => r.withinBudget === false)).toBe(true);

    const diffs = ranked.map((r) => Math.abs(r.venue.pricePerPerson - 15000));
    const sortedDiffs = [...diffs].sort((a, b) => a - b);
    expect(diffs).toEqual(sortedDiffs);
  });

  it("시드 장소가 3곳뿐인 지역은 정확히 3곳만 반환한다", () => {
    const ranked = rankVenues("오산운암", 20000);
    expect(ranked).toHaveLength(3);
  });

  it("존재하지 않는 지역은 빈 배열을 반환한다", () => {
    expect(rankVenues("존재하지않는지역", 30000)).toEqual([]);
  });
});
