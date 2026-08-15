import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVenueJobStore, type VenueJobStore } from "@/services/venue-job-store";

let store: VenueJobStore;

vi.mock("@/services/venue-job-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/venue-job-store")>();
  return { ...actual, getVenueJobStore: () => store };
});

const { GET: getGenerationJob } = await import("../route");

function jobRequest(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

beforeEach(() => {
  store = createVenueJobStore(":memory:");
});

describe("/api/venues/generate/[jobId]", () => {
  it("완료된 job을 조회하면 200과 result가 담긴 응답이 온다", async () => {
    const job = store.create(["강남"], 8, 30000);
    store.markDone(job.id, []);

    const res = await getGenerationJob(new Request("http://localhost"), jobRequest(job.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.result).toEqual([]);
    expect(body.regions).toEqual(["강남"]);
  });

  it("실패한 job을 조회하면 error 메시지가 담긴다", async () => {
    const job = store.create(["강남"], 8, 30000);
    store.markError(job.id, "추천 생성에 실패했습니다");

    const res = await getGenerationJob(new Request("http://localhost"), jobRequest(job.id));
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("추천 생성에 실패했습니다");
  });

  it("존재하지 않는 jobId를 조회하면 404가 반환된다", async () => {
    const res = await getGenerationJob(new Request("http://localhost"), jobRequest("no-such-id"));
    expect(res.status).toBe(404);
  });
});
