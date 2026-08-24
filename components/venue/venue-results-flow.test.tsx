import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenueResultsFlow } from "@/components/venue/venue-results-flow";
import type { VoteSummary } from "@/types/vote";

vi.mock("@/components/venue/result-list", () => ({
  ResultList: ({
    regions,
    usage,
    durationMs,
  }: {
    regions: string[];
    usage: { inputTokens: number } | null;
    durationMs: number | null;
  }) => (
    <div data-testid="result-list">
      결과: {regions.join(",")} · usage:{usage ? usage.inputTokens : "none"} · durationMs:
      {durationMs ?? "none"}
    </div>
  ),
}));

const votes: VoteSummary[] = [];

/** POST는 항상 pending job을, GET은 state.status를 반영한 폴링 응답을 준다. */
function mockServer(
  initialStatus: "pending" | "done" | "error" = "pending",
  extra: { usage?: { inputTokens: number } | null; durationMs?: number | null } = {},
) {
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
        json: async () => ({
          jobId: "job-1",
          status: state.status,
          result: state.status === "done" ? [] : null,
          usage: state.status === "done" ? (extra.usage ?? null) : null,
          durationMs: state.status === "done" ? (extra.durationMs ?? null) : null,
        }),
      } as Response;
    }),
  );
  return state;
}

/**
 * 최초 POST(force 없음)는 캐시된 done job("job-1")을 fromCache:true로 반환한다.
 * force:true로 다시 POST하면 새 job("job-2")을 pending으로 만들고, GET 폴링 한 번 뒤 done이 된다.
 */
function mockServerWithCache() {
  const state = { job2Status: "pending" as "pending" | "done" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.force) {
          return {
            ok: true,
            status: 202,
            json: async () => ({ jobId: "job-2", status: "pending", fromCache: false }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ jobId: "job-1", status: "done", fromCache: true }),
        } as Response;
      }
      if (url.endsWith("/job-1")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobId: "job-1",
            status: "done",
            result: [],
            usage: null,
            durationMs: 11_111,
          }),
        } as Response;
      }
      // job-2
      const done = state.job2Status === "done";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jobId: "job-2",
          status: done ? "done" : "pending",
          result: done ? [] : null,
          usage: null,
          durationMs: done ? 22_222 : null,
        }),
      } as Response;
    }),
  );
  return state;
}

describe("VenueResultsFlow — 캐시 재사용 확인", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("캐시된 결과가 있으면 재검색 여부를 먼저 묻는다", async () => {
    mockServerWithCache();
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    expect(await screen.findByText("이전에 검색한 결과가 있어요")).toBeInTheDocument();
    expect(screen.queryByTestId("result-list")).not.toBeInTheDocument();
  });

  it("기존 결과 보기 클릭 → 캐시된 결과를 그대로 보여준다", async () => {
    mockServerWithCache();
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
    await screen.findByText("이전에 검색한 결과가 있어요");
    await user.click(screen.getByRole("button", { name: "기존 결과 보기" }));

    expect(await screen.findByText(/durationMs:11111/)).toBeInTheDocument();
  });

  it("다시 검색 클릭 → force로 새로 검색해 새 결과를 보여준다", async () => {
    const state = mockServerWithCache();
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
    await screen.findByText("이전에 검색한 결과가 있어요");
    await user.click(screen.getByRole("button", { name: "다시 검색" }));

    expect(screen.getByText("추천 장소를 찾고 있어요")).toBeInTheDocument();
    state.job2Status = "done";
    await vi.advanceTimersByTimeAsync(3000);

    expect(await screen.findByText(/durationMs:22222/)).toBeInTheDocument();
  });
});

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

  it("완료 응답의 usage·durationMs를 결과 화면에 그대로 전달한다", async () => {
    const state = mockServer("pending", { usage: { inputTokens: 1234 }, durationMs: 45_000 });
    render(
      <VenueResultsFlow regions={["강남"]} partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    state.status = "done";
    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByText(/usage:1234/)).toBeInTheDocument();
    expect(screen.getByText(/durationMs:45000/)).toBeInTheDocument();
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

describe("VenueResultsFlow — mode: manual (1차 장소 직접 입력)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("place를 POST body에 mode:manual로 실어 보낸다", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 202,
      json: async () => ({ jobId: "job-manual", status: "pending" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(
      <VenueResultsFlow mode="manual" place="브리비트 강남역점" partySize={8} budgetPerPerson={30000} votes={votes} />,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/venues/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "manual",
          place: "브리비트 강남역점",
          partySize: 8,
          budgetPerPerson: 30000,
          force: false,
        }),
      }),
    );
  });

  it("완료되면 결과 화면에 place를 그룹 이름으로 전달한다", async () => {
    const state = mockServer("pending");
    render(
      <VenueResultsFlow mode="manual" place="브리비트 강남역점" partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    state.status = "done";
    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByText(/결과: 브리비트 강남역점/)).toBeInTheDocument();
  });

  it("생성 실패로 끝나면 실패 안내가 보인다", async () => {
    const state = mockServer("pending");
    render(
      <VenueResultsFlow mode="manual" place="존재하지않는실패장소" partySize={8} budgetPerPerson={30000} votes={votes} />,
    );
    state.status = "error";
    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByText("추천 생성에 실패했어요")).toBeInTheDocument();
  });
});
