/**
 * Next.js instrumentation — 서버 프로세스 전역 안전장치.
 * 백그라운드 생성(Agent SDK)이 던지는 미처리 거부/예외가 서버(next start)를
 * 통째로 죽이지 않도록 로깅만 하고 살아남는다 (요구10: 생성 실패해도 앱은 유지).
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("[uncaughtException]", error);
  });
}
