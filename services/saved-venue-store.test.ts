import { beforeEach, describe, expect, it } from "vitest";
import { createSavedVenueStore, type SavedVenueStore } from "@/services/saved-venue-store";
import type { Venue } from "@/types/recommendation";

function makeVenue(id: string): Venue {
  return {
    id,
    name: `장소-${id}`,
    category: "고깃집",
    region: "강남역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: 25000,
  };
}

describe("savedVenueStore", () => {
  let store: SavedVenueStore;

  beforeEach(() => {
    store = createSavedVenueStore(":memory:");
  });

  it("여러 장소를 한 번에 저장하면 모두 목록에 나타난다", () => {
    store.saveMany([makeVenue("a"), makeVenue("b")]);
    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list.map((v) => v.venueId).sort()).toEqual(["a", "b"]);
  });

  it("저장 레코드에는 저장자를 구분하는 필드가 없다", () => {
    const [saved] = store.saveMany([makeVenue("a")]);
    expect(Object.keys(saved).sort()).toEqual(
      ["category", "id", "name", "pricePerPerson", "region", "savedAt", "venueId"].sort(),
    );
  });

  it("목록은 최근 저장 순(역순)으로 정렬된다", () => {
    store.saveMany([makeVenue("a")]);
    store.saveMany([makeVenue("b")]);
    const list = store.list();
    expect(list[0].venueId).toBe("b");
    expect(list[1].venueId).toBe("a");
  });

  it("개별 삭제 — 지정한 장소만 사라지고 나머지는 남는다", () => {
    const [saved] = store.saveMany([makeVenue("a")]);
    store.saveMany([makeVenue("b")]);
    store.remove(saved.id);
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].venueId).toBe("b");
  });

  it("전체 삭제 — 목록이 0건이 된다", () => {
    store.saveMany([makeVenue("a"), makeVenue("b"), makeVenue("c")]);
    const removed = store.removeAll();
    expect(removed).toBe(3);
    expect(store.list()).toHaveLength(0);
  });
});
