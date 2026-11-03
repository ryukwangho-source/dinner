/**
 * 비밀번호 없이 열어두는 요청 (2026-11-04, Funnel 공개).
 *
 * 친구들은 카톡으로 받은 투표 링크로만 들어온다 — 투표 화면과 그 화면이 쓰는 API 두 개
 * (투표 조회 GET, 표 던지기 POST)만 열고 나머지(장소 추천·저장 목록·투표 생성/삭제)는 잠근다.
 * 잠금 해제 화면과 그 API도 당연히 열려 있어야 한다.
 */
const VOTE_PAGE = /^\/vote\/(?!new$)[^/]+$/;
const VOTE_API = /^\/api\/votes\/[^/]+$/;
const BALLOT_API = /^\/api\/votes\/[^/]+\/ballot$/;

export function isPublicRequest(method: string, pathname: string): boolean {
  if (pathname === "/unlock" || pathname === "/api/unlock") return true;
  const read = method === "GET" || method === "HEAD";
  if (read && (VOTE_PAGE.test(pathname) || VOTE_API.test(pathname))) return true;
  if (method === "POST" && BALLOT_API.test(pathname)) return true;
  return false;
}
