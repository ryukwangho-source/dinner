"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Venue } from "@/types/recommendation";

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("ko-KR");
}

export interface VenueCardProps {
  venue: Venue;
  withinBudget: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function VenueCard({ venue, withinBudget, checked, onCheckedChange }: VenueCardProps) {
  return (
    <Card>
      <CardContent className="flex gap-3">
        <Checkbox
          className="mt-1"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-label={`${venue.name} 선택`}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{venue.name}</span>
            {withinBudget ? (
              <span className="text-xs text-muted-foreground">★ {venue.rating}</span>
            ) : (
              <Badge variant="secondary">예산 초과</Badge>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {venue.category} · {venue.region}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {!withinBudget && <span>★ {venue.rating}</span>}
            <span>리뷰 {venue.reviewCount.toLocaleString("ko-KR")}</span>
            <span>·</span>
            <span>조회 {formatCount(venue.viewCount)}</span>
          </div>
          <div className="mt-1 text-xs font-bold">
            1인 {venue.pricePerPerson.toLocaleString("ko-KR")}원
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
