import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareText, copyVoteLink, shareVenues, shareVoteLink } from "@/lib/venue-share";
import { naverMapSearchUrl } from "@/lib/venue-map-link";
import type { Venue } from "@/types/recommendation";

function makeVenue(id: string, name: string, price: number, region = "강남역"): Venue {
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

const venues: Venue[] = [
  makeVenue("a", "숯불향 강남점", 28000),
  makeVenue("b", "이자카야 온기", 29500),
];

describe("buildShareText", () => {
  it("모든 장소 이름이 포함된다", () => {
    const text = buildShareText(venues);
    for (const venue of venues) {
      expect(text).toContain(venue.name);
    }
  });

  it("각 장소마다 네이버 검색 링크가 함께 포함된다", () => {
    const text = buildShareText(venues);
    for (const venue of venues) {
      expect(text).toContain(naverMapSearchUrl(venue.name));
    }
  });

  it("각 장소마다 평점이 함께 포함된다", () => {
    const text = buildShareText(venues);
    for (const venue of venues) {
      expect(text).toContain(`★${venue.rating}`);
    }
  });

  it("선택하지 않은 장소는 포함되지 않는다", () => {
    const text = buildShareText([venues[0]]);
    expect(text).toContain(venues[0].name);
    expect(text).not.toContain(venues[1].name);
  });
});

describe("shareVenues", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("navigator.share가 있으면 호출된다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    const result = await shareVenues(venues);
    expect(share).toHaveBeenCalled();
    expect(result).toBe("shared");
  });

  it("navigator.share가 없으면 클립보드에 복사된다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const result = await shareVenues(venues);
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
