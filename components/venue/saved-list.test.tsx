import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SavedList } from "@/components/venue/saved-list";
import type { SavedVenue } from "@/services/saved-venue-store";

const items: SavedVenue[] = [
  {
    id: "s1",
    venueId: "gangnam-hof",
    name: "호프집 강남불빛",
    category: "호프",
    region: "강남역",
    pricePerPerson: 22000,
    savedAt: "2026-08-12T00:10:00.000Z",
  },
  {
    id: "s2",
    venueId: "gangnam-charcoal",
    name: "숯불향 강남점",
    category: "고깃집",
    region: "강남역",
    pricePerPerson: 28000,
    savedAt: "2026-08-12T00:05:00.000Z",
  },
];

describe("SavedList", () => {
  it("전달받은 순서 그대로 각 장소를 렌더한다", () => {
    render(<SavedList items={items} />);
    const names = screen.getAllByTestId("saved-item-name").map((el) => el.textContent);
    expect(names).toEqual(["호프집 강남불빛", "숯불향 강남점"]);
  });
});
