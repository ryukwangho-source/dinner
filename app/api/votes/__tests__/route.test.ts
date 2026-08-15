import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVoteStore, type VoteStore } from "@/services/vote-store";
import type { Venue } from "@/types/recommendation";

let store: VoteStore;

vi.mock("@/services/vote-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/vote-store")>();
  return { ...actual, getVoteStore: () => store };
});

const { GET: listVotes, POST: createVote } = await import("../route");

function makeVenue(id: string): Venue {
  return {
    id,
    name: `장소-${id}`,
    category: "고깃집",
    region: "오산역",
    rating: 4.6,
    reviewCount: 1204,
    viewCount: 8900,
    pricePerPerson: 28000,
    walkingMinutes: null,
  };
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/votes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  store = createVoteStore(":memory:");
});

describe("/api/votes", () => {
  it("POST로 venue 전체 객체들과 제한시간으로 생성 → 201 + id·deadlineAt, GET 목록에 나타난다 (정적 배열에 없는 장소도 가능)", async () => {
    const res = await createVote(
      jsonRequest({ venues: [makeVenue("gen-1"), makeVenue("gen-2")], duration: "1h" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.deadlineAt).toBeTruthy();

    const listRes = await listVotes();
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].candidateCount).toBe(2);
  });

  it("빈 venues → 400", async () => {
    const res = await createVote(jsonRequest({ venues: [], duration: "1h" }));
    expect(res.status).toBe(400);
  });

  it("venue 형태가 불완전하면(필수 필드 누락) 400", async () => {
    const res = await createVote(
      jsonRequest({ venues: [{ id: "gen-1", name: "장소" }], duration: "1h" }),
    );
    expect(res.status).toBe(400);
  });

  it("같은 id의 venue가 중복 전송되면 후보 하나로만 등록된다", async () => {
    const res = await createVote(
      jsonRequest({ venues: [makeVenue("gen-1"), makeVenue("gen-1")], duration: "1h" }),
    );
    const body = await res.json();

    const listRes = await listVotes();
    const list = await listRes.json();
    expect(list.find((v: { id: string }) => v.id === body.id)?.candidateCount).toBe(1);
  });

  it("유효하지 않은 duration → 400", async () => {
    const res = await createVote(jsonRequest({ venues: [makeVenue("gen-1")], duration: "5d" }));
    expect(res.status).toBe(400);
  });

  it("인증 헤더·쿠키 없이 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const res = await createVote(jsonRequest({ venues: [makeVenue("gen-1")], duration: "30m" }));
    expect(res.status).toBe(201);
  });
});
