import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRemaining } from "@/lib/format-remaining";
import type { VoteSummary } from "@/types/vote";

export interface ActiveVotesListProps {
  votes: VoteSummary[];
}

export function ActiveVotesList({ votes }: ActiveVotesListProps) {
  if (votes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-bold text-muted-foreground">진행 중인 투표</div>
      {votes.map((vote) => (
        <Link key={vote.id} href={`/vote/${vote.id}`}>
          <Card>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">회식 투표</div>
                <div className="text-xs text-muted-foreground">
                  후보 {vote.candidateCount}곳 ·{" "}
                  {vote.status === "closed"
                    ? "종료됨"
                    : formatRemaining(vote.deadlineAt, new Date())}
                </div>
              </div>
              <Badge variant={vote.status === "open" ? "default" : "secondary"}>
                {vote.status === "open" ? "진행 중" : "마감"}
              </Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
