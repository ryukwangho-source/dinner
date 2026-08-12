const KEY = "dinner-device-id";

/**
 * 이 브라우저의 기기 식별자 (best-effort — 로그인이 아니다).
 * localStorage에 없으면 1회 생성해 저장한다. SSR 환경(window 없음)에서는 빈 문자열.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
