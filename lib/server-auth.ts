import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 앱 비밀번호 잠금 (2026-11-04, Tailscale Funnel로 인터넷에 공개하면서 추가).
 *
 * 공개 전엔 tailnet 안에서만 열려 잠금이 없었다. 공개 후엔 아무나 장소 추천(이 PC의 Claude
 * 계정으로 돈다)·저장 목록·투표를 만들고 지울 수 있게 되므로, 친구들이 받는 투표 링크만
 * 열어두고 나머지는 비밀번호로 잠근다(경로 규칙은 lib/access-policy.ts).
 *
 * **fail-closed**: APP_PASSWORD가 없으면 잠금을 풀 방법이 없다 — 설정 누락이 조용히 무방비로
 * 열리는 것보다 낫다(같은 PC의 travel은 .env 파일명이 틀려 잠금 없이 돌고 있었다).
 */
export const UNLOCK_COOKIE = "dinner_unlock";

/** 쿠키에 담을 값 — 비밀번호 원문이 아니라 파생 토큰(쿠키가 새어도 비밀번호는 안 드러난다). */
export function unlockToken(pw: string): string {
  return createHash("sha256").update(`dinner-unlock:${pw}`).digest("hex");
}

/** 길이 노출·조기 반환이 없는 비교. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 요청 쿠키로 잠금 해제 여부를 판정한다. 비밀번호 미설정이면 항상 false. */
export function isUnlocked(request: Request, pw = process.env.APP_PASSWORD): boolean {
  if (!pw) return false;
  const cookie = request.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${UNLOCK_COOKIE}=([^;]+)`));
  if (!m) return false;
  return safeEqual(decodeURIComponent(m[1]), unlockToken(pw));
}

/**
 * 비밀번호가 맞을 때 심을 Set-Cookie 값 (httpOnly, 1년).
 * secure는 HTTPS로 들어왔을 때만 — 항상 켜면 집 LAN의 http 접속에서 쿠키가 안 실린다.
 */
export function buildUnlockCookie(pw: string, secure: boolean): string {
  const parts = [
    `${UNLOCK_COOKIE}=${encodeURIComponent(unlockToken(pw))}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 365}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** 요청이 HTTPS 경계를 거쳐 왔는지 (Funnel·Serve는 x-forwarded-proto를 붙인다). */
export function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}
