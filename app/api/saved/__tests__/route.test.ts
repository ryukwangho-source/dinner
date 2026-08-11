import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSavedVenueStore, type SavedVenueStore } from "@/services/saved-venue-store";

let store: SavedVenueStore;

vi.mock("@/services/saved-venue-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/saved-venue-store")>();
  return { ...actual, getSavedVenueStore: () => store };
});

const { GET: listSaved, POST: saveVenues } = await import("../route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  store = createSavedVenueStore(":memory:");
});

describe("/api/saved", () => {
  it("POST 시드에 존재하는 장소 id들로 저장 → 201, GET 목록에 나타난다", async () => {
    const res = await saveVenues(jsonRequest({ venueIds: ["gangnam-charcoal", "gangnam-hof"] }));
    expect(res.status).toBe(201);
    const saved = await res.json();
    expect(saved).toHaveLength(2);

    const listRes = await listSaved();
    const list = await listRes.json();
    expect(list).toHaveLength(2);
  });

  it("인증 헤더·쿠키 없이 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const res = await saveVenues(jsonRequest({ venueIds: ["gangnam-charcoal"] }));
    expect(res.status).toBe(201);
  });

  it("빈 배열 POST → 400", async () => {
    const res = await saveVenues(jsonRequest({ venueIds: [] }));
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 venueId만 있으면 400", async () => {
    const res = await saveVenues(jsonRequest({ venueIds: ["no-such-venue"] }));
    expect(res.status).toBe(400);
  });
});
