import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSavedVenueStore, type SavedVenueStore } from "@/services/saved-venue-store";

let store: SavedVenueStore;

vi.mock("@/services/saved-venue-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/saved-venue-store")>();
  return { ...actual, getSavedVenueStore: () => store };
});

const { DELETE: deleteSaved } = await import("../route");

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  store = createSavedVenueStore(":memory:");
});

describe("/api/saved/[id]", () => {
  it("장소 A 삭제 → A는 사라지고 다른 장소는 그대로 남는다", async () => {
    const [a] = store.saveMany([
      {
        id: "gangnam-charcoal",
        name: "숯불향 강남점",
        category: "고깃집",
        region: "강남역",
        rating: 4.6,
        reviewCount: 1204,
        viewCount: 8900,
        pricePerPerson: 28000,
      },
    ]);
    store.saveMany([
      {
        id: "gangnam-hof",
        name: "호프집 강남불빛",
        category: "호프",
        region: "강남역",
        rating: 4.3,
        reviewCount: 615,
        viewCount: 3800,
        pricePerPerson: 22000,
      },
    ]);

    const res = await deleteSaved(new Request("http://localhost/api/saved/x", { method: "DELETE" }), ctx(a.id));
    expect(res.status).toBe(204);

    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].venueId).toBe("gangnam-hof");
  });

  it("존재하지 않는 id → 404", async () => {
    const res = await deleteSaved(
      new Request("http://localhost/api/saved/x", { method: "DELETE" }),
      ctx("no-such-id"),
    );
    expect(res.status).toBe(404);
  });

  it("인증 헤더·쿠키 없이 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const [a] = store.saveMany([
      {
        id: "gangnam-charcoal",
        name: "숯불향 강남점",
        category: "고깃집",
        region: "강남역",
        rating: 4.6,
        reviewCount: 1204,
        viewCount: 8900,
        pricePerPerson: 28000,
      },
    ]);
    const res = await deleteSaved(new Request("http://localhost/api/saved/x", { method: "DELETE" }), ctx(a.id));
    expect(res.status).toBe(204);
  });
});
