"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { BookmarkIcon, Trash2Icon } from "lucide-react";
import type { SavedVenue } from "@/services/saved-venue-store";

export interface SavedListProps {
  items: SavedVenue[];
}

export function SavedList({ items: initialItems }: SavedListProps) {
  const [items, setItems] = useState(initialItems);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  async function handleDelete(id: string) {
    if (pendingIds.has(id)) return;
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/saved/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      toast.error("삭제에 실패했어요");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDeleteAll() {
    if (isDeletingAll) return;
    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/saved", { method: "DELETE" });
      if (!res.ok) throw new Error("delete all failed");
      setItems([]);
    } catch {
      toast.error("삭제에 실패했어요");
    } finally {
      setIsDeletingAll(false);
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
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">저장한 장소</span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              모두 삭제
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>저장한 장소를 모두 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                삭제하면 되돌릴 수 없어요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAll} disabled={isDeletingAll}>
                모두 삭제하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div data-testid="saved-item-name" className="text-sm font-bold">
                  {item.name}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {item.category} · {item.region}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="삭제"
                disabled={pendingIds.has(item.id)}
                onClick={() => handleDelete(item.id)}
              >
                <Trash2Icon />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
