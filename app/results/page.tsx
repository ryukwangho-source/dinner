import { redirect } from "next/navigation";
import { VenueResultsFlow } from "@/components/venue/venue-results-flow";
import { MAX_REGIONS } from "@/config/venue-generation";
import { getVoteStore } from "@/services/vote-store";

type Props = {
  searchParams: Promise<{ regions?: string; place?: string; people?: string; budget?: string }>;
};

export default async function ResultsPage({ searchParams }: Props) {
  const { regions: regionsParam, place, people, budget } = await searchParams;
  const partySize = Number(people);
  const budgetPerPerson = Number(budget);
  const commonValid =
    Number.isInteger(partySize) &&
    partySize > 0 &&
    Number.isFinite(budgetPerPerson) &&
    budgetPerPerson > 0;

  if (place !== undefined) {
    const trimmedPlace = place.trim();
    if (!commonValid || trimmedPlace.length === 0) {
      redirect("/");
    }
    const votes = getVoteStore().listAll();
    return (
      <VenueResultsFlow
        mode="manual"
        place={trimmedPlace}
        partySize={partySize}
        budgetPerPerson={budgetPerPerson}
        votes={votes}
      />
    );
  }

  const regions = (regionsParam ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  const isValid = regions.length > 0 && regions.length <= MAX_REGIONS && commonValid;

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
