import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSavedVenueStore, type SavedVenueStore } from "@/services/saved-venue-store";
import type { Venue } from "@/types/recommendation";

let store: SavedVenueStore;

vi.mock("@/services/saved-venue-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/saved-venue-store")>();
  return { ...actual, getSavedVenueStore: () => store };
});

const { GET: listSaved, POST: saveVenues, DELETE: deleteAllSaved } = await import("../route");

function makeVenue(id: string): Venue {
  return {
    id,
    name: `장소-${id}`,
    category: "고깃집",
    region: "강남",
    rating: 4.6,
    reviewCount: 1204,
    viewCount: 8900,
    pricePerPerson: 28000,
    walkingMinutes: null,
  };
}

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
  it("POST로 venue 전체 객체를 보내 저장 → 201, GET 목록에 나타난다 (정적 배열에 없는 장소도 가능)", async () => {
    const res = await saveVenues(jsonRequest({ venues: [makeVenue("gen-1"), makeVenue("gen-2")] }));
    expect(res.status).toBe(201);
    const saved = await res.json();
    expect(saved).toHaveLength(2);

    const listRes = await listSaved();
    const list = await listRes.json();
    expect(list).toHaveLength(2);
  });

  it("인증 헤더·쿠키 없이 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const res = await saveVenues(jsonRequest({ venues: [makeVenue("gen-1")] }));
    expect(res.status).toBe(201);
  });

  it("빈 배열 POST → 400", async () => {
    const res = await saveVenues(jsonRequest({ venues: [] }));
    expect(res.status).toBe(400);
  });

  it("venue 형태가 불완전하면(필수 필드 누락) 400", async () => {
    const res = await saveVenues(jsonRequest({ venues: [{ id: "gen-1", name: "장소" }] }));
    expect(res.status).toBe(400);
  });

  it("같은 id의 venue가 중복 전송되면 한 번만 저장된다", async () => {
    const res = await saveVenues(jsonRequest({ venues: [makeVenue("gen-1"), makeVenue("gen-1")] }));
    const saved = await res.json();
    expect(saved).toHaveLength(1);
  });

  it("DELETE → 전체 삭제되고 삭제된 개수 반환, 목록도 빈다", async () => {
    await saveVenues(jsonRequest({ venues: [makeVenue("gen-1")] }));
    await saveVenues(jsonRequest({ venues: [makeVenue("gen-2")] }));

    const res = await deleteAllSaved();
    const body = await res.json();
    expect(body.deleted).toBe(2);

    const listRes = await listSaved();
    expect(await listRes.json()).toHaveLength(0);
  });

  it("인증 헤더·쿠키 없이 DELETE를 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const res = await deleteAllSaved();
    expect(res.status).toBe(200);
  });
});
