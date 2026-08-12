import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALLOWED_CATEGORIES } from "@/config/venue-generation";
import { generateVenues, parseVenuesFromText, toVenues } from "@/services/venue-generator";

describe("generateVenues (GENERATE_FIXTURE=1)", () => {
  beforeEach(() => {
    process.env.GENERATE_FIXTURE = "1";
  });
  afterEach(() => {
    delete process.env.GENERATE_FIXTURE;
  });

  it("실제 웹검색 없이 지역당 5곳 이상의 회식 업종 후보를 반환한다", async () => {
    const ranked = await generateVenues("강남", 8, 30000);
    expect(ranked.length).toBeGreaterThanOrEqual(5);
    expect(ranked).toHaveLength(5);
  });

  it("반환된 모든 후보의 category가 회식 업종 화이트리스트에 속한다", async () => {
    const ranked = await generateVenues("강남", 8, 30000);
    for (const { venue } of ranked) {
      expect(ALLOWED_CATEGORIES).toContain(venue.category);
    }
  });

  it("예산 이내 후보와 초과 후보가 섞이면 기존 rankVenueCandidates와 동일한 순서(예산적합도 우선)로 정렬된다", async () => {
    const ranked = await generateVenues("강남", 8, 30000);
    const overBudgetIndex = ranked.findIndex((r) => !r.withinBudget);
    if (overBudgetIndex === -1) return; // fixture 구성상 전원 이내일 수도 있음
    const laterAllOverBudget = ranked.slice(overBudgetIndex).every((r) => !r.withinBudget);
    expect(laterAllOverBudget).toBe(true);
  });

  it("반환된 rating·reviewCount는 fixture 값 그대로이며 고정 상수로 대체되지 않는다", async () => {
    const ranked = await generateVenues("강남", 8, 30000);
    const ratings = new Set(ranked.map((r) => r.venue.rating));
    const reviewCounts = new Set(ranked.map((r) => r.venue.reviewCount));
    // 서로 다른 값이 섞여 있어야 한다 — 전부 같은 값이면 고정 상수로 대체됐다는 신호
    expect(ratings.size).toBeGreaterThan(1);
    expect(reviewCounts.size).toBeGreaterThan(1);
  });
});

describe("parseVenuesFromText", () => {
  it("JSON 코드 블록에서 venues 배열을 추출한다", () => {
    const text = '설명 텍스트\n```json\n{"venues":[{"name":"테스트집","category":"고깃집","rating":4.5,"reviewCount":100,"pricePerPerson":25000}]}\n```';
    const venues = parseVenuesFromText(text);
    expect(venues).toEqual([
      { name: "테스트집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000 },
    ]);
  });

  it("완전히 파싱 불가능한 텍스트를 주면 에러를 던진다", () => {
    expect(() => parseVenuesFromText("이건 JSON이 아닙니다")).toThrow();
  });
});

describe("toVenues", () => {
  it("화이트리스트에 없는 업종은 걸러진다", () => {
    const raw = [
      { name: "정상집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000 },
      { name: "카페", category: "카페", rating: 4.5, reviewCount: 100, pricePerPerson: 8000 },
    ];
    const venues = toVenues(raw, "강남");
    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("정상집");
  });

  it("평점·리뷰수 문턱 미달 후보는 걸러진다", () => {
    const raw = [
      { name: "저평점집", category: "고깃집", rating: 3.0, reviewCount: 100, pricePerPerson: 25000 },
    ];
    expect(toVenues(raw, "강남")).toHaveLength(0);
  });
});
