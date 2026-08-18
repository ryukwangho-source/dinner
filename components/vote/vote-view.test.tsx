import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoteView } from "@/components/vote/vote-view";
import type { VoteDetail } from "@/types/vote";

vi.mock("@/lib/device-id", () => ({
  getDeviceId: () => "device-1",
}));

function baseDetail(): VoteDetail {
  return {
    id: "vote-1",
    deadlineAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    isClosed: false,
    candidates: [
      { id: "cand-a", venueId: "a", name: "숯불향 오산역점", region: "오산역", rating: 4.6, reviewCount: 1204, viewCount: 8900, pricePerPerson: 28000, voteCount: 0 },
      { id: "cand-b", venueId: "b", name: "이자카야 온기 오산", region: "오산역", rating: 4.3, reviewCount: 615, viewCount: 3800, pricePerPerson: 29500, voteCount: 0 },
    ],
    mySelection: [],
  };
}

/** GET은 항상 현재 state.detail을, POST(ballot)은 state.detail을 갱신 후 성공 응답을 준다 — 실제 서버처럼 동작. */
function mockServer(initial: VoteDetail | "404" = baseDetail()) {
  const state = { detail: initial === "404" ? null : initial };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/ballot")) {
        const body = JSON.parse(init!.body as string) as { selectedCandidateIds: string[] };
        if (state.detail) {
          // 실제 스토어의 upsert 규칙을 흉내낸다: 이 기기의 이전 선택은 전부 빼고, 새 선택만 더한다.
          const prevSelection = new Set(state.detail.mySelection);
          const newSelection = new Set(body.selectedCandidateIds);
          state.detail = {
            ...state.detail,
            mySelection: body.selectedCandidateIds,
            candidates: state.detail.candidates.map((c) => {
              let voteCount = c.voteCount;
              if (prevSelection.has(c.id) && !newSelection.has(c.id)) voteCount -= 1;
              if (!prevSelection.has(c.id) && newSelection.has(c.id)) voteCount += 1;
              return { ...c, voteCount };
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      if (!state.detail) {
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => state.detail } as Response;
    }),
  );
  return state;
}

describe("VoteView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("투표 링크 접속 → 후보 목록과 각 후보의 현재 득표수가 표시된다", async () => {
    mockServer();
    render(<VoteView voteId="vote-1" />);
    expect(await screen.findByText("숯불향 오산역점")).toBeInTheDocument();
    expect(screen.getByText("이자카야 온기 오산")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "네이버 지도에서 보기" })).toHaveLength(2);
    expect(screen.getAllByText("0표")).toHaveLength(2);
  });

  it("각 후보에 평점·리뷰수·조회수가 표시된다", async () => {
    mockServer();
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");

    expect(screen.getByText("★ 4.6")).toBeInTheDocument();
    expect(screen.getByText(/리뷰 1,204/)).toBeInTheDocument();
    expect(screen.getByText(/조회 8.9k/)).toBeInTheDocument();
  });

  it("마감 전에는 남은 시간과 함께 마감 절대 시각도 표시된다", async () => {
    const detail = {
      ...baseDetail(),
      deadlineAt: new Date(2026, 7, 13, 21, 0, 0).toISOString(),
    };
    mockServer(detail);
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");

    expect(screen.getByText("8월 13일 21:00 마감")).toBeInTheDocument();
  });

  it("후보 2곳 체크 후 투표하기 클릭 → 그 2곳의 득표수가 반영된다", async () => {
    mockServer();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");

    await user.click(screen.getByRole("checkbox", { name: "숯불향 오산역점 선택" }));
    await user.click(screen.getByRole("checkbox", { name: "이자카야 온기 오산 선택" }));
    await user.click(screen.getByRole("button", { name: "투표하기" }));

    expect(await screen.findAllByText("1표")).toHaveLength(2);
  });

  it("제출 후 버튼이 투표 변경으로 바뀌고 이미 투표했다는 안내가 나타난다", async () => {
    mockServer();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");
    await user.click(screen.getByRole("checkbox", { name: "숯불향 오산역점 선택" }));
    await user.click(screen.getByRole("button", { name: "투표하기" }));

    expect(await screen.findByRole("button", { name: "투표 변경" })).toBeInTheDocument();
    expect(screen.getByText("이미 투표했어요 · 마감 전까지 바꿀 수 있어요")).toBeInTheDocument();
  });

  it("이미 투표한 기기로 재접속하면 직전 선택이 체크된 채 표시되고 버튼은 투표 변경이다", async () => {
    mockServer({ ...baseDetail(), mySelection: ["cand-a"] });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");

    expect(screen.getByRole("checkbox", { name: "숯불향 오산역점 선택" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "이자카야 온기 오산 선택" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "투표 변경" })).toBeInTheDocument();
  });

  it("체크를 B 해제·C 추가 후 투표 변경 클릭 → B -1, C +1, A는 변화 없음", async () => {
    const detail: VoteDetail = {
      id: "vote-1",
      deadlineAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      isClosed: false,
      candidates: [
        { id: "cand-a", venueId: "a", name: "A", region: "오산역", rating: 4.5, reviewCount: 100, viewCount: 1000, pricePerPerson: 20000, voteCount: 1 },
        { id: "cand-b", venueId: "b", name: "B", region: "오산역", rating: 4.4, reviewCount: 90, viewCount: 900, pricePerPerson: 21000, voteCount: 1 },
        { id: "cand-c", venueId: "c", name: "C", region: "오산역", rating: 4.2, reviewCount: 50, viewCount: 500, pricePerPerson: 22000, voteCount: 0 },
      ],
      mySelection: ["cand-a", "cand-b"],
    };
    mockServer(detail);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("A");

    await user.click(screen.getByRole("checkbox", { name: "B 선택" }));
    await user.click(screen.getByRole("checkbox", { name: "C 선택" }));
    await user.click(screen.getByRole("button", { name: "투표 변경" }));

    await vi.waitFor(() => {
      const cards = document.querySelectorAll("[data-slot=card]");
      const textOf = (name: string) =>
        Array.from(cards).find((el) => el.textContent?.includes(name))?.textContent ?? "";
      expect(textOf("A")).toContain("1표");
      expect(textOf("B")).toContain("0표");
      expect(textOf("C")).toContain("1표");
    });
  });

  it("후보를 하나도 선택하지 않으면 제출 버튼이 비활성화된다", async () => {
    mockServer();
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");
    expect(screen.getByRole("button", { name: "투표하기" })).toBeDisabled();
  });

  it("마감된 투표 접속 → 체크박스·제출 버튼 없이 최종 득표수만 표시된다", async () => {
    mockServer({
      ...baseDetail(),
      isClosed: true,
      candidates: [
        { id: "cand-a", venueId: "a", name: "숯불향 오산역점", region: "오산역", rating: 4.6, reviewCount: 1204, viewCount: 8900, pricePerPerson: 28000, voteCount: 3 },
        { id: "cand-b", venueId: "b", name: "이자카야 온기 오산", region: "오산역", rating: 4.3, reviewCount: 615, viewCount: 3800, pricePerPerson: 29500, voteCount: 1 },
      ],
    });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");

    expect(screen.getByText("투표가 마감되었어요")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "투표하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "투표 변경" })).not.toBeInTheDocument();
    expect(screen.getByText("3표")).toBeInTheDocument();
    expect(screen.getByText("1표")).toBeInTheDocument();
  });

  it("마감 전 이미 투표했던 기기가 마감 후 접속해도 선택을 바꿀 UI가 없다", async () => {
    mockServer({
      ...baseDetail(),
      isClosed: true,
      mySelection: ["cand-a"],
    });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");

    expect(screen.getByText("투표가 마감되었어요")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("존재하지 않는 투표 id면 찾을 수 없다는 안내가 표시된다", async () => {
    mockServer("404");
    render(<VoteView voteId="no-such-id" />);
    expect(await screen.findByText("투표를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("5초 경과마다 상세 조회를 다시 호출해 다른 기기의 제출을 화면에 반영한다 (실시간 갱신 폴링)", async () => {
    const state = mockServer();
    render(<VoteView voteId="vote-1" />);

    expect(await screen.findAllByText("0표")).toHaveLength(2);

    // 폴링 사이 다른 기기가 제출했다고 가정 — 서버 상태를 직접 바꿔 다음 poll이 이를 읽어오는지 확인
    state.detail = {
      ...state.detail!,
      candidates: state.detail!.candidates.map((c) =>
        c.venueId === "a" ? { ...c, voteCount: 1 } : c,
      ),
    };

    await vi.advanceTimersByTimeAsync(5000);
    expect(await screen.findByText("1표")).toBeInTheDocument();
  });
});
