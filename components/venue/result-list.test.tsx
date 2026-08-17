import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ResultList } from "@/components/venue/result-list";
import { shareVenues } from "@/lib/venue-share";
import type { RankedVenue, RegionRecommendation } from "@/types/recommendation";
import type { VoteSummary } from "@/types/vote";

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
    walkingMinutes: null,
    ...overrides,
  };
}

const oneRegionResults: RegionRecommendation[] = [
  {
    region: "강남역",
    courseOne: [
      { venue: makeVenue("a", 28000), withinBudget: true },
      { venue: makeVenue("b", 29500), withinBudget: true },
      { venue: makeVenue("c", 27000), withinBudget: true },
    ],
    courseTwo: [
      { venue: makeVenue("d", 42000, { category: "이자카야" }), withinBudget: false },
      { venue: makeVenue("e", 22000, { category: "호프" }), withinBudget: true },
    ],
  },
];

function allVenues(results: RegionRecommendation[]) {
  return results.flatMap((r) => [...r.courseOne, ...r.courseTwo]);
}

function renderList(
  overrides: Partial<{
    results: RegionRecommendation[];
    votes: VoteSummary[];
    regions: string[];
    partySize: number;
    budgetPerPerson: number;
    usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number; models: string[] } | null;
    durationMs: number | null;
  }> = {},
) {
  return render(
    <ResultList
      regions={overrides.regions ?? ["강남역"]}
      partySize={overrides.partySize ?? 8}
      budgetPerPerson={overrides.budgetPerPerson ?? 30000}
      results={overrides.results ?? oneRegionResults}
      votes={overrides.votes ?? []}
      usage={overrides.usage}
      durationMs={overrides.durationMs}
    />,
  );
}

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

  it("카드 2개 체크 후 선택 저장 클릭 → 선택된 venue 전체 객체로 저장 API가 호출되고 완료 토스트가 뜬다", async () => {
    const user = userEvent.setup();
    renderList();
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(screen.getByRole("button", { name: "선택 저장" }));

    const [a, b] = allVenues(oneRegionResults);
    expect(fetch).toHaveBeenCalledWith(
      "/api/saved",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ venues: [a.venue, b.venue] }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("2곳을 저장했어요");
  });

  it("1차·2차 섹션에 각 카테고리 결과 개수만큼 카드가 렌더된다", () => {
    renderList();
    expect(screen.getByText("1차 · 식사")).toBeInTheDocument();
    expect(screen.getByText("2차 · 가볍게 한잔")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  it("지역별로 지역명 헤더가 표시된다", () => {
    const twoRegions: RegionRecommendation[] = [
      oneRegionResults[0],
      { region: "홍대", courseOne: [{ venue: makeVenue("f", 20000, { region: "홍대" }), withinBudget: true }], courseTwo: [] },
    ];
    renderList({ regions: ["강남역", "홍대"], results: twoRegions });
    expect(screen.getByRole("heading", { name: "강남역" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "홍대" })).toBeInTheDocument();
  });

  it("예산 이내 후보가 0곳이면 안내 배너가 나타난다", () => {
    const overOnly: RegionRecommendation[] = [
      {
        region: "판교역",
        courseOne: oneRegionResults[0].courseOne.map((r) => ({ ...r, withinBudget: false })),
        courseTwo: oneRegionResults[0].courseTwo.map((r) => ({ ...r, withinBudget: false })),
      },
    ];
    renderList({ regions: ["판교역"], partySize: 6, budgetPerPerson: 15000, results: overOnly });
    expect(
      screen.getByText("예산에 맞는 장소가 없어 가까운 순으로 보여드려요"),
    ).toBeInTheDocument();
  });

  it("예산 이내 후보가 있으면 안내 배너가 없다", () => {
    renderList();
    expect(
      screen.queryByText("예산에 맞는 장소가 없어 가까운 순으로 보여드려요"),
    ).not.toBeInTheDocument();
  });

  it("카톡 공유 클릭 → 결과 목록으로 shareVenues를 호출하고, 클립보드 복사 결과면 완료 토스트를 띄운다", async () => {
    vi.mocked(shareVenues).mockResolvedValue("copied");
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: "카톡 공유" }));

    expect(shareVenues).toHaveBeenCalledWith(oneRegionResults);
    expect(toast.success).toHaveBeenCalledWith("클립보드에 복사했어요");
  });

  it("카톡 공유 결과가 shared이면 완료 토스트를 띄우지 않는다", async () => {
    vi.mocked(shareVenues).mockResolvedValue("shared");
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: "카톡 공유" }));

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("선택 없이는 선택 저장 버튼이 비활성화되어 저장 API가 호출되지 않는다", () => {
    renderList();
    expect(screen.getByRole("button", { name: "선택 저장" })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("선택 없이 투표 만들기 클릭 → 안내 토스트가 뜨고 이동하지 않는다", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: "투표 만들기" }));

    expect(toast.error).toHaveBeenCalledWith("투표할 장소를 선택해주세요");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("카드 선택 후 투표 만들기 클릭 → /vote/new로 선택된 venue 전체 객체와 함께 이동한다", async () => {
    const user = userEvent.setup();
    renderList();
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[2]);
    await user.click(screen.getByRole("button", { name: "투표 만들기" }));

    const [a, , c] = allVenues(oneRegionResults);
    const expectedVenues = JSON.stringify([a.venue, c.venue]);
    expect(pushMock).toHaveBeenCalledWith(`/vote/new?venues=${encodeURIComponent(expectedVenues)}`);
  });

  it("카드 체크박스를 클릭하면 선택 개수가 서버 왕복 없이 즉시 갱신된다", async () => {
    const user = userEvent.setup();
    renderList();
    expect(screen.getByText("0곳 선택됨")).toBeInTheDocument();
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1곳 선택됨")).toBeInTheDocument();
  });

  it("전체 선택 클릭 → 모든 카드가 선택되고 버튼 라벨이 전체 해제로 바뀐다", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: "전체 선택" }));

    expect(screen.getByText("5곳 선택됨")).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeChecked();
    }
    expect(screen.getByRole("button", { name: "전체 해제" })).toBeInTheDocument();
  });

  it("전체 선택 후 전체 해제 클릭 → 모든 선택이 풀린다", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getByRole("button", { name: "전체 선택" }));
    await user.click(screen.getByRole("button", { name: "전체 해제" }));

    expect(screen.getByText("0곳 선택됨")).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
  });

  it("일부만 선택된 상태에서는 전체 선택 버튼이 그대로 유지된다", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByRole("button", { name: "전체 선택" })).toBeInTheDocument();
  });

  it("durationMs가 있으면 검색 시간을 표시한다", () => {
    renderList({ durationMs: 90_000 });
    expect(screen.getByText(/검색 시간 1분 30초/)).toBeInTheDocument();
  });

  it("usage가 있으면 토큰 사용량과 비용을 표시한다", () => {
    renderList({
      usage: {
        inputTokens: 12000,
        outputTokens: 3000,
        cacheReadTokens: 500,
        cacheWriteTokens: 0,
        costUsd: 0.054,
        models: ["claude-sonnet-5"],
      },
    });
    expect(screen.getByText(/토큰 12,000 in \/ 3,000 out/)).toBeInTheDocument();
    expect(screen.getByText(/캐시 읽기 500/)).toBeInTheDocument();
    expect(screen.getByText(/약 \$0\.054/)).toBeInTheDocument();
  });

  it("usage·durationMs가 모두 없으면 아무것도 표시하지 않는다", () => {
    renderList();
    expect(screen.queryByText(/검색 시간/)).not.toBeInTheDocument();
    expect(screen.queryByText(/토큰/)).not.toBeInTheDocument();
  });

  it("카드 삭제 버튼 클릭 → 그 장소가 화면에서 사라진다", async () => {
    const user = userEvent.setup();
    renderList();
    const [a] = allVenues(oneRegionResults);
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: `${a.venue.name} 삭제` }));

    expect(screen.queryByText(a.venue.name)).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("체크된 카드를 삭제하면 선택 개수도 함께 줄어든다", async () => {
    const user = userEvent.setup();
    renderList();
    const [a] = allVenues(oneRegionResults);

    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1곳 선택됨")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `${a.venue.name} 삭제` }));
    expect(screen.getByText("0곳 선택됨")).toBeInTheDocument();
  });

  it("삭제한 장소는 카톡 공유·선택 저장 대상에서도 제외된다", async () => {
    vi.mocked(shareVenues).mockResolvedValue("copied");
    const user = userEvent.setup();
    renderList();
    const [a, b] = allVenues(oneRegionResults);

    await user.click(screen.getByRole("button", { name: `${a.venue.name} 삭제` }));
    await user.click(screen.getByRole("button", { name: "카톡 공유" }));

    const [calledResults] = vi.mocked(shareVenues).mock.calls[0];
    const remainingIds = calledResults.flatMap((r) => [...r.courseOne, ...r.courseTwo]).map((r) => r.venue.id);
    expect(remainingIds).not.toContain(a.venue.id);
    expect(remainingIds).toContain(b.venue.id);
  });

  it("진행 중인 투표 목록을 함께 렌더한다", () => {
    const votes: VoteSummary[] = [
      {
        id: "vote-1",
        candidateCount: 3,
        status: "open",
        createdAt: "2026-08-12T13:00:00.000Z",
        deadlineAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    ];
    renderList({ votes });
    expect(screen.getByRole("link", { name: /후보 3곳/ })).toHaveAttribute("href", "/vote/vote-1");
  });
});
