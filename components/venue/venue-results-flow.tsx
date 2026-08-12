"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationStatus } from "@/components/venue/generation-status";
import { ResultList } from "@/components/venue/result-list";
import type { RankedVenue } from "@/types/recommendation";
import type { VoteSummary } from "@/types/vote";

type Phase = { kind: "loading" } | { kind: "error" } | { kind: "done"; results: RankedVenue[] };

const POLL_MS = 3000;

export interface VenueResultsFlowProps {
  region: string;
  partySize: number;
  budgetPerPerson: number;
  votes: VoteSummary[];
}

/** 결과 화면 흐름: 생성 시작 → 폴링(로딩) → 완료/실패. 화면 이탈·새로고침 후 재진입해도 서버의 기존 job을 그대로 이어 폴링한다. */
export function VenueResultsFlow({ region, partySize, budgetPerPerson, votes }: VenueResultsFlowProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const poll = useCallback(async function poll(jobId: string) {
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
      setPhase({ kind: "done", results: data.result ?? [] });
    } else if (data.status === "error") {
      setPhase({ kind: "error" });
    } else {
      timer.current = setTimeout(() => poll(jobId), POLL_MS);
    }
  }, []);

  const start = useCallback(
    async function start() {
      setPhase({ kind: "loading" });
      try {
        const res = await fetch("/api/venues/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ region, partySize, budgetPerPerson }),
        });
        if (!res.ok) throw new Error(`generate failed: ${res.status}`);
        const { jobId } = await res.json();
        poll(jobId);
      } catch {
        setPhase({ kind: "error" });
      }
    },
    [region, partySize, budgetPerPerson, poll],
  );

  useEffect(() => {
    // 진입 시 생성 시작 — 서버가 캐시·진행 중 작업을 우선 재사용하므로 재진입해도 중복 생성되지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start();
    return stopPolling;
  }, [start, stopPolling]);

  switch (phase.kind) {
    case "loading":
      return <GenerationStatus state="loading" />;
    case "error":
      return <GenerationStatus state="error" onRetry={start} />;
    case "done":
      return (
        <ResultList
          region={region}
          partySize={partySize}
          budgetPerPerson={budgetPerPerson}
          results={phase.results}
          votes={votes}
        />
      );
  }
}
