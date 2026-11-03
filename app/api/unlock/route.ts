import { buildUnlockCookie, isSecureRequest, safeEqual } from "@/lib/server-auth";
import { clearAttempts, clientKey, recordAttempt } from "@/lib/rate-limit";

/** 비밀번호 검증 → 맞으면 httpOnly 쿠키를 심어 이 기기에서 계속 해제 */
export async function POST(request: Request) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    // fail-closed — 설정 누락을 무방비로 열지 않는다.
    return Response.json({ error: "서버에 비밀번호가 설정되지 않았어요" }, { status: 503 });
  }

  // 공개 노출 상태라 무제한 대입을 먼저 끊는다.
  const key = clientKey(request);
  const { allowed, retryAfterSeconds } = recordAttempt(key);
  if (!allowed) {
    return Response.json(
      { error: "시도가 너무 많아요. 잠시 후 다시 해주세요." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const given = (body as { password?: unknown } | null)?.password;
  if (typeof given !== "string" || !safeEqual(given, pw)) {
    return Response.json({ error: "비밀번호가 틀렸어요" }, { status: 401 });
  }

  clearAttempts(key);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildUnlockCookie(pw, isSecureRequest(request)),
    },
  });
}
