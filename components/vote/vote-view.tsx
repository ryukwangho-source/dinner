"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { getDeviceId } from "@/lib/device-id";
import { formatRemaining } from "@/lib/format-remaining";
import { naverMapSearchUrl } from "@/lib/venue-map-link";
import type { VoteDetail } from "@/types/vote";

const POLL_INTERVAL_MS = 5000;
const CLOCK_TICK_MS = 30000;

export interface VoteViewProps {
  voteId: string;
}

export function VoteView({ voteId }: VoteViewProps) {
  const [detail, setDetail] = useState<VoteDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const hasInitializedSelection = useRef(false);

  const fetchDetail = useCallback(async () => {
    const deviceId = getDeviceId();
    const res = await fetch(`/api/votes/${voteId}?device=${encodeURIComponent(deviceId)}`);
    if (res.status === 404) {
      setNotFound(true);
      return;
    }
    const data = (await res.json()) as VoteDetail;
    setDetail(data);
  }, [voteId]);

  useEffect(() => {
    // 초기 로드 + 5초 폴링 — 외부 API(투표 서버)를 구독하는 패턴이라 setState가 불가피하다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetail();
    const interval = setInterval(fetchDetail, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // mySelection은 이 기기의 최근 제출을 그대로 반영한다 — 최초 진입 시 한 번만 체크박스에
  // 반영하고, 이후 폴링으로 detail이 갱신돼도 사용자가 편집 중인 선택을 덮어쓰지 않는다.
  useEffect(() => {
    if (detail && !hasInitializedSelection.current) {
      setSelected(new Set(detail.mySelection));
      hasInitializedSelection.current = true;
    }
  }, [detail]);

  function toggle(candidateId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  }

  async function handleSubmit() {
    if (isSubmitting || selected.size === 0) return;
    setIsSubmitting(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/votes/${voteId}/ballot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId, selectedCandidateIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("submit failed");
      await fetchDetail();
    } catch {
      toast.error("투표에 실패했어요");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-4 text-center text-sm text-muted-foreground">
        투표를 찾을 수 없어요
      </div>
    );
  }

  if (!detail) return null;

  const alreadyVoted = detail.mySelection.length > 0;
  const totalVotes = detail.candidates.reduce((sum, c) => sum + c.voteCount, 0);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="text-center">
        <div className="text-sm font-bold">회식 투표</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {detail.isClosed ? "투표가 마감되었어요" : formatRemaining(detail.deadlineAt, now)}
        </div>
        {!detail.isClosed && alreadyVoted && (
          <div className="mt-2 text-xs text-muted-foreground">
            이미 투표했어요 · 마감 전까지 바꿀 수 있어요
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {detail.candidates.map((candidate) => (
          <Card key={candidate.id}>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {!detail.isClosed && (
                  <Checkbox
                    checked={selected.has(candidate.id)}
                    onCheckedChange={(checked) => toggle(candidate.id, checked === true)}
                    aria-label={`${candidate.name} 선택`}
                  />
                )}
                <span className="flex flex-1 items-center gap-1 text-sm font-bold">
                  {candidate.name}
                  <Button variant="ghost" size="icon-xs" asChild>
                    <a
                      href={naverMapSearchUrl(candidate.name, candidate.region)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="네이버 지도에서 보기"
                    >
                      <MapPinIcon />
                    </a>
                  </Button>
                </span>
                <span className="text-xs font-bold">{candidate.voteCount}표</span>
              </div>
              <Progress value={totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0} />
            </CardContent>
          </Card>
        ))}
      </div>

      {!detail.isClosed && (
        <Button disabled={selected.size === 0 || isSubmitting} onClick={handleSubmit}>
          {alreadyVoted ? "투표 변경" : "투표하기"}
        </Button>
      )}
    </div>
  );
}
