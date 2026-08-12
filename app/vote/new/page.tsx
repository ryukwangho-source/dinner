import { redirect } from "next/navigation";
import { getVenuesByIds } from "@/config/venues";
import { CreateVoteForm } from "@/components/vote/create-vote-form";

type Props = {
  searchParams: Promise<{ venueIds?: string }>;
};

export default async function VoteNewPage({ searchParams }: Props) {
  const { venueIds } = await searchParams;
  const ids = venueIds ? venueIds.split(",").filter(Boolean) : [];
  const candidates = getVenuesByIds(ids);

  if (candidates.length === 0) {
    redirect("/");
  }

  return <CreateVoteForm candidates={candidates} />;
}
