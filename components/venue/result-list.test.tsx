import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultList } from "@/components/venue/result-list";
import type { RankedVenue } from "@/types/recommendation";

function makeVenue(id: string, price: number, overrides: Partial<RankedVenue["venue"]> = {}) {
  return {
    id,
    name: `장소-${id}`,
    category: "고깃집",
    region: "강남역",
    rating: 4.5,
    reviewCount: 100,
    viewCount: 1000,
    pricePerPerson: price,
    ...overrides,
  };
}

const fiveResults: RankedVenue[] = [
  { venue: makeVenue("a", 28000), withinBudget: true },
  { venue: makeVenue("b", 29500), withinBudget: true },
  { venue: makeVenue("c", 27000), withinBudget: true },
  { venue: makeVenue("d", 42000), withinBudget: false },
  { venue: makeVenue("e", 22000), withinBudget: true },
];

describe("ResultList", () => {
  it("카드가 결과 개수만큼 렌더된다", () => {
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  it("예산 이내 후보가 0곳이면 안내 배너가 나타난다", () => {
    const overOnly: RankedVenue[] = fiveResults.map((r) => ({ ...r, withinBudget: false }));
    render(
      <ResultList region="판교역" partySize={6} budgetPerPerson={15000} results={overOnly} />,
    );
    expect(
      screen.getByText("예산에 맞는 장소가 없어 가까운 순으로 보여드려요"),
    ).toBeInTheDocument();
  });

  it("예산 이내 후보가 있으면 안내 배너가 없다", () => {
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    expect(
      screen.queryByText("예산에 맞는 장소가 없어 가까운 순으로 보여드려요"),
    ).not.toBeInTheDocument();
  });

  it("카드 체크박스를 클릭하면 선택 개수가 서버 왕복 없이 즉시 갱신된다", async () => {
    const user = userEvent.setup();
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    expect(screen.getByText("0곳 선택됨")).toBeInTheDocument();
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1곳 선택됨")).toBeInTheDocument();
  });
});
