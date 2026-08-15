import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVoteStore, type VoteStore } from "@/services/vote-store";
import type { Venue } from "@/types/recommendation";

let store: VoteStore;

vi.mock("@/services/vote-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/vote-store")>();
  return { ...actual, getVoteStore: () => store };
});

const { POST: submitBallot } = await import("../route");

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function makeVenue(id: string, name: string): Venue {
  return {
    id,
    name,
    category: "고깃집",
    region: "오산역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: 20000,
    walkingMinutes: null,
  };
}

function jsonRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/votes/${id}/ballot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  store = createVoteStore(":memory:");
});

describe("POST /api/votes/[id]/ballot", () => {
  it("후보 선택 제출 → 200, 득표수에 반영된다", async () => {
    const { id } = store.create([makeVenue("a", "A"), makeVenue("b", "B")], "1h");
    const candA = store.get(id, "device-1")!.candidates.find((c) => c.venueId === "a")!.id;

    const res = await submitBallot(jsonRequest(id, { deviceId: "device-1", selectedCandidateIds: [candA] }), ctx(id));
    expect(res.status).toBe(200);

    const detail = store.get(id, "device-1")!;
    expect(detail.candidates.find((c) => c.venueId === "a")?.voteCount).toBe(1);
  });

  it("인증 헤더·쿠키 없이 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const { id } = store.create([makeVenue("a", "A")], "1h");
    const candA = store.get(id, "device-1")!.candidates[0].id;
    const res = await submitBallot(jsonRequest(id, { deviceId: "device-1", selectedCandidateIds: [candA] }), ctx(id));
    expect(res.status).toBe(200);
  });

  it("선택 없이 제출 → 400", async () => {
    const { id } = store.create([makeVenue("a", "A")], "1h");
    const res = await submitBallot(jsonRequest(id, { deviceId: "device-1", selectedCandidateIds: [] }), ctx(id));
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 투표에 제출 → 404", async () => {
    const res = await submitBallot(
      jsonRequest("no-such-id", { deviceId: "device-1", selectedCandidateIds: ["x"] }),
      ctx("no-such-id"),
    );
    expect(res.status).toBe(404);
  });

  it("마감된 투표에 제출 → 409", async () => {
    const now = new Date("2026-08-12T14:00:00.000Z");
    const { id } = store.create([makeVenue("a", "A")], "30m", now);
    const candA = store.get(id, "device-1", now)!.candidates[0].id;

    // ballot route는 실제 시각(Date.now())을 쓰므로, 마감 검증은 vote-store 레벨 테스트(Task 1)에서
    // 이미 증명했고 여기서는 라우트가 store의 "closed" 결과를 409로 올바르게 매핑하는지만 확인한다.
    vi.spyOn(store, "submitBallot").mockReturnValueOnce("closed");
    const res = await submitBallot(jsonRequest(id, { deviceId: "device-1", selectedCandidateIds: [candA] }), ctx(id));
    expect(res.status).toBe(409);
  });
});
