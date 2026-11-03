// @vitest-environment node
import { describe, expect, it } from "vitest";
import { UNLOCK_COOKIE, buildUnlockCookie, isUnlocked, unlockToken } from "./server-auth";

const withCookie = (cookie?: string) =>
  new Request("http://x/", { headers: cookie ? { cookie } : {} });

describe("isUnlocked", () => {
  it("올바른 토큰 쿠키가 있으면 해제 상태다", () => {
    const req = withCookie(`a=1; ${UNLOCK_COOKIE}=${unlockToken("pw")}`);
    expect(isUnlocked(req, "pw")).toBe(true);
  });

  it("쿠키가 없거나 다른 비밀번호의 토큰이면 잠김", () => {
    expect(isUnlocked(withCookie(), "pw")).toBe(false);
    expect(isUnlocked(withCookie(`${UNLOCK_COOKIE}=${unlockToken("other")}`), "pw")).toBe(false);
  });

  it("비밀번호가 설정돼 있지 않으면 잠김(fail-closed)", () => {
    const req = withCookie(`${UNLOCK_COOKIE}=${unlockToken("")}`);
    expect(isUnlocked(req, undefined)).toBe(false);
    expect(isUnlocked(req, "")).toBe(false);
  });
});

describe("buildUnlockCookie", () => {
  it("비밀번호 원문 대신 파생 토큰을 httpOnly로 심는다", () => {
    const cookie = buildUnlockCookie("pw", false);
    expect(cookie).toContain(`${UNLOCK_COOKIE}=${unlockToken("pw")}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Secure");
    expect(cookie).not.toContain("=pw;");
  });

  it("HTTPS 요청이면 Secure를 붙인다", () => {
    expect(buildUnlockCookie("pw", true)).toContain("Secure");
  });
});
