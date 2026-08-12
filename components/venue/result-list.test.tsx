import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ResultList } from "@/components/venue/result-list";
import { shareVenues } from "@/lib/venue-share";
import type { RankedVenue } from "@/types/recommendation";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/venue-share", () => ({
  shareVenues: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "s1" }, { id: "s2" }],
      }),
    );
  });

  it("카드 2개 체크 후 선택 저장 클릭 → 선택된 venueId로 저장 API가 호출되고 완료 토스트가 뜬다", async () => {
    const user = userEvent.setup();
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: "선택 저장" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/saved",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ venueIds: ["a", "b"] }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("2곳을 저장했어요");
  });

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

  it("카톡 공유 클릭 → 결과 목록으로 shareVenues를 호출하고, 클립보드 복사 결과면 완료 토스트를 띄운다", async () => {
    vi.mocked(shareVenues).mockResolvedValue("copied");
    const user = userEvent.setup();
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    await user.click(screen.getByRole("button", { name: "카톡 공유" }));

    expect(shareVenues).toHaveBeenCalledWith(fiveResults);
    expect(toast.success).toHaveBeenCalledWith("클립보드에 복사했어요");
  });

  it("카톡 공유 결과가 shared이면 완료 토스트를 띄우지 않는다", async () => {
    vi.mocked(shareVenues).mockResolvedValue("shared");
    const user = userEvent.setup();
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    await user.click(screen.getByRole("button", { name: "카톡 공유" }));

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("선택 없이는 선택 저장 버튼이 비활성화되어 저장 API가 호출되지 않는다", () => {
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    expect(screen.getByRole("button", { name: "선택 저장" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("선택 없이 투표 만들기 클릭 → 안내 토스트가 뜨고 이동하지 않는다", async () => {
    const user = userEvent.setup();
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    await user.click(screen.getByRole("button", { name: "투표 만들기" }));

    expect(toast.error).toHaveBeenCalledWith("투표할 장소를 선택해주세요");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("카드 선택 후 투표 만들기 클릭 → /vote/new로 선택된 venueId와 함께 이동한다", async () => {
    const user = userEvent.setup();
    render(
      <ResultList region="강남역" partySize={8} budgetPerPerson={30000} results={fiveResults} />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[2]);
    await user.click(screen.getByRole("button", { name: "투표 만들기" }));

    expect(pushMock).toHaveBeenCalledWith("/vote/new?venueIds=a%2Cc");
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
