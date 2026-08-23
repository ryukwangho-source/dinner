"use client";

import { MapPinIcon, XIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format-count";
import { formatCategoryLabel } from "@/lib/venue-category-label";
import { naverMapSearchUrl } from "@/lib/venue-map-link";
import type { Venue } from "@/types/recommendation";

export interface VenueCardProps {
  venue: Venue;
  withinBudget: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onDismiss?: () => void;
}

export function VenueCard({ venue, withinBudget, checked, onCheckedChange, onDismiss }: VenueCardProps) {
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
            <span className="flex items-center gap-1 text-sm font-bold">
              {venue.name}
              <Button variant="ghost" size="icon-xs" asChild>
                <a
                  href={naverMapSearchUrl(venue.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="네이버 지도에서 보기"
                >
                  <MapPinIcon />
                </a>
              </Button>
            </span>
            <span className="flex items-center gap-2">
              {withinBudget ? (
                <span className="text-xs text-muted-foreground">★ {venue.rating}</span>
              ) : (
                <Badge variant="secondary">예산 초과</Badge>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onDismiss}
                  aria-label={`${venue.name} 삭제`}
                >
                  <XIcon />
                </Button>
              )}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatCategoryLabel(venue.category)} · {venue.region}
            {venue.walkingMinutes != null && ` · 도보 ${venue.walkingMinutes}분`}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {!withinBudget && <span>★ {venue.rating}</span>}
            <span>리뷰 {venue.reviewCount.toLocaleString("ko-KR")}</span>
            <span>·</span>
            <span>조회 {formatCount(venue.viewCount)}</span>
          </div>
          <div className="text-[10px] text-muted-foreground/70">
            네이버 플레이스 등 웹검색 기준(정확한 값이 없으면 추정치)
          </div>
          <div className="mt-1 text-xs font-bold">
            1인 {venue.pricePerPerson.toLocaleString("ko-KR")}원
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
