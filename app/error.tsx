"use client";

import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangleIcon />
          </EmptyMedia>
          <EmptyTitle>문제가 발생했어요</EmptyTitle>
          <EmptyDescription>
            페이지를 처리하는 중에 오류가 났어요. 다시 시도해보시거나 홈으로 돌아가주세요.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>다시 시도</Button>
          <Button variant="outline" asChild>
            <Link href="/">홈으로</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
