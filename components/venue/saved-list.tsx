"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookmarkIcon, MapPinIcon } from "lucide-react";
import { formatCategoryLabel } from "@/lib/venue-category-label";
import { naverMapSearchUrl } from "@/lib/venue-map-link";
import type { SavedVenue } from "@/services/saved-venue-store";

export interface SavedListProps {
  items: SavedVenue[];
}

export function SavedList({ items: initialItems }: SavedListProps) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedRegions, setDeletedRegions] = useState<string[]>([]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  }

  async function handleDeleteSelected() {
    if (isDeleting || selected.size === 0) return;
    setIsDeleting(true);
    const removedItems = items.filter((item) => selected.has(item.id));
    try {
      if (allSelected) {
        const res = await fetch("/api/saved", { method: "DELETE" });
        if (!res.ok) throw new Error("delete all failed");
        setItems([]);
      } else {
        const ids = removedItems.map((item) => item.id);
        const results = await Promise.allSettled(
          ids.map((id) => fetch(`/api/saved/${id}`, { method: "DELETE" })),
        );
        const succeeded = new Set(
          ids.filter((_, i) => {
            const r = results[i];
            return r.status === "fulfilled" && r.value.ok;
          }),
        );
        if (succeeded.size === 0) throw new Error("delete failed");
        setItems((prev) => prev.filter((item) => !succeeded.has(item.id)));
        if (succeeded.size < ids.length) toast.error("일부 삭제에 실패했어요");
      }
      setSelected(new Set());
      setDeletedRegions(Array.from(new Set(removedItems.map((item) => item.region))));
    } catch {
      toast.error("삭제에 실패했어요");
    } finally {
      setIsDeleting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon />
            </EmptyMedia>
            <EmptyTitle>저장된 장소가 없어요</EmptyTitle>
          </EmptyHeader>
        </Empty>
        {deletedRegions.length > 0 && (
          <div className="mx-auto mt-4 flex max-w-sm flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-muted-foreground">삭제한 지역으로 다시 추천받기</span>
            {deletedRegions.map((region) => (
              <Button key={region} variant="outline" size="sm" asChild>
                <Link href={`/?region=${encodeURIComponent(region)}`}>{region}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <span className="text-sm font-bold">저장한 장소</span>

      {deletedRegions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
          <span className="text-muted-foreground">삭제한 지역으로 다시 추천받기</span>
          {deletedRegions.map((region) => (
            <Button key={region} variant="outline" size="sm" asChild>
              <Link href={`/?region=${encodeURIComponent(region)}`}>{region}</Link>
            </Button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-start gap-3">
              <Checkbox
                className="mt-1"
                checked={selected.has(item.id)}
                onCheckedChange={(value) => toggle(item.id, value === true)}
                aria-label={`${item.name} 선택`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <div data-testid="saved-item-name" className="text-sm font-bold">
                    {item.name}
                  </div>
                  <Button variant="ghost" size="icon-xs" asChild>
                    <a
                      href={naverMapSearchUrl(item.name, item.region)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="네이버 지도에서 보기"
                    >
                      <MapPinIcon />
                    </a>
                  </Button>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatCategoryLabel(item.category)} · {item.region} · ★ {item.rating}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3 @md:flex-row">
        <Button variant="ghost" onClick={toggleSelectAll}>
          {allSelected ? "전체 해제" : "전체 선택"}
        </Button>
        <span className="self-center text-xs text-muted-foreground @md:mr-auto">
          {selected.size}곳 선택됨
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={selected.size === 0 || isDeleting}>
              선택 삭제
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>선택한 {selected.size}곳을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>삭제하면 되돌릴 수 없어요.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelected} disabled={isDeleting}>
                삭제하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
