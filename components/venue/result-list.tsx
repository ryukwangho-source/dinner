"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VenueCard } from "@/components/venue/venue-card";
import { ActiveVotesList } from "@/components/vote/active-votes-list";
import { shareVenues } from "@/lib/venue-share";
import type { RegionRecommendation } from "@/types/recommendation";
import type { VoteSummary } from "@/types/vote";

export interface ResultListProps {
  regions: string[];
  partySize: number;
  budgetPerPerson: number;
  results: RegionRecommendation[];
  votes: VoteSummary[];
}

export function ResultList({
  regions,
  partySize,
  budgetPerPerson,
  results,
  votes,
}: ResultListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const allRanked = results.flatMap((r) => [...r.courseOne, ...r.courseTwo]);
  const noneWithinBudget = allRanked.length > 0 && allRanked.every((r) => !r.withinBudget);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
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

      {noneWithinBudget && (
        <Alert>
          <AlertDescription>
            예산에 맞는 장소가 없어 가까운 순으로 보여드려요
          </AlertDescription>
        </Alert>
      )}

      {results.map(({ region, courseOne, courseTwo }) => (
        <div key={region} className="flex flex-col gap-3">
          <h2 className="text-sm font-bold">{region}</h2>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">1차 · 식사</h3>
            {courseOne.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
                {courseOne.map(({ venue, withinBudget }) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    withinBudget={withinBudget}
                    checked={selected.has(venue.id)}
                    onCheckedChange={(checked) => toggle(venue.id, checked)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">추천할 곳을 찾지 못했어요</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">2차 · 가볍게 한잔</h3>
            {courseTwo.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
                {courseTwo.map(({ venue, withinBudget }) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    withinBudget={withinBudget}
                    checked={selected.has(venue.id)}
                    onCheckedChange={(checked) => toggle(venue.id, checked)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">추천할 곳을 찾지 못했어요</p>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 rounded-lg border p-3 @md:flex-row">
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
