"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VenueCard } from "@/components/venue/venue-card";
import { shareVenues } from "@/lib/venue-share";
import type { RankedVenue } from "@/types/recommendation";

export interface ResultListProps {
  region: string;
  partySize: number;
  budgetPerPerson: number;
  results: RankedVenue[];
}

export function ResultList({ region, partySize, budgetPerPerson, results }: ResultListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const noneWithinBudget = results.length > 0 && results.every((r) => !r.withinBudget);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSave() {
    const venueIds = Array.from(selected);
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venueIds }),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success(`${venueIds.length}곳을 저장했어요`);
    } catch {
      toast.error("저장에 실패했어요");
    }
  }

  async function handleShare() {
    const result = await shareVenues(results);
    if (result === "copied") toast.success("클립보드에 복사했어요");
    if (result === "failed") toast.error("공유에 실패했어요");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="text-xs text-muted-foreground">
        {region} · {partySize}명 · 1인 {budgetPerPerson.toLocaleString("ko-KR")}원
      </div>

      {noneWithinBudget && (
        <Alert>
          <AlertDescription>
            예산에 맞는 장소가 없어 가까운 순으로 보여드려요
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        {results.map(({ venue, withinBudget }) => (
          <VenueCard
            key={venue.id}
            venue={venue}
            withinBudget={withinBudget}
            checked={selected.has(venue.id)}
            onCheckedChange={(checked) => toggle(venue.id, checked)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3 @md:flex-row">
        <span className="self-center text-xs text-muted-foreground @md:mr-auto">
          {selected.size}곳 선택됨
        </span>
        <Button variant="outline" disabled={selected.size === 0} onClick={handleSave}>
          선택 저장
        </Button>
        <Button variant="outline" onClick={handleShare}>
          카톡 공유
        </Button>
      </div>
    </div>
  );
}
