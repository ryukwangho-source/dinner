import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COURSE_TWO_CATEGORIES, MAX_WALKING_MINUTES } from "@/config/venue-generation";
import {
  generateManualVenues,
  parseManualResultFromText,
  toCourseTwoVenues,
} from "@/services/venue-manual-generator";

describe("generateManualVenues (GENERATE_FIXTURE=1)", () => {
  beforeEach(() => {
    process.env.GENERATE_FIXTURE = "1";
  });
  afterEach(() => {
    delete process.env.GENERATE_FIXTURE;
  });

  it("입력한 장소명을 그대로 1차 카드 1곳으로 반환한다", async () => {
    const { results } = await generateManualVenues("브리비트 강남역점", 8, 30000);
    expect(results).toHaveLength(1);
    expect(results[0].region).toBe("브리비트 강남역점");
    expect(results[0].courseOne).toHaveLength(1);
    expect(results[0].courseOne[0].venue.name).toBe("브리비트 강남역점");
  });

  it("1차 카드의 walkingMinutes는 null이다 (기준점 자체이므로 도보시간 표시 없음)", async () => {
    const { results } = await generateManualVenues("브리비트 강남역점", 8, 30000);
    expect(results[0].courseOne[0].venue.walkingMinutes).toBeNull();
  });

  it("도보 10분 이내 2차 후보가 5곳 이상인 fixture로는 2차 카드가 정확히 5개 반환된다", async () => {
    const { results } = await generateManualVenues("브리비트 강남역점", 8, 30000);
    expect(results[0].courseTwo).toHaveLength(5);
    for (const { venue } of results[0].courseTwo) {
      expect(venue.walkingMinutes).not.toBeNull();
      expect(venue.walkingMinutes as number).toBeLessThanOrEqual(MAX_WALKING_MINUTES);
      expect(COURSE_TWO_CATEGORIES).toContain(venue.category);
    }
  });

  it("반환된 1차·2차 항목의 rating·reviewCount·viewCount는 fixture 값 그대로이며 고정 상수로 대체되지 않는다", async () => {
    const { results } = await generateManualVenues("브리비트 강남역점", 8, 30000);
    const all = [results[0].courseOne[0], ...results[0].courseTwo];
    const ratings = new Set(all.map((r) => r.venue.rating));
    const reviewCounts = new Set(all.map((r) => r.venue.reviewCount));
    const viewCounts = new Set(all.map((r) => r.venue.viewCount));
    expect(ratings.size).toBeGreaterThan(1);
    expect(reviewCounts.size).toBeGreaterThan(1);
    expect(viewCounts.size).toBeGreaterThan(1);
  });

  it("회식과 무관해 보이는 이름(카페 등)이어도 업종을 이유로 거부되지 않고 1차 카드로 그대로 나온다", async () => {
    const { results } = await generateManualVenues("스타벅스 강남역점", 8, 30000);
    expect(results[0].courseOne).toHaveLength(1);
    expect(results[0].courseOne[0].venue.name).toBe("스타벅스 강남역점");
  });

  it("장소를 확인할 수 없으면(fixture 의도된 실패) 에러를 던진다", async () => {
    await expect(generateManualVenues("존재하지않는실패장소", 8, 30000)).rejects.toThrow();
  });

  it("fixture 모드에서는 usage가 null이다", async () => {
    const { usage } = await generateManualVenues("브리비트 강남역점", 8, 30000);
    expect(usage).toBeNull();
  });
});

describe("toCourseTwoVenues", () => {
  it("2차 업종 화이트리스트(이자카야·호프)에 없는 후보는 걸러진다", () => {
    const raw = [
      { name: "정상집", category: "이자카야", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
      { name: "카페", category: "카페", rating: 4.5, reviewCount: 100, pricePerPerson: 8000, walkingMinutes: 3 },
    ];
    const venues = toCourseTwoVenues(raw, "테스트장소");
    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("정상집");
  });

  it("평점·리뷰수 문턱 미달 후보는 걸러진다", () => {
    const raw = [
      { name: "저평점집", category: "호프", rating: 3.0, reviewCount: 100, pricePerPerson: 20000, walkingMinutes: 5 },
    ];
    expect(toCourseTwoVenues(raw, "테스트장소")).toHaveLength(0);
  });
});

describe("parseManualResultFromText", () => {
  it("JSON 코드 블록에서 place·courseTwo를 추출한다", () => {
    const text =
      '설명\n```json\n{"place":{"name":"테스트집","category":"양식","rating":4.5,"reviewCount":100,"viewCount":1000,"pricePerPerson":30000},"courseTwo":[{"name":"호프집","category":"호프","rating":4.2,"reviewCount":80,"viewCount":600,"pricePerPerson":20000,"walkingMinutes":5}]}\n```';
    const parsed = parseManualResultFromText(text);
    expect(parsed.place.name).toBe("테스트집");
    expect(parsed.courseTwo).toHaveLength(1);
    expect(parsed.courseTwo[0].name).toBe("호프집");
  });

  it("완전히 파싱 불가능한 텍스트를 주면 에러를 던진다", () => {
    expect(() => parseManualResultFromText("이건 JSON이 아닙니다")).toThrow();
  });

  it("found:false로 응답하면(장소를 못 찾음) 에러를 던진다", () => {
    const text = '```json\n{"found":false}\n```';
    expect(() => parseManualResultFromText(text)).toThrow();
  });
});
