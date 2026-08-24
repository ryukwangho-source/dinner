import { z } from "zod";
import { MAX_REGIONS } from "@/config/venue-generation";
import { startGeneration, startManualGeneration } from "@/services/venue-generation-runner";

const regionBodySchema = z.object({
  mode: z.literal("region"),
  regions: z
    .array(z.string().trim().min(1))
    .min(1, "지역을 입력해주세요")
    .max(MAX_REGIONS, `지역은 최대 ${MAX_REGIONS}곳까지 입력할 수 있어요`),
  partySize: z.coerce.number().int().positive(),
  budgetPerPerson: z.coerce.number().positive(),
  /** true면 6시간 캐시를 건너뛰고 무조건 새로 검색한다 ("다시 검색할까요?"에서 "다시 검색" 선택 시) */
  force: z.coerce.boolean().optional().default(false),
});

const manualBodySchema = z.object({
  mode: z.literal("manual"),
  place: z.string().trim().min(1, "1차 장소명을 입력해주세요"),
  partySize: z.coerce.number().int().positive(),
  budgetPerPerson: z.coerce.number().positive(),
  force: z.coerce.boolean().optional().default(false),
});

const generateBodySchema = z.discriminatedUnion("mode", [regionBodySchema, manualBodySchema]);

/**
 * 생성 시작 — 즉시 jobId 반환, 서버가 백그라운드로 생성한다.
 * 클라이언트는 jobId로 GET /api/venues/generate/[jobId]를 폴링한다.
 * 캐시된 완료 결과나 진행 중인 job이 있으면 새로 만들지 않고 그대로 반환한다(startGeneration/startManualGeneration 내부).
 * 응답의 fromCache가 true면 캐시를 그대로 재사용한 것 — 클라이언트가 재검색 여부를 사용자에게 물어야 한다.
 * mode 생략 시 기존 지역 기반 흐름과 동일하게 동작한다(하위 호환).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const normalized = { ...raw, mode: raw.mode ?? "region" };

  const parsed = generateBodySchema.safeParse(normalized);
  if (!parsed.success) {
    return Response.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const { job, fromCache } =
    parsed.data.mode === "manual"
      ? startManualGeneration(
          parsed.data.place,
          parsed.data.partySize,
          parsed.data.budgetPerPerson,
          parsed.data.force,
        )
      : startGeneration(
          parsed.data.regions,
          parsed.data.partySize,
          parsed.data.budgetPerPerson,
          parsed.data.force,
        );

  return Response.json(
    { jobId: job.id, status: job.status, fromCache },
    { status: job.status === "done" ? 200 : 202 },
  );
}
