import { getVoteStore } from "@/services/vote-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deviceId = new URL(request.url).searchParams.get("device") ?? "";

  const detail = getVoteStore().get(id, deviceId);
  if (!detail) {
    return Response.json({ error: "투표를 찾을 수 없습니다" }, { status: 404 });
  }
  return Response.json(detail);
}
