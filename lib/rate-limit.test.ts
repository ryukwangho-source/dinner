import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  WINDOW_MS,
  clearAttempts,
  clientKey,
  recordAttempt,
  resetAllAttempts,
} from "./rate-limit";

beforeEach(() => resetAllAttempts());

describe("recordAttempt", () => {
  it("허용 횟수까지는 통과한다", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(recordAttempt("ip").allowed).toBe(true);
    }
  });

  it("초과하면 막고 남은 대기 시간을 알려준다", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordAttempt("ip");
    const res = recordAttempt("ip");
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("창이 지나면 다시 열린다", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) recordAttempt("ip", t0);
    expect(recordAttempt("ip", t0).allowed).toBe(false);
    expect(recordAttempt("ip", t0 + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("키(IP)가 다르면 서로 영향이 없다", () => {
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) recordAttempt("a");
    expect(recordAttempt("b").allowed).toBe(true);
  });
});

describe("clearAttempts", () => {
  it("비우면 다시 처음부터", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordAttempt("ip");
    clearAttempts("ip");
    expect(recordAttempt("ip").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  const at = (headers: Record<string, string>) =>
    clientKey(new Request("http://x/a", { headers }));

  it("x-forwarded-for 의 마지막 주소(프록시가 덧붙인 실제 IP)를 쓴다", () => {
    expect(at({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" })).toBe("10.0.0.1");
  });

  it("클라이언트가 앞에 끼워 넣은 가짜 주소로는 다른 키가 되지 않는다", () => {
    const a = at({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" });
    const b = at({ "x-forwarded-for": "2.2.2.2, 203.0.113.7" });
    expect(a).toBe("203.0.113.7");
    expect(b).toBe(a);
  });

  it("없으면 x-real-ip 로 떨어진다", () => {
    expect(at({ "x-real-ip": "7.7.7.7" })).toBe("7.7.7.7");
  });

  it("아무것도 없으면 unknown — 그래도 카운트는 된다", () => {
    expect(at({})).toBe("unknown");
  });
});
