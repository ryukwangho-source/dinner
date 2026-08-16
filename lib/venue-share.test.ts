import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareText, copyVoteLink, shareVenues, shareVoteLink } from "@/lib/venue-share";
import { naverMapSearchUrl } from "@/lib/venue-map-link";
import type { RegionRecommendation } from "@/types/recommendation";

function makeVenue(id: string, name: string, price: number, region = "강남역") {
  return {
    id,
    name,
    category: "고깃집",
    region,
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: price,
    walkingMinutes: null,
  };
}

const results: RegionRecommendation[] = [
  {
    region: "강남역",
    courseOne: [
      { venue: makeVenue("a", "숯불향 강남점", 28000), withinBudget: true },
      { venue: makeVenue("c", "모던삼겹 강남", 27000), withinBudget: true },
      { venue: makeVenue("d", "오마카세 결", 42000), withinBudget: false },
    ],
    courseTwo: [
      { venue: makeVenue("b", "이자카야 온기", 29500), withinBudget: true },
      { venue: makeVenue("e", "호프집 강남불빛", 22000), withinBudget: true },
    ],
  },
];

describe("buildShareText", () => {
  it("모든 장소 이름이 포함된다", () => {
    const text = buildShareText(results);
    for (const { courseOne, courseTwo } of results) {
      for (const { venue } of [...courseOne, ...courseTwo]) {
        expect(text).toContain(venue.name);
      }
    }
  });

  it("각 장소마다 네이버 검색 링크가 함께 포함된다", () => {
    const text = buildShareText(results);
    for (const { courseOne, courseTwo } of results) {
      for (const { venue } of [...courseOne, ...courseTwo]) {
        expect(text).toContain(naverMapSearchUrl(venue.name, venue.region));
      }
    }
  });

  it("지역명과 1차·2차 구분 라벨이 포함된다", () => {
    const text = buildShareText(results);
    expect(text).toContain("[강남역]");
    expect(text).toContain("1차");
    expect(text).toContain("2차");
  });
});

describe("shareVenues", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigator.share가 있으면 호출된다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    const result = await shareVenues(results);
    expect(share).toHaveBeenCalled();
    expect(result).toBe("shared");
  });

  it("navigator.share가 없으면 클립보드에 복사된다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const result = await shareVenues(results);
    expect(writeText).toHaveBeenCalled();
    expect(result).toBe("copied");
  });
});

describe("shareVoteLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigator.share가 있으면 그 URL로 호출된다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    const result = await shareVoteLink("https://dinner.example/vote/abc");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ text: "https://dinner.example/vote/abc" }),
    );
    expect(result).toBe("shared");
  });

  it("navigator.share가 없으면 URL이 클립보드에 복사된다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const result = await shareVoteLink("https://dinner.example/vote/abc");
    expect(writeText).toHaveBeenCalledWith("https://dinner.example/vote/abc");
    expect(result).toBe("copied");
  });
});

describe("copyVoteLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigator.share 지원 여부와 무관하게 항상 클립보드로 복사한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    const result = await copyVoteLink("https://dinner.example/vote/abc");
    expect(writeText).toHaveBeenCalledWith("https://dinner.example/vote/abc");
    expect(share).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("클립보드 API가 없으면 false를 반환한다", async () => {
    vi.stubGlobal("navigator", {});
    expect(await copyVoteLink("https://dinner.example/vote/abc")).toBe(false);
  });
});
