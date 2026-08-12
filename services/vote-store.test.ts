import { beforeEach, describe, expect, it } from "vitest";
import { createVoteStore, type VoteStore } from "@/services/vote-store";
import type { Venue } from "@/types/recommendation";

function makeVenue(id: string, name: string, price: number): Venue {
  return {
    id,
    name,
    category: "고깃집",
    region: "오산역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: price,
  };
}

const NOW = new Date("2026-08-12T14:00:00.000Z");

describe("voteStore", () => {
  let store: VoteStore;

  beforeEach(() => {
    store = createVoteStore(":memory:");
  });

  it("후보 스냅샷은 생성 시점 값을 그대로 유지한다 (원본 객체를 나중에 바꿔도 영향 없음)", () => {
    const venue = makeVenue("osan-charcoal", "숯불향 오산역점", 28000);
    const { id } = store.create([venue], "1h", NOW);

    // 원본 객체를 생성 후 변형해도 스토어에 저장된 스냅샷은 영향받지 않는다
    venue.name = "변경된이름";
    venue.pricePerPerson = 99999;

    const detail = store.get(id, "device-a", NOW);
    expect(detail?.candidates[0]).toMatchObject({
      venueId: "osan-charcoal",
      name: "숯불향 오산역점",
      pricePerPerson: 28000,
    });
  });

  it("같은 기기가 [A,B] 제출 후 [A,C]로 재제출하면 B는 반영되지 않고 A·C만 반영된다", () => {
    const a = makeVenue("a", "A", 20000);
    const b = makeVenue("b", "B", 21000);
    const c = makeVenue("c", "C", 22000);
    const { id } = store.create([a, b, c], "1h", NOW);
    const initial = store.get(id, "device-1", NOW)!;
    const candA = initial.candidates.find((cand) => cand.venueId === "a")!.id;
    const candB = initial.candidates.find((cand) => cand.venueId === "b")!.id;
    const candC = initial.candidates.find((cand) => cand.venueId === "c")!.id;

    store.submitBallot(id, "device-1", [candA, candB], NOW);
    store.submitBallot(id, "device-1", [candA, candC], NOW);

    const detail = store.get(id, "device-1", NOW)!;
    const tally = Object.fromEntries(detail.candidates.map((cand) => [cand.venueId, cand.voteCount]));
    expect(tally).toEqual({ a: 1, b: 0, c: 1 });
    expect(detail.mySelection.sort()).toEqual([candA, candC].sort());
  });

  it("서로 다른 기기 3대가 각각 [A],[A,B],[B]를 제출하면 A=2표, B=2표로 정확히 합산된다", () => {
    const a = makeVenue("a", "A", 20000);
    const b = makeVenue("b", "B", 21000);
    const { id } = store.create([a, b], "1h", NOW);
    const initial = store.get(id, "device-x", NOW)!;
    const candA = initial.candidates.find((cand) => cand.venueId === "a")!.id;
    const candB = initial.candidates.find((cand) => cand.venueId === "b")!.id;

    store.submitBallot(id, "device-1", [candA], NOW);
    store.submitBallot(id, "device-2", [candA, candB], NOW);
    store.submitBallot(id, "device-3", [candB], NOW);

    const detail = store.get(id, "device-x", NOW)!;
    const tally = Object.fromEntries(detail.candidates.map((cand) => [cand.venueId, cand.voteCount]));
    expect(tally).toEqual({ a: 2, b: 2 });
  });

  it("마감 시각이 지난 투표에 제출을 시도하면 거부된다", () => {
    const a = makeVenue("a", "A", 20000);
    const { id } = store.create([a], "30m", NOW);

    const afterDeadline = new Date(NOW.getTime() + 31 * 60 * 1000);
    const result = store.submitBallot(id, "device-1", ["a"], afterDeadline);
    expect(result).toBe("closed");

    const detail = store.get(id, "device-1", afterDeadline)!;
    expect(detail.candidates[0].voteCount).toBe(0);
    expect(detail.isClosed).toBe(true);
  });

  it("존재하지 않는 투표에 제출하면 not-found를 반환한다", () => {
    expect(store.submitBallot("no-such-id", "device-1", ["a"], NOW)).toBe("not-found");
  });

  it("존재하지 않는 투표 조회 시 null을 반환한다", () => {
    expect(store.get("no-such-id", "device-1", NOW)).toBeNull();
  });

  it("전체 투표 목록은 생성 시각 역순으로 정렬되고 상태(open/closed)가 계산된다", () => {
    const a = makeVenue("a", "A", 20000);
    const first = store.create([a], "30m", NOW);
    const later = new Date(NOW.getTime() + 1000);
    const second = store.create([a], "1h", later);

    const afterFirstDeadline = new Date(NOW.getTime() + 31 * 60 * 1000);
    const list = store.listAll(afterFirstDeadline);

    expect(list.map((v) => v.id)).toEqual([second.id, first.id]);
    expect(list.find((v) => v.id === first.id)?.status).toBe("closed");
    expect(list.find((v) => v.id === second.id)?.status).toBe("open");
    expect(list.find((v) => v.id === first.id)?.candidateCount).toBe(1);
  });
});
