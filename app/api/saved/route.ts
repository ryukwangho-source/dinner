import { z } from "zod";
import { venueSchema } from "@/types/recommendation";
import { getSavedVenueStore } from "@/services/saved-venue-store";

const saveBodySchema = z.object({
  venues: z.array(venueSchema).min(1),
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

  const uniqueById = new Map(parsed.data.venues.map((v) => [v.id, v]));
  const saved = getSavedVenueStore().saveMany(Array.from(uniqueById.values()));
  return Response.json(saved, { status: 201 });
}

export async function DELETE() {
  const count = getSavedVenueStore().removeAll();
  return Response.json({ deleted: count });
}
