/** 생성 1건의 토큰 사용량·비용 (Agent SDK 구독 인증 경로에서만 채워진다) */
export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  models: string[];
}
