"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export interface GenerationStatusProps {
  state: "loading" | "error";
  onRetry?: () => void;
}

export function GenerationStatus({ state, onRetry }: GenerationStatusProps) {
  if (state === "loading") {
    return (
      <div className="mx-auto max-w-md p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner className="size-6" />
            </EmptyMedia>
            <EmptyTitle>추천 장소를 찾고 있어요</EmptyTitle>
            <EmptyDescription>
              실시간으로 평점·리뷰를 조사하는 중이라 조금 걸릴 수 있어요. 화면을 벗어나도 계속
              진행돼요.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangleIcon />
          </EmptyMedia>
          <EmptyTitle>추천 생성에 실패했어요</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry}>다시 시도</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
