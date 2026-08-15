import { redirect } from "next/navigation";
import { VenueResultsFlow } from "@/components/venue/venue-results-flow";
import { MAX_REGIONS } from "@/config/venue-generation";
import { getVoteStore } from "@/services/vote-store";

type Props = {
  searchParams: Promise<{ regions?: string; people?: string; budget?: string }>;
};

export default async function ResultsPage({ searchParams }: Props) {
  const { regions: regionsParam, people, budget } = await searchParams;
  const regions = (regionsParam ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const partySize = Number(people);
  const budgetPerPerson = Number(budget);

  const isValid =
    regions.length > 0 &&
    regions.length <= MAX_REGIONS &&
    Number.isInteger(partySize) &&
    partySize > 0 &&
    Number.isFinite(budgetPerPerson) &&
    budgetPerPerson > 0;

  if (!isValid) {
    redirect("/");
  }

  const votes = getVoteStore().listAll();

  return (
    <VenueResultsFlow
      regions={regions}
      partySize={partySize}
      budgetPerPerson={budgetPerPerson}
      votes={votes}
    />
  );
}
