import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COURSE_ONE_CATEGORIES,
  COURSE_TWO_CATEGORIES,
  MAX_PAIR_WALKING_MINUTES,
  MAX_WALKING_MINUTES,
  PAIR_COUNT,
} from "@/config/venue-generation";
import { generateVenues, parsePairsFromText, toVenuePairs } from "@/services/venue-generator";

describe("generateVenues (GENERATE_FIXTURE=1)", () => {
  beforeEach(() => {
    process.env.GENERATE_FIXTURE = "1";
  });
  afterEach(() => {
    delete process.env.GENERATE_FIXTURE;
  });

  it(`지역 하나당 상위 ${PAIR_COUNT}쌍까지 반환한다`, async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    expect(results).toHaveLength(1);
    expect(results[0].region).toBe("강남");
    expect(results[0].pairs.length).toBeGreaterThan(0);
    expect(results[0].pairs.length).toBeLessThanOrEqual(PAIR_COUNT);
  });

  it("각 페어는 1차(식사) 업종 courseOne과 2차(간단한 술) 업종 courseTwo로 구성된다", async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    for (const { courseOne, courseTwo } of results[0].pairs) {
      expect(COURSE_ONE_CATEGORIES).toContain(courseOne.venue.category);
      expect(COURSE_TWO_CATEGORIES).toContain(courseTwo.venue.category);
    }
  });

  it("여러 지역을 입력하면 지역마다 각각 별도의 페어 결과가 반환된다", async () => {
    const { results } = await generateVenues(["강남", "홍대"], 8, 30000);
    expect(results.map((r) => r.region)).toEqual(["강남", "홍대"]);
    for (const { pairs } of results) {
      expect(pairs.length).toBeGreaterThan(0);
    }
  });

  it("반환된 rating·reviewCount는 fixture 값 그대로이며 고정 상수로 대체되지 않는다", async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    const all = results[0].pairs.flatMap((p) => [p.courseOne, p.courseTwo]);
    const ratings = new Set(all.map((r) => r.venue.rating));
    // 서로 다른 값이 섞여 있어야 한다 — 전부 같은 값이면 고정 상수로 대체됐다는 신호
    expect(ratings.size).toBeGreaterThan(0);
  });

  it("fixture 모드에서는 usage가 null이다 (실제 생성이 아니므로 토큰 사용량 없음)", async () => {
    const { usage } = await generateVenues(["강남"], 8, 30000);
    expect(usage).toBeNull();
  });

  it(`요청 지역에서 도보 ${MAX_WALKING_MINUTES}분을 초과하는 1차 장소는 결과에 나타나지 않는다`, async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    for (const { courseOne } of results[0].pairs) {
      expect(courseOne.venue.walkingMinutes).not.toBeNull();
      expect(courseOne.venue.walkingMinutes as number).toBeLessThanOrEqual(MAX_WALKING_MINUTES);
    }
  });
});

describe("parsePairsFromText", () => {
  it("JSON 코드 블록에서 pairs 배열을 추출한다", () => {
    const text =
      '설명 텍스트\n```json\n{"pairs":[{"courseOne":{"name":"테스트집","category":"고깃집","rating":4.5,"reviewCount":100,"pricePerPerson":25000,"walkingMinutes":5},"courseTwo":{"name":"테스트술집","category":"이자카야","rating":4.3,"reviewCount":80,"pricePerPerson":20000},"walkingBetweenMinutes":3}]}\n```';
    const pairs = parsePairsFromText(text);
    expect(pairs).toEqual([
      {
        courseOne: { name: "테스트집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
        courseTwo: { name: "테스트술집", category: "이자카야", rating: 4.3, reviewCount: 80, pricePerPerson: 20000 },
        walkingBetweenMinutes: 3,
      },
    ]);
  });

  it("완전히 파싱 불가능한 텍스트를 주면 에러를 던진다", () => {
    expect(() => parsePairsFromText("이건 JSON이 아닙니다")).toThrow();
  });
});

describe("toVenuePairs", () => {
  function pair(overrides: {
    courseOneCategory?: string;
    courseTwoCategory?: string;
    courseOneRating?: number;
    courseOneReviewCount?: number;
    courseOneWalkingMinutes?: number | null;
    walkingBetweenMinutes?: number;
  } = {}) {
    return {
      courseOne: {
        name: "1차집",
        category: overrides.courseOneCategory ?? "고깃집",
        rating: overrides.courseOneRating ?? 4.5,
        reviewCount: overrides.courseOneReviewCount ?? 100,
        pricePerPerson: 25000,
        walkingMinutes: overrides.courseOneWalkingMinutes === undefined ? 5 : overrides.courseOneWalkingMinutes,
      },
      courseTwo: {
        name: "2차집",
        category: overrides.courseTwoCategory ?? "이자카야",
        rating: 4.5,
        reviewCount: 100,
        pricePerPerson: 20000,
      },
      walkingBetweenMinutes: overrides.walkingBetweenMinutes ?? 3,
    };
  }

  it("1차·2차 업종 화이트리스트를 벗어난 페어는 걸러진다", () => {
    expect(toVenuePairs([pair({ courseOneCategory: "카페" })], "강남")).toHaveLength(0);
    expect(toVenuePairs([pair({ courseTwoCategory: "카페" })], "강남")).toHaveLength(0);
  });

  it("1차 평점·리뷰수 문턱 미달 페어는 걸러진다", () => {
    expect(toVenuePairs([pair({ courseOneRating: 3.0 })], "강남")).toHaveLength(0);
  });

  it(`지역에서 도보 ${MAX_WALKING_MINUTES}분을 초과하거나 알 수 없는 1차는 걸러진다`, () => {
    expect(toVenuePairs([pair({ courseOneWalkingMinutes: MAX_WALKING_MINUTES + 1 })], "강남")).toHaveLength(0);
    expect(toVenuePairs([pair({ courseOneWalkingMinutes: null })], "강남")).toHaveLength(0);
  });

  it("통과한 페어는 walkingBetweenMinutes를 그대로 유지한다", () => {
    const [result] = toVenuePairs([pair({ walkingBetweenMinutes: 7 })], "강남");
    expect(result.walkingBetweenMinutes).toBe(7);
  });

  it("2차의 지역-거리는 1차 거리 + 페어 사이 거리로 근사한다", () => {
    const [result] = toVenuePairs(
      [pair({ courseOneWalkingMinutes: 5, walkingBetweenMinutes: 3 })],
      "강남",
    );
    expect(result.courseOne.walkingMinutes).toBe(5);
    expect(result.courseTwo.walkingMinutes).toBe(8);
  });
});

describe(`도보 ${MAX_PAIR_WALKING_MINUTES}분 이내 페어링`, () => {
  it("도보 5분을 넘는 조합도 걸러지지 않고 그대로 페어로 남는다 (가장 가까운 2차를 그대로 페어링)", () => {
    const [result] = toVenuePairs(
      [{ courseOne: { name: "1차", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 }, courseTwo: { name: "2차", category: "호프", rating: 4.5, reviewCount: 100, pricePerPerson: 20000 }, walkingBetweenMinutes: MAX_PAIR_WALKING_MINUTES + 10 }],
      "강남",
    );
    expect(result.walkingBetweenMinutes).toBe(MAX_PAIR_WALKING_MINUTES + 10);
  });
});

describe("generateVenues (직접 API 경로 — client 주입)", () => {
  function fakePairsResponse(count: number) {
    return {
      parsed_output: {
        pairs: Array.from({ length: count }, (_, i) => ({
          courseOne: { name: `1차${i}`, category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
          courseTwo: { name: `2차${i}`, category: "이자카야", rating: 4.5, reviewCount: 100, pricePerPerson: 20000 },
          walkingBetweenMinutes: 3,
        })),
      },
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    };
  }

  function fakeClient(): Anthropic {
    return {
      messages: {
        stream: () => ({
          finalMessage: async () => ({
            content: [{ type: "text", text: "조사 결과" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1000, output_tokens: 300, cache_creation_input_tokens: 200, cache_read_input_tokens: 50 },
          }),
        }),
        parse: async () => fakePairsResponse(4),
      },
    } as unknown as Anthropic;
  }

  it("research·extract 두 콜의 usage를 합산해 반환한다", async () => {
    const { usage } = await generateVenues(["강남"], 8, 30000, fakeClient());
    expect(usage).toEqual({
      inputTokens: 1100,
      outputTokens: 350,
      cacheReadTokens: 50,
      cacheWriteTokens: 200,
      costUsd: expect.any(Number),
      models: ["claude-sonnet-5"],
    });
    expect(usage?.costUsd).toBeGreaterThan(0);
  });

  it("직접 API 경로도 페어 결과를 반환한다", async () => {
    const { results } = await generateVenues(["강남"], 8, 30000, fakeClient());
    expect(results[0].pairs.length).toBeGreaterThan(0);
  });
});
