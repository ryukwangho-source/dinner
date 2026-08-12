import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVoteStore, type VoteStore } from "@/services/vote-store";

let store: VoteStore;

vi.mock("@/services/vote-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/vote-store")>();
  return { ...actual, getVoteStore: () => store };
});

const { GET: listVotes, POST: createVote } = await import("../route");

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
  it("POST 시드에 존재하는 장소 id들과 제한시간으로 생성 → 201 + id·deadlineAt, GET 목록에 나타난다", async () => {
    const res = await createVote(
      jsonRequest({ venueIds: ["osan-charcoal", "osan-hof"], duration: "1h" }),
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

  it("빈 venueIds → 400", async () => {
    const res = await createVote(jsonRequest({ venueIds: [], duration: "1h" }));
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 venueId만 있으면 400", async () => {
    const res = await createVote(jsonRequest({ venueIds: ["no-such-venue"], duration: "1h" }));
    expect(res.status).toBe(400);
  });

  it("일부만 존재하지 않는 venueId면 조용히 일부만 생성하지 않고 400", async () => {
    const res = await createVote(
      jsonRequest({ venueIds: ["osan-charcoal", "no-such-venue"], duration: "1h" }),
    );
    expect(res.status).toBe(400);

    const listRes = await listVotes();
    expect(await listRes.json()).toHaveLength(0);
  });

  it("유효하지 않은 duration → 400", async () => {
    const res = await createVote(jsonRequest({ venueIds: ["osan-charcoal"], duration: "5d" }));
    expect(res.status).toBe(400);
  });

  it("인증 헤더·쿠키 없이 호출해도 성공한다 (로그인 요구 없음)", async () => {
    const res = await createVote(jsonRequest({ venueIds: ["osan-charcoal"], duration: "30m" }));
    expect(res.status).toBe(201);
  });
});
