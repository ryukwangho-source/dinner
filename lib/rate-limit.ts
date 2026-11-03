/**
 * 비밀번호 시도 횟수 제한.
 *
 * Funnel 로 공개된 뒤에는 /api/unlock 이 인터넷 전체에 열린 유일한 문이라,
 * 제한이 없으면 비밀번호를 무한히 대입할 수 있다. 상시 구동 단일 프로세스라
 * 메모리 카운터로 충분하다 (재시작하면 초기화되는 건 감수).
 */
type Attempt = { count: number; firstAt: number };

const attempts = new Map<string, Attempt>();

export const MAX_ATTEMPTS = 10;
export const WINDOW_MS = 10 * 60 * 1000;

/**
 * 프록시를 거쳐 오므로 x-forwarded-for 우선 (Funnel·Serve 가 채운다).
 *
 * **마지막** 주소를 쓴다(2026-11-04) — 프록시는 실제 접속 IP를 헤더 끝에 덧붙이고, 앞쪽 값은
 * 클라이언트가 마음대로 넣을 수 있다. 첫 값을 쓰면 요청마다 가짜 IP를 넣어 시도 제한을 무한히
 * 우회할 수 있었다(같은 PC의 invest·travel 앱에서 실측으로 확인한 구멍).
 */
export function clientKey(request: Request): string {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded.at(-1) || request.headers.get("x-real-ip") || "unknown";
}

/**
 * 시도 1회를 기록하고 남은 허용량을 돌려준다.
 * allowed=false 면 호출 측이 429 로 막는다.
 */
export function recordAttempt(
  key: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const cur = attempts.get(key);

  if (!cur || now - cur.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  cur.count += 1;
  if (cur.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((cur.firstAt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** 성공하면 카운터를 비운다 — 정상 사용자가 다음에 오타를 내도 여유가 있도록 */
export function clearAttempts(key: string): void {
  attempts.delete(key);
}

/** 테스트 격리용 */
export function resetAllAttempts(): void {
  attempts.clear();
}
