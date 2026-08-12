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
      { id: "cand-a", venueId: "a", name: "숯불향 오산역점", pricePerPerson: 28000, voteCount: 0 },
      { id: "cand-b", venueId: "b", name: "이자카야 온기 오산", pricePerPerson: 29500, voteCount: 0 },
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
    expect(screen.getAllByText("0표")).toHaveLength(2);
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
        { id: "cand-a", venueId: "a", name: "A", pricePerPerson: 20000, voteCount: 1 },
        { id: "cand-b", venueId: "b", name: "B", pricePerPerson: 21000, voteCount: 1 },
        { id: "cand-c", venueId: "c", name: "C", pricePerPerson: 22000, voteCount: 0 },
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

  it("존재하지 않는 투표 id면 찾을 수 없다는 안내가 표시된다", async () => {
    mockServer("404");
    render(<VoteView voteId="no-such-id" />);
    expect(await screen.findByText("투표를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("5초 경과마다 상세 조회를 다시 호출한다 (실시간 갱신 폴링)", async () => {
    mockServer();
    render(<VoteView voteId="vote-1" />);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
