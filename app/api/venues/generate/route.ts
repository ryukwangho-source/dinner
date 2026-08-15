import { z } from "zod";
import { MAX_REGIONS } from "@/config/venue-generation";
import { startGeneration } from "@/services/venue-generation-runner";

const generateBodySchema = z.object({
  regions: z
    .array(z.string().trim().min(1))
    .min(1, "지역을 입력해주세요")
    .max(MAX_REGIONS, `지역은 최대 ${MAX_REGIONS}곳까지 입력할 수 있어요`),
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

  const { regions, partySize, budgetPerPerson } = parsed.data;
  const job = startGeneration(regions, partySize, budgetPerPerson);
  return Response.json(
    { jobId: job.id, status: job.status },
    { status: job.status === "done" ? 200 : 202 },
  );
}
