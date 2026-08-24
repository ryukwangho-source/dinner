"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationStatus } from "@/components/venue/generation-status";
import { ResultList } from "@/components/venue/result-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RegionRecommendation } from "@/types/recommendation";
import type { VoteSummary } from "@/types/vote";

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "confirmCache"; jobId: string }
  | {
      kind: "done";
      results: RegionRecommendation[];
      usage: GenerationUsage | null;
      durationMs: number | null;
    };

const POLL_MS = 3000;

export type VenueResultsFlowProps = (
  | { mode?: "region"; regions: string[] }
  | { mode: "manual"; place: string }
) & {
  partySize: number;
  budgetPerPerson: number;
  votes: VoteSummary[];
};

/**
 * 결과 화면 흐름: 생성 시작 → 폴링(로딩) → 완료/실패.
 * 화면 이탈·새로고침 후 재진입해도 서버의 기존 job을 그대로 이어 폴링한다.
 * 서버가 6시간 이내 캐시된 결과를 곧바로 돌려주면(fromCache) 그 결과를 바로 보여주지 않고
 * 사용자에게 재검색 여부를 먼저 물어본다.
 * mode="manual"이면 1차 장소 직접 입력 흐름 — regions 대신 place 하나를 쓰고, ResultList에는
 * 그 장소명을 담은 단일 원소 배열([place])을 그대로 넘겨 컴포넌트 변경 없이 그룹 제목으로 쓴다.
 */
export function VenueResultsFlow(props: VenueResultsFlowProps) {
  const { partySize, budgetPerPerson, votes } = props;
  const regions = props.mode === "manual" ? [props.place] : props.regions;
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingJobId = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const poll = useCallback(async function poll(jobId: string) {
    pollingJobId.current = jobId;
    let res: Response;
    try {
      res = await fetch(`/api/venues/generate/${jobId}`);
    } catch {
      timer.current = setTimeout(() => poll(jobId), POLL_MS);
      return;
    }
    if (!res.ok) {
      timer.current = setTimeout(() => poll(jobId), POLL_MS);
      return;
    }
    const data = await res.json();
    if (data.status === "done") {
      pollingJobId.current = null;
      setPhase({
        kind: "done",
        results: data.result ?? [],
        usage: data.usage ?? null,
        durationMs: data.durationMs ?? null,
      });
    } else if (data.status === "error") {
      pollingJobId.current = null;
      setPhase({ kind: "error" });
    } else {
      timer.current = setTimeout(() => poll(jobId), POLL_MS);
    }
  }, []);

  const requestGeneration = useCallback(
    async function requestGeneration(force: boolean) {
      const body: Record<string, unknown> =
        props.mode === "manual"
          ? { mode: "manual", place: props.place, partySize, budgetPerPerson, force }
          : { regions: props.regions, partySize, budgetPerPerson, force };
      const res = await fetch("/api/venues/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`generate failed: ${res.status}`);
      return (await res.json()) as { jobId: string; status: string; fromCache: boolean };
    },
    [props, partySize, budgetPerPerson],
  );

  const start = useCallback(
    async function start() {
      setPhase({ kind: "loading" });
      try {
        const { jobId, fromCache } = await requestGeneration(false);
        if (fromCache) {
          setPhase({ kind: "confirmCache", jobId });
        } else {
          poll(jobId);
        }
      } catch {
        setPhase({ kind: "error" });
      }
    },
    [requestGeneration, poll],
  );

  const showCachedResult = useCallback(
    async function showCachedResult(jobId: string) {
      setPhase({ kind: "loading" });
      poll(jobId);
    },
    [poll],
  );

  const searchAgain = useCallback(
    async function searchAgain() {
      setPhase({ kind: "loading" });
      try {
        const { jobId } = await requestGeneration(true);
        poll(jobId);
      } catch {
        setPhase({ kind: "error" });
      }
    },
    [requestGeneration, poll],
  );

  useEffect(() => {
    // 진입 시 생성 시작 — 서버가 캐시·진행 중 작업을 우선 재사용하므로 재진입해도 중복 생성되지 않는다.
    start();
    return stopPolling;
  }, [start, stopPolling]);

  useEffect(() => {
    // 브라우저가 백그라운드 탭의 setTimeout을 늦추거나 멈추는 경우가 있어, 대기 중이던
    // 결과가 나와도 탭을 다시 볼 때까지 화면이 안 바뀔 수 있다. 탭이 다시 보이는 순간
    // 다음 폴링 주기를 기다리지 않고 즉시 한 번 확인한다.
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (!pollingJobId.current) return;
      stopPolling();
      poll(pollingJobId.current);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [poll, stopPolling]);

  switch (phase.kind) {
    case "loading":
      return <GenerationStatus state="loading" />;
    case "error":
      return <GenerationStatus state="error" onRetry={start} />;
    case "confirmCache":
      return (
        <>
          <GenerationStatus state="loading" />
          <AlertDialog open>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>이전에 검색한 결과가 있어요</AlertDialogTitle>
                <AlertDialogDescription>
                  같은 조건으로 최근에 검색한 결과가 있어요. 다시 검색할까요?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction
                  onClick={() => showCachedResult(phase.jobId)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  기존 결과 보기
                </AlertDialogAction>
                <AlertDialogAction onClick={searchAgain}>다시 검색</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    case "done":
      return (
        <ResultList
          regions={regions}
          partySize={partySize}
          budgetPerPerson={budgetPerPerson}
          results={phase.results}
          votes={votes}
          usage={phase.usage}
          durationMs={phase.durationMs}
        />
      );
  }
}
