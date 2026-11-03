"use client";

import { useState } from "react";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 잠금 해제 화면 — 비밀번호가 맞으면 서버가 쿠키를 심고 원래 가려던 곳으로 보낸다. */
export function UnlockForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // 쿠키가 심어진 뒤라 새로 로드해야 middleware를 통과한다.
        window.location.href = next;
        return;
      }

      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "비밀번호가 틀렸어요");
    } catch {
      setError("연결에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <LockIcon className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-bold">저녁 장소 정하기</h1>
        <p className="text-sm text-muted-foreground">
          비밀번호를 입력하면 장소 추천과 투표 만들기를 쓸 수 있어요.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy || password.length === 0}>
          {busy ? "확인 중..." : "들어가기"}
        </Button>
      </form>
    </main>
  );
}
