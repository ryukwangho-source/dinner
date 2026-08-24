import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVenueJobStore, type VenueJobStore } from "@/services/venue-job-store";

let store: VenueJobStore;

vi.mock("@/services/venue-job-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/venue-job-store")>();
  return { ...actual, getVenueJobStore: () => store };
});

const { POST: generateVenuesRoute } = await import("../route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/venues/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  store = createVenueJobStore(":memory:");
  // 최초 요청 테스트는 실제 fire-and-forget 백그라운드 생성을 트리거한다 —
  // fixture 모드로 돌려 실제 웹검색·토큰 비용·비결정성을 피한다.
  process.env.GENERATE_FIXTURE = "1";
});

afterEach(() => {
  delete process.env.GENERATE_FIXTURE;
});

describe("/api/venues/generate", () => {
  it("최초 요청 → 202와 jobId가 반환된다", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ regions: ["강남"], partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
  });

  it("6시간 이내 캐시된 done job이 있으면 새로 만들지 않고 즉시 그 결과가 fromCache:true로 반환된다", async () => {
    const cached = store.create(["강남"], 8, 30000);
    store.markDone(cached.id, []);

    const res = await generateVenuesRoute(
      jsonRequest({ regions: ["강남"], partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe(cached.id);
    expect(body.status).toBe("done");
    expect(body.fromCache).toBe(true);
  });

  it("force:true면 캐시된 done job이 있어도 새 job을 만들어 fromCache:false로 반환한다", async () => {
    const cached = store.create(["강남"], 8, 30000);
    store.markDone(cached.id, []);

    const res = await generateVenuesRoute(
      jsonRequest({ regions: ["강남"], partySize: 8, budgetPerPerson: 30000, force: true }),
    );
    const body = await res.json();
    expect(body.jobId).not.toBe(cached.id);
    expect(body.fromCache).toBe(false);
  });

  it("같은 조합으로 진행 중인 job이 있으면 새 job을 만들지 않고 기존 jobId를 반환한다", async () => {
    const existing = store.create(["강남"], 8, 30000);

    const res = await generateVenuesRoute(
      jsonRequest({ regions: ["강남"], partySize: 8, budgetPerPerson: 30000 }),
    );
    const body = await res.json();
    expect(body.jobId).toBe(existing.id);
  });

  it("지역을 하나도 입력하지 않으면 400", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ regions: [], partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(400);
  });

  it("지역이 5개를 초과하면 400", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({
        regions: ["강남", "홍대", "동탄역", "판교역", "수원역", "여의도"],
        partySize: 8,
        budgetPerPerson: 30000,
      }),
    );
    expect(res.status).toBe(400);
  });

  it("partySize 누락 → 400", async () => {
    const res = await generateVenuesRoute(jsonRequest({ regions: ["강남"], budgetPerPerson: 30000 }));
    expect(res.status).toBe(400);
  });
});

describe("/api/venues/generate — mode: manual (1차 장소 직접 입력)", () => {
  it("최초 요청 → 202와 jobId가 반환된다", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ mode: "manual", place: "브리비트 강남역점", partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
  });

  it("6시간 이내 캐시된 done job이 있으면 새로 만들지 않고 즉시 fromCache:true로 반환된다", async () => {
    const cached = store.create(["브리비트 강남역점"], 8, 30000, "manual");
    store.markDone(cached.id, []);

    const res = await generateVenuesRoute(
      jsonRequest({ mode: "manual", place: "브리비트 강남역점", partySize: 8, budgetPerPerson: 30000 }),
    );
    const body = await res.json();
    expect(body.jobId).toBe(cached.id);
    expect(body.fromCache).toBe(true);
  });

  it("같은 장소명이라도 region 모드로 만든 캐시는 재사용하지 않는다 (mode로 캐시 분리)", async () => {
    const regionCached = store.create(["브리비트 강남역점"], 8, 30000, "region");
    store.markDone(regionCached.id, []);

    const res = await generateVenuesRoute(
      jsonRequest({ mode: "manual", place: "브리비트 강남역점", partySize: 8, budgetPerPerson: 30000 }),
    );
    const body = await res.json();
    expect(body.jobId).not.toBe(regionCached.id);
    expect(body.fromCache).toBe(false);
  });

  it("place가 비어있으면 400", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ mode: "manual", place: "", partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(400);
  });

  it("place가 100자를 초과하면 400", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ mode: "manual", place: "가".repeat(101), partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(400);
  });

  it("partySize 누락 → 400", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ mode: "manual", place: "브리비트 강남역점", budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(400);
  });

  it("6시간이 지난 뒤 같은 manual 조합으로 재요청하면 캐시를 쓰지 않고 새 job이 만들어진다", async () => {
    vi.useFakeTimers();
    try {
      const stale = store.create(["브리비트 강남역점"], 8, 30000, "manual");
      store.markDone(stale.id, []);

      vi.advanceTimersByTime(7 * 60 * 60 * 1000); // 6시간 TTL을 넘긴다

      const res = await generateVenuesRoute(
        jsonRequest({ mode: "manual", place: "브리비트 강남역점", partySize: 8, budgetPerPerson: 30000 }),
      );
      const body = await res.json();
      expect(body.jobId).not.toBe(stale.id);
      expect(body.fromCache).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("GET으로 완료된 manual job을 조회하면 result[0].region에 입력한 장소명이 담긴다", async () => {
    const job = store.create(["브리비트 강남역점"], 8, 30000, "manual");
    store.markDone(job.id, [
      { region: "브리비트 강남역점", courseOne: [], courseTwo: [] },
    ]);

    const { GET } = await import("../[jobId]/route");
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ jobId: job.id }),
    });
    const body = await res.json();
    expect(body.result[0].region).toBe("브리비트 강남역점");
  });
});
