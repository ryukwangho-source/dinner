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
          state.detail = {
            ...state.detail,
            mySelection: body.selectedCandidateIds,
            candidates: state.detail.candidates.map((c) => ({
              ...c,
              voteCount: body.selectedCandidateIds.includes(c.id) ? c.voteCount + 1 : c.voteCount,
            })),
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

  it("제출 후 투표하기 버튼이 사라지고 완료 안내로 바뀐다", async () => {
    mockServer();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VoteView voteId="vote-1" />);
    await screen.findByText("숯불향 오산역점");
    await user.click(screen.getByRole("checkbox", { name: "숯불향 오산역점 선택" }));
    await user.click(screen.getByRole("button", { name: "투표하기" }));

    expect(await screen.findByText("투표 완료")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "투표하기" })).not.toBeInTheDocument();
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
