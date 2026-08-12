import { getVenueJobStore } from "@/services/venue-job-store";

type RouteContext = { params: Promise<{ jobId: string }> };

/** 생성 작업 상태·결과 폴링 (화면 이탈·새로고침 후 재진입해도 이어서 조회 가능) */
export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const job = getVenueJobStore().get(jobId);
  if (!job) {
    return Response.json({ error: "작업을 찾을 수 없습니다" }, { status: 404 });
  }
  return Response.json({
    jobId: job.id,
    status: job.status,
    region: job.region,
    partySize: job.partySize,
    budgetPerPerson: job.budgetPerPerson,
    result: job.result,
    error: job.error,
  });
}
