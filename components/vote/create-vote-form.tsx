"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copyVoteLink, shareVoteLink } from "@/lib/venue-share";
import type { Venue } from "@/types/recommendation";
import type { VoteDuration } from "@/types/vote";

const DURATION_OPTIONS: { value: VoteDuration; label: string }[] = [
  { value: "30m", label: "30분" },
  { value: "1h", label: "1시간" },
  { value: "3h", label: "3시간" },
  { value: "tomorrow", label: "내일까지" },
];

export interface CreateVoteFormProps {
  candidates: Venue[];
}

export function CreateVoteForm({ candidates }: CreateVoteFormProps) {
  const router = useRouter();
  const [duration, setDuration] = useState<VoteDuration>("1h");
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function handleConfirm() {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venueIds: candidates.map((c) => c.id), duration }),
      });
      if (!res.ok) throw new Error("create vote failed");
      const vote = (await res.json()) as { id: string };
      setShareUrl(`${window.location.origin}/vote/${vote.id}`);
    } catch {
      toast.error("투표 만들기에 실패했어요");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleShare() {
    if (!shareUrl) return;
    const result = await shareVoteLink(shareUrl);
    if (result === "copied") toast.success("클립보드에 복사했어요");
    if (result === "failed") toast.error("공유에 실패했어요");
  }

  async function handleCopy() {
    if (!shareUrl) return;
    const ok = await copyVoteLink(shareUrl);
    if (ok) toast.success("링크를 복사했어요");
    else toast.error("복사에 실패했어요");
  }

  if (shareUrl) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 text-center">
        <div className="text-sm font-bold">투표가 만들어졌어요</div>
        <div className="rounded-lg border p-2 text-xs text-muted-foreground">{shareUrl}</div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleShare}>
            카톡으로 공유
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            링크 복사
          </Button>
        </div>
        <Button variant="ghost" onClick={() => router.back()}>
          결과 화면으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="text-sm font-bold">투표 만들기</div>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="text-xs font-bold text-muted-foreground">후보</div>
          {candidates.map((venue) => (
            <div key={venue.id} className="flex items-center justify-between text-sm">
              <span>{venue.name}</span>
              <span className="text-xs text-muted-foreground">
                1인 {venue.pricePerPerson.toLocaleString("ko-KR")}원
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="text-xs font-bold">제한시간</div>
          <ToggleGroup
            type="single"
            value={duration}
            onValueChange={(value) => value && setDuration(value as VoteDuration)}
            variant="outline"
            className="grid w-full grid-cols-2"
          >
            {DURATION_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt.value} value={opt.value} aria-label={opt.label}>
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>

      <Button disabled={isCreating} onClick={handleConfirm}>
        투표 만들기 확정
      </Button>
    </div>
  );
}
