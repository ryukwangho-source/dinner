import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Anthropic 클라이언트 싱글턴 — ANTHROPIC_API_KEY(.env.local)로 인증 */
export function getAnthropic(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
