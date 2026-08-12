import { z } from "zod";
import { getVenuesByIds } from "@/config/venues";
import { getVoteStore } from "@/services/vote-store";

const createVoteBodySchema = z
  .object({
    venueIds: z.array(z.string()).min(1),
    duration: z.enum(["30m", "1h", "3h", "tomorrow", "custom"]),
    // 최대 7일 — 무제한 제한시간으로 투표가 영구히 열려 있는 상황을 막는다.
    customMinutes: z
      .number()
      .int()
      .positive()
      .max(7 * 24 * 60)
      .optional(),
  })
  .refine((data) => data.duration !== "custom" || typeof data.customMinutes === "number", {
    message: "제한시간을 입력해주세요",
    path: ["customMinutes"],
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

  const uniqueVenueIds = Array.from(new Set(parsed.data.venueIds));
  const candidates = getVenuesByIds(uniqueVenueIds);
  if (candidates.length === 0 || candidates.length !== uniqueVenueIds.length) {
    return Response.json({ error: "투표할 장소를 선택해주세요" }, { status: 400 });
  }

  const vote = getVoteStore().create(candidates, parsed.data.duration, undefined, parsed.data.customMinutes);
  return Response.json(vote, { status: 201 });
}
