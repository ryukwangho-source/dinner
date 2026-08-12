import { defineConfig, devices } from "@playwright/test";

// 이 PC의 포트 배정: 3000=invest, 3200=travel 프로덕션 전용, 3100=travel dev/e2e.
// dinner는 3110(dev/e2e) / 3300(프로덕션)을 쓴다.
const PORT = 3110;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  // 실행마다 E2E 전용 DB를 비운다 — 실패로 남은 저장 기록이 쌓이면 다른 테스트까지 깨진다
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // 실사용 DB와 분리
      SAVED_VENUES_DB_PATH: "data/saved-venues-e2e.db",
      VOTES_DB_PATH: "data/votes-e2e.db",
      VENUE_JOBS_DB_PATH: "data/venue-jobs-e2e.db",
      // 실 웹검색 없이 결정적 fixture로 생성 — 비용·시간·비결정성 회피
      GENERATE_FIXTURE: "1",
    },
  },
});
