import { redirect } from "next/navigation";
import { rankVenues } from "@/lib/venue-ranking";
import { ResultList } from "@/components/venue/result-list";

type Props = {
  searchParams: Promise<{ region?: string; people?: string; budget?: string }>;
};

export default async function ResultsPage({ searchParams }: Props) {
  const { region, people, budget } = await searchParams;
  const partySize = Number(people);
  const budgetPerPerson = Number(budget);

  const isValid =
    !!region &&
    Number.isInteger(partySize) &&
    partySize > 0 &&
    Number.isFinite(budgetPerPerson) &&
    budgetPerPerson > 0;

  if (!isValid) {
    redirect("/");
  }

  const results = rankVenues(region, budgetPerPerson);

  return (
    <ResultList
      region={region}
      partySize={partySize}
      budgetPerPerson={budgetPerPerson}
      results={results}
    />
  );
}
