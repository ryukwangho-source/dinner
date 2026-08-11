import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 네이티브 모듈(sqlite)과 CLI를 스폰하는 Agent SDK는 번들에서 제외
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
