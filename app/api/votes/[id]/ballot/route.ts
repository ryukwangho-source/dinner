import { z } from "zod";
import { getVoteStore } from "@/services/vote-store";

type RouteContext = { params: Promise<{ id: string }> };

const ballotBodySchema = z.object({
  deviceId: z.string().min(1).max(200),
  // 투표 후보는 결과 화면 5곳 중 일부라 20이면 넉넉하다 — 무제한 배열로 저장 공간을 낭비하지 않는다
  selectedCandidateIds: z.array(z.string()).min(1).max(20),
});

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "투표할 장소를 선택해주세요" }, { status: 400 });
  }

  const parsed = ballotBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "투표할 장소를 선택해주세요" }, { status: 400 });
  }

  const result = getVoteStore().submitBallot(
    id,
    parsed.data.deviceId,
    parsed.data.selectedCandidateIds,
  );

  if (result === "not-found") {
    return Response.json({ error: "투표를 찾을 수 없습니다" }, { status: 404 });
  }
  if (result === "closed") {
    return Response.json({ error: "투표가 마감되었어요" }, { status: 409 });
  }
  return Response.json({ ok: true });
}
