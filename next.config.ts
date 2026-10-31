import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 네이티브 모듈(sqlite)과 CLI를 스폰하는 Agent SDK는 번들에서 제외
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/claude-agent-sdk"],
  // 모바일에서 tailscale serve(https://invest-pc...:10000)로 dev 서버에 붙을 때 HMR·dev 리소스 차단 방지
  allowedDevOrigins: ["invest-pc.tail3efebe.ts.net", "100.83.45.54"],
};

export default nextConfig;
