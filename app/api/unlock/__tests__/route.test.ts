// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "../route";
import { MAX_ATTEMPTS, resetAllAttempts } from "@/lib/rate-limit";
import { UNLOCK_COOKIE, unlockToken } from "@/lib/server-auth";

const attempt = (password: string, forwardedFor = "203.0.113.7") =>
  POST(
    new Request("http://x/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
      body: JSON.stringify({ password }),
    }),
  );

describe("POST /api/unlock", () => {
  beforeEach(() => {
    resetAllAttempts();
    process.env.APP_PASSWORD = "correct-horse";
  });
  afterEach(() => {
    delete process.env.APP_PASSWORD;
  });

  it("맞는 비밀번호면 해제 쿠키를 심는다", async () => {
    const res = await attempt("correct-horse");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(
      `${UNLOCK_COOKIE}=${unlockToken("correct-horse")}`,
    );
  });

  it("틀리면 401", async () => {
    expect((await attempt("wrong")).status).toBe(401);
  });

  it("가짜 IP를 앞에 바꿔 넣어도 시도 제한에 걸린다", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect((await attempt("wrong", `10.0.0.${i}, 203.0.113.7`)).status).toBe(401);
    }
    expect((await attempt("correct-horse", "10.9.9.9, 203.0.113.7")).status).toBe(429);
  });

  it("서버에 비밀번호가 없으면 잠금을 풀 수 없다(fail-closed)", async () => {
    delete process.env.APP_PASSWORD;
    const res = await attempt("");
    expect(res.status).toBe(503);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
