"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRemaining } from "@/lib/format-remaining";
import type { VoteSummary } from "@/types/vote";

export interface ActiveVotesListProps {
  votes: VoteSummary[];
}

export function ActiveVotesList({ votes: initialVotes }: ActiveVotesListProps) {
  const [votes, setVotes] = useState(initialVotes);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleDelete(id: string) {
    if (pendingIds.has(id)) return;
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/votes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setVotes((prev) => prev.filter((vote) => vote.id !== id));
    } catch {
      toast.error("투표 삭제에 실패했어요");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (votes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold text-muted-foreground">진행 중인 투표</div>
      {votes.map((vote) => (
        <Card key={vote.id}>
          <CardContent className="flex items-center justify-between gap-2">
            <Link href={`/vote/${vote.id}`} className="flex-1">
              <div className="text-sm font-bold">회식 투표</div>
              <div className="text-xs text-muted-foreground">
                후보 {vote.candidateCount}곳 ·{" "}
                {vote.status === "closed"
                  ? "종료됨"
                  : formatRemaining(vote.deadlineAt, new Date())}
              </div>
            </Link>
            <Badge variant={vote.status === "open" ? "default" : "secondary"}>
              {vote.status === "open" ? "진행 중" : "마감"}
            </Badge>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="투표 삭제"
              disabled={pendingIds.has(vote.id)}
              onClick={() => handleDelete(vote.id)}
            >
              <Trash2Icon />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
