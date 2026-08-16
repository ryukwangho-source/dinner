"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VenueCard } from "@/components/venue/venue-card";
import { ActiveVotesList } from "@/components/vote/active-votes-list";
import { formatDurationKo } from "@/lib/format-duration";
import { shareVenues } from "@/lib/venue-share";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RegionRecommendation } from "@/types/recommendation";
import type { VoteSummary } from "@/types/vote";

export interface ResultListProps {
  regions: string[];
  partySize: number;
  budgetPerPerson: number;
  results: RegionRecommendation[];
  votes: VoteSummary[];
  usage?: GenerationUsage | null;
  durationMs?: number | null;
}

export function ResultList({
  regions,
  partySize,
  budgetPerPerson,
  results,
  votes,
  usage = null,
  durationMs = null,
}: ResultListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const allRanked = results.flatMap((r) => r.pairs.flatMap((p) => [p.courseOne, p.courseTwo]));
  const noneWithinBudget = allRanked.length > 0 && allRanked.every((r) => !r.withinBudget);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = allRanked.length > 0 && selected.size === allRanked.length;

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(allRanked.map((r) => r.venue.id)));
  }

  function selectedVenues() {
    return allRanked.filter((r) => selected.has(r.venue.id)).map((r) => r.venue);
  }

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venues: selectedVenues() }),
      });
      if (!res.ok) throw new Error("save failed");
      const saved = (await res.json()) as unknown[];
      toast.success(`${saved.length}곳을 저장했어요`);
    } catch {
      toast.error("저장에 실패했어요");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleShare() {
    const result = await shareVenues(results);
    if (result === "copied") toast.success("클립보드에 복사했어요");
    if (result === "failed") toast.error("공유에 실패했어요");
  }

  function handleCreateVote() {
    if (selected.size === 0) {
      toast.error("투표할 장소를 선택해주세요");
      return;
    }
    const venues = JSON.stringify(selectedVenues());
    router.push(`/vote/new?venues=${encodeURIComponent(venues)}`);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="text-xs text-muted-foreground">
        {regions.join(", ")} · {partySize}명 · 1인 {budgetPerPerson.toLocaleString("ko-KR")}원
      </div>

      {(durationMs !== null || usage) && (
        <div className="text-xs text-muted-foreground">
          {durationMs !== null && <span>검색 시간 {formatDurationKo(durationMs)}</span>}
          {durationMs !== null && usage && " · "}
          {usage && (
            <span>
              토큰 {usage.inputTokens.toLocaleString("ko-KR")} in /{" "}
              {usage.outputTokens.toLocaleString("ko-KR")} out
              {usage.cacheReadTokens > 0 &&
                ` (캐시 읽기 ${usage.cacheReadTokens.toLocaleString("ko-KR")})`}
              {usage.costUsd > 0 && ` · 약 $${usage.costUsd.toFixed(3)}`}
            </span>
          )}
        </div>
      )}

      {noneWithinBudget && (
        <Alert>
          <AlertDescription>
            예산에 맞는 장소가 없어 가까운 순으로 보여드려요
          </AlertDescription>
        </Alert>
      )}

      {results.map(({ region, pairs }) => (
        <div key={region} className="flex flex-col gap-3">
          <h2 className="text-sm font-bold">{region}</h2>

          {pairs.length > 0 ? (
            <div className="flex flex-col gap-4">
              {pairs.map(({ courseOne, courseTwo, walkingBetweenMinutes }, i) => (
                <div
                  key={`${courseOne.venue.id}-${courseTwo.venue.id}`}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    {i + 1}번째 코스 · 1차→2차 도보 {walkingBetweenMinutes}분
                  </span>
                  <VenueCard
                    venue={courseOne.venue}
                    withinBudget={courseOne.withinBudget}
                    checked={selected.has(courseOne.venue.id)}
                    onCheckedChange={(checked) => toggle(courseOne.venue.id, checked)}
                  />
                  <div className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
                    <span aria-hidden>↓</span>
                    <span>도보 {walkingBetweenMinutes}분</span>
                  </div>
                  <VenueCard
                    venue={courseTwo.venue}
                    withinBudget={courseTwo.withinBudget}
                    checked={selected.has(courseTwo.venue.id)}
                    onCheckedChange={(checked) => toggle(courseTwo.venue.id, checked)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">추천할 곳을 찾지 못했어요</p>
          )}
        </div>
      ))}

      <div className="flex flex-col gap-2 rounded-lg border p-3 @md:flex-row">
        <Button
          variant="ghost"
          disabled={allRanked.length === 0}
          onClick={toggleSelectAll}
        >
          {allSelected ? "전체 해제" : "전체 선택"}
        </Button>
        <span className="self-center text-xs text-muted-foreground @md:mr-auto">
          {selected.size}곳 선택됨
        </span>
        <Button
          variant="outline"
          disabled={selected.size === 0 || isSaving}
          onClick={handleSave}
        >
          선택 저장
        </Button>
        <Button variant="outline" onClick={handleShare}>
          카톡 공유
        </Button>
        <Button variant="outline" onClick={handleCreateVote}>
          투표 만들기
        </Button>
      </div>

      <ActiveVotesList votes={votes} />
    </div>
  );
}
