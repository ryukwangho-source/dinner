import { z } from "zod";
import { getVenuesByIds } from "@/config/venues";
import { getVoteStore } from "@/services/vote-store";

const createVoteBodySchema = z.object({
  venueIds: z.array(z.string()).min(1),
  duration: z.enum(["30m", "1h", "3h", "tomorrow"]),
});

export async function GET() {
  return Response.json(getVoteStore().listAll());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "투표할 장소를 선택해주세요" }, { status: 400 });
  }

  const parsed = createVoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "투표할 장소를 선택해주세요" }, { status: 400 });
  }

  const candidates = getVenuesByIds(parsed.data.venueIds);
  if (candidates.length === 0) {
    return Response.json({ error: "투표할 장소를 선택해주세요" }, { status: 400 });
  }

  const vote = getVoteStore().create(candidates, parsed.data.duration);
  return Response.json(vote, { status: 201 });
}
