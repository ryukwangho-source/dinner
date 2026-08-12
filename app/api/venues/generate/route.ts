import { z } from "zod";
import { REGIONS } from "@/config/venues";
import { startGeneration } from "@/services/venue-generation-runner";

const generateBodySchema = z.object({
  region: z.string().refine((v) => REGIONS.includes(v), { message: "지원하지 않는 지역입니다" }),
  partySize: z.coerce.number().int().positive(),
  budgetPerPerson: z.coerce.number().positive(),
});

/**
 * 생성 시작 — 즉시 jobId 반환, 서버가 백그라운드로 생성한다.
 * 클라이언트는 jobId로 GET /api/venues/generate/[jobId]를 폴링한다.
 * 캐시된 완료 결과나 진행 중인 job이 있으면 새로 만들지 않고 그대로 반환한다(startGeneration 내부).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const parsed = generateBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const { region, partySize, budgetPerPerson } = parsed.data;
  const job = startGeneration(region, partySize, budgetPerPerson);
  return Response.json(
    { jobId: job.id, status: job.status },
    { status: job.status === "done" ? 200 : 202 },
  );
}
