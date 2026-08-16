import { describe, expect, it } from "vitest";
import { MAX_PAIR_WALKING_MINUTES, PAIR_COUNT } from "@/config/venue-generation";
import { type RawVenuePair, rankVenuePairs } from "@/lib/venue-ranking";
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

function makePair(
  courseOneId: string,
  courseOneOverrides: Partial<Venue> = {},
  walkingBetweenMinutes = 3,
): RawVenuePair {
  return {
    courseOne: makeVenue(courseOneId, courseOneOverrides),
    courseTwo: makeVenue(`${courseOneId}-2차`, { category: "이자카야" }),
    walkingBetweenMinutes,
  };
}

describe("rankVenuePairs", () => {
  it("1차 품질(예산 이내 → 평점)로 정렬한다", () => {
    const pairs = [
      makePair("a", { pricePerPerson: 40000 }),
      makePair("b", { pricePerPerson: 25000, rating: 4.9 }),
    ];
    const ranked = rankVenuePairs(pairs, 30000);
    expect(ranked[0].courseOne.venue.id).toBe("b");
    expect(ranked[0].courseOne.withinBudget).toBe(true);
    expect(ranked[1].courseOne.venue.id).toBe("a");
    expect(ranked[1].courseOne.withinBudget).toBe(false);
  });

  it("courseTwo의 withinBudget도 courseTwo 자신의 가격 기준으로 계산된다", () => {
    const pairs: RawVenuePair[] = [
      {
        courseOne: makeVenue("a", { pricePerPerson: 25000 }),
        courseTwo: makeVenue("a-2차", { category: "이자카야", pricePerPerson: 50000 }),
        walkingBetweenMinutes: 3,
      },
    ];
    const [ranked] = rankVenuePairs(pairs, 30000);
    expect(ranked.courseOne.withinBudget).toBe(true);
    expect(ranked.courseTwo.withinBudget).toBe(false);
  });

  it(`도보 ${MAX_PAIR_WALKING_MINUTES}분 이내 페어가 그 밖 페어보다 항상 먼저 나온다 (1차 품질과 무관하게)`, () => {
    const pairs = [
      makePair("far", { rating: 4.9 }, MAX_PAIR_WALKING_MINUTES + 5),
      makePair("near", { rating: 4.0 }, MAX_PAIR_WALKING_MINUTES),
    ];
    const ranked = rankVenuePairs(pairs, 30000);
    expect(ranked.map((r) => r.courseOne.venue.id)).toEqual(["near", "far"]);
  });

  it(`${PAIR_COUNT}쌍보다 많이 주어져도 상위 ${PAIR_COUNT}쌍으로 자른다`, () => {
    const pairs = Array.from({ length: PAIR_COUNT + 3 }, (_, i) =>
      makePair(`v${i}`, { rating: 4.0 + i * 0.05 }),
    );
    expect(rankVenuePairs(pairs, 30000)).toHaveLength(PAIR_COUNT);
  });

  it("페어가 없으면 빈 배열을 반환한다", () => {
    expect(rankVenuePairs([], 30000)).toEqual([]);
  });

  it("각 페어의 walkingBetweenMinutes가 그대로 유지된다", () => {
    const [ranked] = rankVenuePairs([makePair("a", {}, 4)], 30000);
    expect(ranked.walkingBetweenMinutes).toBe(4);
  });
});
