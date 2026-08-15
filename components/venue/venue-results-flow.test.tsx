import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenueResultsFlow } from "@/components/venue/venue-results-flow";
import type { VoteSummary } from "@/types/vote";

vi.mock("@/components/venue/result-list", () => ({
  ResultList: ({ regions }: { regions: string[] }) => (
    <div data-testid="result-list">결과: {regions.join(",")}</div>
  ),
}));

const votes: VoteSummary[] = [];

/** POST는 항상 pending job을, GET은 state.status를 반영한 폴링 응답을 준다. */
function mockServer(initialStatus: "pending" | "done" | "error" = "pending") {
  const state = { status: initialStatus, calls: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: true, status: 202, json: async () => ({ jobId: "job-1", status: "pending" }) } as Response;
      }
      state.calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ jobId: "job-1", status: state.status, result: state.status === "done" ? [] : null }),
      } as Response;
    }),
  );
  return state;
}

describe("VenueResultsFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("진입 시 생성 시작 안내(로딩)가 먼저 보인다", () => {
    mockServer("pending");
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    expect(screen.getByText("추천 장소를 찾고 있어요")).toBeInTheDocument();
  });

  it("폴링 끝에 완료되면 결과 화면으로 전환된다", async () => {
    const state = mockServer("pending");
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    state.status = "done";
    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByTestId("result-list")).toBeInTheDocument();
  });

  it("생성 실패로 끝나면 실패 안내와 다시 시도 버튼이 보인다", async () => {
    const state = mockServer("pending");
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    state.status = "error";
    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByText("추천 생성에 실패했어요")).toBeInTheDocument();
  });

  it("실패 후 다시 시도 클릭 → 로딩 화면으로 돌아가고 다시 생성이 시작된다", async () => {
    const state = mockServer("error");
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    await vi.advanceTimersByTimeAsync(3000);
    await screen.findByText("추천 생성에 실패했어요");

    state.status = "pending";
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(screen.getByText("추천 장소를 찾고 있어요")).toBeInTheDocument();
  });
});
