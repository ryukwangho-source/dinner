import { redirect } from "next/navigation";
import { z } from "zod";
import { venueSchema } from "@/types/recommendation";
import { CreateVoteForm } from "@/components/vote/create-vote-form";

type Props = {
  searchParams: Promise<{ venues?: string }>;
};

const venuesQuerySchema = z.array(venueSchema);

export default async function VoteNewPage({ searchParams }: Props) {
  const { venues } = await searchParams;

  let candidates: z.infer<typeof venuesQuerySchema> = [];
  try {
    candidates = venuesQuerySchema.parse(JSON.parse(venues ?? "[]"));
  } catch {
    candidates = [];
  }

  if (candidates.length === 0) {
    redirect("/");
  }

  return <CreateVoteForm candidates={candidates} />;
}
