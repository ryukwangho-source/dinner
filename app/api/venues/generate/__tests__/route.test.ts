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
      jsonRequest({ region: "강남", partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
  });

  it("6시간 이내 캐시된 done job이 있으면 새로 만들지 않고 즉시 그 결과가 반환된다", async () => {
    const cached = store.create("강남", 8, 30000);
    store.markDone(cached.id, []);

    const res = await generateVenuesRoute(
      jsonRequest({ region: "강남", partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe(cached.id);
    expect(body.status).toBe("done");
  });

  it("같은 조합으로 진행 중인 job이 있으면 새 job을 만들지 않고 기존 jobId를 반환한다", async () => {
    const existing = store.create("강남", 8, 30000);

    const res = await generateVenuesRoute(
      jsonRequest({ region: "강남", partySize: 8, budgetPerPerson: 30000 }),
    );
    const body = await res.json();
    expect(body.jobId).toBe(existing.id);
  });

  it("지원하지 않는 지역 → 400", async () => {
    const res = await generateVenuesRoute(
      jsonRequest({ region: "존재하지않는지역", partySize: 8, budgetPerPerson: 30000 }),
    );
    expect(res.status).toBe(400);
  });

  it("partySize 누락 → 400", async () => {
    const res = await generateVenuesRoute(jsonRequest({ region: "강남", budgetPerPerson: 30000 }));
    expect(res.status).toBe(400);
  });
});
