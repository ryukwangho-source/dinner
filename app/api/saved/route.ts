import { z } from "zod";
import { getVenuesByIds } from "@/config/venues";
import { getSavedVenueStore } from "@/services/saved-venue-store";

const saveBodySchema = z.object({
  venueIds: z.array(z.string()).min(1),
});

export async function GET() {
  return Response.json(getSavedVenueStore().list());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "저장할 장소를 선택해주세요" }, { status: 400 });
  }

  const parsed = saveBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "저장할 장소를 선택해주세요" }, { status: 400 });
  }

  const venues = getVenuesByIds(parsed.data.venueIds);
  if (venues.length === 0) {
    return Response.json({ error: "저장할 장소를 선택해주세요" }, { status: 400 });
  }

  const saved = getSavedVenueStore().saveMany(venues);
  return Response.json(saved, { status: 201 });
}

export async function DELETE() {
  const count = getSavedVenueStore().removeAll();
  return Response.json({ deleted: count });
}
