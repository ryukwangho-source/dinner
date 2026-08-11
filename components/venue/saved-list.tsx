"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SavedVenue } from "@/services/saved-venue-store";

export interface SavedListProps {
  items: SavedVenue[];
}

export function SavedList({ items }: SavedListProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">저장한 장소</span>
        <Button variant="outline" size="sm" disabled>
          모두 삭제
        </Button>
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
              <Button variant="outline" size="icon-sm" disabled>
                삭제
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
