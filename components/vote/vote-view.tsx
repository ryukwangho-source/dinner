"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { getDeviceId } from "@/lib/device-id";
import { formatRemaining } from "@/lib/format-remaining";
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
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [now, setNow] = useState(() => new Date());

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
    fetchDetail();
    const interval = setInterval(fetchDetail, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);

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
      setHasSubmitted(true);
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

  const totalVotes = detail.candidates.reduce((sum, c) => sum + c.voteCount, 0);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="text-center">
        <div className="text-sm font-bold">회식 투표</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatRemaining(detail.deadlineAt, now)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {detail.candidates.map((candidate) => (
          <Card key={candidate.id}>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {!hasSubmitted && (
                  <Checkbox
                    checked={selected.has(candidate.id)}
                    onCheckedChange={(checked) => toggle(candidate.id, checked === true)}
                    aria-label={`${candidate.name} 선택`}
                  />
                )}
                <span className="flex-1 text-sm font-bold">{candidate.name}</span>
                <span className="text-xs font-bold">{candidate.voteCount}표</span>
              </div>
              <Progress value={totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0} />
            </CardContent>
          </Card>
        ))}
      </div>

      {hasSubmitted ? (
        <div className="text-center text-sm text-muted-foreground">투표 완료</div>
      ) : (
        <Button disabled={selected.size === 0 || isSubmitting} onClick={handleSubmit}>
          투표하기
        </Button>
      )}
    </div>
  );
}
