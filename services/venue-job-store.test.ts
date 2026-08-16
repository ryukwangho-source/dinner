import { beforeEach, describe, expect, it } from "vitest";
import { createVenueJobStore, type VenueJobStore } from "@/services/venue-job-store";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RegionRecommendation } from "@/types/recommendation";

function fakeResult(): RegionRecommendation[] {
  return [
    {
      region: "강남",
      courseOne: [
        {
          venue: {
            id: "v1",
            name: "테스트집",
            category: "고깃집",
            region: "강남",
            rating: 4.5,
            reviewCount: 100,
            viewCount: 800,
            pricePerPerson: 25000,
            walkingMinutes: 5,
          },
          withinBudget: true,
        },
      ],
      courseTwo: [],
    },
  ];
}

describe("venueJobStore", () => {
  let store: VenueJobStore;

  beforeEach(() => {
    store = createVenueJobStore(":memory:");
  });

  it("create() 직후 상태는 pending이고, markRunning/markDone/markError로 상태가 바뀐다", () => {
    const job = store.create(["강남"], 8, 30000);
    expect(job.status).toBe("pending");
    expect(job.regions).toEqual(["강남"]);

    store.markRunning(job.id);
    expect(store.get(job.id)?.status).toBe("running");

    store.markDone(job.id, fakeResult());
    const done = store.get(job.id);
    expect(done?.status).toBe("done");
    expect(done?.result).toEqual(fakeResult());
  });

  it("markDone에 usage를 함께 넘기면 조회 시 그대로 담겨 나온다", () => {
    const job = store.create(["강남"], 8, 30000);
    const usage: GenerationUsage = {
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0.01,
      models: ["claude-sonnet-5"],
    };
    store.markDone(job.id, fakeResult(), usage);
    expect(store.get(job.id)?.usage).toEqual(usage);
  });

  it("usage 없이 markDone하면 usage는 null이다", () => {
    const job = store.create(["강남"], 8, 30000);
    store.markDone(job.id, fakeResult());
    expect(store.get(job.id)?.usage).toBeNull();
  });

  it("markError로 실패 처리하면 status가 error이고 error 메시지가 담긴다", () => {
    const job = store.create(["강남"], 8, 30000);
    store.markError(job.id, "생성 실패");
    const failed = store.get(job.id);
    expect(failed?.status).toBe("error");
    expect(failed?.error).toBe("생성 실패");
  });

  it("get()으로 존재하지 않는 id를 조회하면 null을 반환한다", () => {
    expect(store.get("no-such-id")).toBeNull();
  });

  describe("findFresh", () => {
    it("6시간 이내 완료된 job이 있으면 반환한다", () => {
      const job = store.create(["강남"], 8, 30000);
      store.markDone(job.id, fakeResult());

      const fresh = store.findFresh(["강남"], 8, 30000, new Date(Date.now() + 5 * 60 * 60 * 1000));
      expect(fresh?.id).toBe(job.id);
    });

    it("6시간이 지나면 null을 반환한다", () => {
      const job = store.create(["강남"], 8, 30000);
      store.markDone(job.id, fakeResult());

      const stale = store.findFresh(["강남"], 8, 30000, new Date(Date.now() + 7 * 60 * 60 * 1000));
      expect(stale).toBeNull();
    });

    it("같은 조합의 done job이 없으면 null을 반환한다", () => {
      expect(store.findFresh(["강남"], 8, 30000, new Date())).toBeNull();
    });

    it("status가 done이 아니면(pending/running/error) 캐시로 잡히지 않는다", () => {
      const job = store.create(["강남"], 8, 30000);
      store.markRunning(job.id);
      expect(store.findFresh(["강남"], 8, 30000, new Date())).toBeNull();
    });

    it("지역 순서가 다르면 다른 조합으로 취급해 캐시로 잡히지 않는다", () => {
      const job = store.create(["강남", "홍대"], 8, 30000);
      store.markDone(job.id, fakeResult());
      expect(store.findFresh(["홍대", "강남"], 8, 30000, new Date())).toBeNull();
    });
  });

  describe("findActive", () => {
    it("같은 조합으로 pending 상태 job이 있으면 반환한다", () => {
      const job = store.create(["강남"], 8, 30000);
      expect(store.findActive(["강남"], 8, 30000)?.id).toBe(job.id);
    });

    it("같은 조합으로 running 상태 job이 있으면 반환한다", () => {
      const job = store.create(["강남"], 8, 30000);
      store.markRunning(job.id);
      expect(store.findActive(["강남"], 8, 30000)?.id).toBe(job.id);
    });

    it("done이나 error 상태면 진행 중으로 잡히지 않는다", () => {
      const job = store.create(["강남"], 8, 30000);
      store.markDone(job.id, fakeResult());
      expect(store.findActive(["강남"], 8, 30000)).toBeNull();
    });

    it("같은 조합의 job이 아예 없으면 null을 반환한다", () => {
      expect(store.findActive(["강남"], 8, 30000)).toBeNull();
    });
  });
});
