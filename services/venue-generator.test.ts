import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ALLOWED_CATEGORIES,
  COURSE_ONE_CATEGORIES,
  COURSE_TWO_CATEGORIES,
  MAX_WALKING_MINUTES,
} from "@/config/venue-generation";
import {
  filterWithinWalkingDistance,
  generateVenues,
  parseVenuesFromText,
  splitByCourse,
  toVenues,
} from "@/services/venue-generator";

describe("generateVenues (GENERATE_FIXTURE=1)", () => {
  beforeEach(() => {
    process.env.GENERATE_FIXTURE = "1";
  });
  afterEach(() => {
    delete process.env.GENERATE_FIXTURE;
  });

  it("지역 하나당 1차·2차 각각 상위 5곳까지 반환한다", async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    expect(results).toHaveLength(1);
    expect(results[0].region).toBe("강남");
    expect(results[0].courseOne.length).toBeGreaterThan(0);
    expect(results[0].courseOne.length).toBeLessThanOrEqual(5);
    expect(results[0].courseTwo.length).toBeGreaterThan(0);
    expect(results[0].courseTwo.length).toBeLessThanOrEqual(5);
  });

  it("1차 후보는 식사 업종, 2차 후보는 간단한 술 업종에만 속한다", async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    const [{ courseOne, courseTwo }] = results;
    for (const { venue } of courseOne) {
      expect(COURSE_ONE_CATEGORIES).toContain(venue.category);
    }
    for (const { venue } of courseTwo) {
      expect(COURSE_TWO_CATEGORIES).toContain(venue.category);
    }
  });

  it("여러 지역을 입력하면 지역마다 각각 별도의 추천 결과가 반환된다", async () => {
    const { results } = await generateVenues(["강남", "홍대"], 8, 30000);
    expect(results.map((r) => r.region)).toEqual(["강남", "홍대"]);
    for (const { courseOne, courseTwo } of results) {
      for (const { venue } of [...courseOne, ...courseTwo]) {
        expect(ALLOWED_CATEGORIES).toContain(venue.category);
      }
    }
  });

  it("반환된 rating·reviewCount는 fixture 값 그대로이며 고정 상수로 대체되지 않는다", async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    const [{ courseOne, courseTwo }] = results;
    const all = [...courseOne, ...courseTwo];
    const ratings = new Set(all.map((r) => r.venue.rating));
    const reviewCounts = new Set(all.map((r) => r.venue.reviewCount));
    // 서로 다른 값이 섞여 있어야 한다 — 전부 같은 값이면 고정 상수로 대체됐다는 신호
    expect(ratings.size).toBeGreaterThan(1);
    expect(reviewCounts.size).toBeGreaterThan(1);
  });

  it("fixture 모드에서는 usage가 null이다 (실제 생성이 아니므로 토큰 사용량 없음)", async () => {
    const { usage } = await generateVenues(["강남"], 8, 30000);
    expect(usage).toBeNull();
  });

  it(`요청 지역에서 도보 ${MAX_WALKING_MINUTES}분을 초과하는 후보는 결과에 나타나지 않는다`, async () => {
    const { results } = await generateVenues(["강남"], 8, 30000);
    const [{ courseOne, courseTwo }] = results;
    for (const { venue } of [...courseOne, ...courseTwo]) {
      expect(venue.walkingMinutes).not.toBeNull();
      expect(venue.walkingMinutes as number).toBeLessThanOrEqual(MAX_WALKING_MINUTES);
    }
  });
});

describe("filterWithinWalkingDistance", () => {
  it(`도보 ${MAX_WALKING_MINUTES}분을 초과하는 후보는 걸러진다`, () => {
    const venues = toVenues(
      [
        { name: "가까운집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: MAX_WALKING_MINUTES },
        { name: "먼집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: MAX_WALKING_MINUTES + 1 },
      ],
      "강남",
    );
    expect(filterWithinWalkingDistance(venues).map((v) => v.name)).toEqual(["가까운집"]);
  });

  it("도보 시간을 알 수 없는(null) 후보도 걸러진다", () => {
    const venues = toVenues(
      [{ name: "도보정보없음", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: null }],
      "강남",
    );
    expect(filterWithinWalkingDistance(venues)).toHaveLength(0);
  });
});

describe("parseVenuesFromText", () => {
  it("JSON 코드 블록에서 venues 배열을 추출한다", () => {
    const text = '설명 텍스트\n```json\n{"venues":[{"name":"테스트집","category":"고깃집","rating":4.5,"reviewCount":100,"pricePerPerson":25000,"walkingMinutes":5}]}\n```';
    const venues = parseVenuesFromText(text);
    expect(venues).toEqual([
      { name: "테스트집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
    ]);
  });

  it("완전히 파싱 불가능한 텍스트를 주면 에러를 던진다", () => {
    expect(() => parseVenuesFromText("이건 JSON이 아닙니다")).toThrow();
  });
});

describe("toVenues", () => {
  it("화이트리스트에 없는 업종은 걸러진다", () => {
    const raw = [
      { name: "정상집", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
      { name: "카페", category: "카페", rating: 4.5, reviewCount: 100, pricePerPerson: 8000, walkingMinutes: 3 },
    ];
    const venues = toVenues(raw, "강남");
    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("정상집");
  });

  it("평점·리뷰수 문턱 미달 후보는 걸러진다", () => {
    const raw = [
      { name: "저평점집", category: "고깃집", rating: 3.0, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
    ];
    expect(toVenues(raw, "강남")).toHaveLength(0);
  });

  it("walkingMinutes가 null이면 그대로 null로 매핑된다", () => {
    const raw = [
      { name: "도보정보없음", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: null },
    ];
    expect(toVenues(raw, "강남")[0].walkingMinutes).toBeNull();
  });

  it("조사된 viewCount가 있으면 그 값을 그대로 쓴다(리뷰수 근사치로 대체하지 않는다)", () => {
    const raw = [
      { name: "실조회수집", category: "고깃집", rating: 4.5, reviewCount: 100, viewCount: 15000, pricePerPerson: 25000, walkingMinutes: 5 },
    ];
    expect(toVenues(raw, "강남")[0].viewCount).toBe(15000);
  });

  it("viewCount를 못 찾았으면 리뷰수 기반 근사치로 대체한다", () => {
    const raw = [
      { name: "조회수없음", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: 5 },
    ];
    expect(toVenues(raw, "강남")[0].viewCount).toBe(800);
  });
});

describe("generateVenues (직접 API 경로 — client 주입)", () => {
  function fakeVenuesResponse(count: number) {
    return {
      parsed_output: {
        venues: Array.from({ length: count }, (_, i) => ({
          name: `장소${i}`,
          category: "고깃집",
          rating: 4.5,
          reviewCount: 100,
          pricePerPerson: 25000,
          walkingMinutes: 5,
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
        parse: async () => fakeVenuesResponse(7),
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
});

describe("generateVenues — 1차 업종 다양성", () => {
  function fakeClient(categories: string[]): Anthropic {
    return {
      messages: {
        stream: () => ({
          finalMessage: async () => ({
            content: [{ type: "text", text: "조사 결과" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        }),
        parse: async () => ({
          parsed_output: {
            venues: categories.map((category, i) => ({
              name: `장소${i}`,
              category,
              rating: 4.9 - i * 0.1,
              reviewCount: 100,
              pricePerPerson: 25000,
              walkingMinutes: 5,
            })),
          },
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        }),
      },
    } as unknown as Anthropic;
  }

  it("서로 다른 업종이 5개 이상이면 1차 결과 5곳의 업종이 겹치지 않는다", async () => {
    const client = fakeClient(["고깃집", "고깃집", "일식", "중식", "양식", "횟집", "곱창"]);
    const { results } = await generateVenues(["강남"], 8, 30000, client);
    const categories = results[0].courseOne.map((r) => r.venue.category);
    expect(categories).toHaveLength(5);
    expect(new Set(categories).size).toBe(5);
  });

  it("서로 다른 업종이 5개 미만이면 남은 슬롯은 순위 순서대로 같은 업종으로 채운다", async () => {
    const client = fakeClient(["고깃집", "고깃집", "고깃집", "일식", "중식"]);
    const { results } = await generateVenues(["강남"], 8, 30000, client);
    const categories = results[0].courseOne.map((r) => r.venue.category);
    expect(categories).toHaveLength(5);
    expect(new Set(categories)).toEqual(new Set(["고깃집", "일식", "중식"]));
  });
});

describe("splitByCourse", () => {
  it("업종에 따라 1차(식사)·2차(술) 후보로 나눈다", () => {
    const venues = toVenues(
      [
        { name: "고깃집A", category: "고깃집", rating: 4.5, reviewCount: 100, pricePerPerson: 25000, walkingMinutes: null },
        { name: "이자카야A", category: "이자카야", rating: 4.5, reviewCount: 100, pricePerPerson: 20000, walkingMinutes: null },
      ],
      "강남",
    );
    const { courseOne, courseTwo } = splitByCourse(venues);
    expect(courseOne.map((v) => v.name)).toEqual(["고깃집A"]);
    expect(courseTwo.map((v) => v.name)).toEqual(["이자카야A"]);
  });
});
