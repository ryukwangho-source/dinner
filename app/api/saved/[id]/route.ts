import { getSavedVenueStore } from "@/services/saved-venue-store";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const removed = getSavedVenueStore().remove(id);
  if (!removed) {
    return Response.json({ error: "저장된 장소를 찾을 수 없습니다" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
