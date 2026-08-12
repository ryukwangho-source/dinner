import { redirect } from "next/navigation";
import { rankVenues } from "@/lib/venue-ranking";
import { ResultList } from "@/components/venue/result-list";
import { REGIONS } from "@/config/venues";
import { getVoteStore } from "@/services/vote-store";

type Props = {
  searchParams: Promise<{ region?: string; people?: string; budget?: string }>;
};

export default async function ResultsPage({ searchParams }: Props) {
  const { region, people, budget } = await searchParams;
  const partySize = Number(people);
  const budgetPerPerson = Number(budget);

  const isValid =
    !!region &&
    REGIONS.includes(region) &&
    Number.isInteger(partySize) &&
    partySize > 0 &&
    Number.isFinite(budgetPerPerson) &&
    budgetPerPerson > 0;

  if (!isValid) {
    redirect("/");
  }

  const results = rankVenues(region, budgetPerPerson);
  const votes = getVoteStore().listAll();

  return (
    <ResultList
      region={region}
      partySize={partySize}
      budgetPerPerson={budgetPerPerson}
      results={results}
      votes={votes}
    />
  );
}
