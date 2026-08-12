import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVoteStore, type VoteStore } from "@/services/vote-store";
import type { Venue } from "@/types/recommendation";

let store: VoteStore;

vi.mock("@/services/vote-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/vote-store")>();
  return { ...actual, getVoteStore: () => store };
});

const { GET: getVote } = await import("../route");

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
  };
}

beforeEach(() => {
  store = createVoteStore(":memory:");
});

describe("GET /api/votes/[id]", () => {
  it("투표 링크 접속 → 후보 목록과 각 후보의 현재 득표수가 표시된다", async () => {
    const { id } = store.create([makeVenue("a", "A"), makeVenue("b", "B")], "1h");
    const res = await getVote(
      new Request(`http://localhost/api/votes/${id}?device=device-1`),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.candidates).toHaveLength(2);
    expect(detail.candidates.every((c: { voteCount: number }) => c.voteCount === 0)).toBe(true);
  });

  it("존재하지 않는 투표 id → 404", async () => {
    const res = await getVote(
      new Request("http://localhost/api/votes/no-such-id?device=device-1"),
      ctx("no-such-id"),
    );
    expect(res.status).toBe(404);
  });
});
