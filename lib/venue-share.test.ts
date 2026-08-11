import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareText, shareVenues } from "@/lib/venue-share";
import type { RankedVenue } from "@/types/recommendation";

function makeVenue(id: string, name: string, price: number) {
  return {
    id,
    name,
    category: "고깃집",
    region: "강남역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: price,
  };
}

const results: RankedVenue[] = [
  { venue: makeVenue("a", "숯불향 강남점", 28000), withinBudget: true },
  { venue: makeVenue("b", "이자카야 온기", 29500), withinBudget: true },
  { venue: makeVenue("c", "모던삼겹 강남", 27000), withinBudget: true },
  { venue: makeVenue("d", "오마카세 결", 42000), withinBudget: false },
  { venue: makeVenue("e", "호프집 강남불빛", 22000), withinBudget: true },
];

describe("buildShareText", () => {
  it("5곳의 이름이 모두 포함된다", () => {
    const text = buildShareText(results);
    for (const { venue } of results) {
      expect(text).toContain(venue.name);
    }
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
