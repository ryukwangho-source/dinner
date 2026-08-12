import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * E2E 전용 DB를 매 실행 전에 완전히 지운다.
 *
 * 처음엔 DELETE FROM으로 행만 비웠으나(travel의 global-setup.ts와 동일 패턴),
 * WAL 모드 파일에 DELETE만 하고 별도 커넥션을 닫는 방식이 다음 실행에서 만든
 * 새 커넥션에 안정적으로 반영되지 않아 이전 실행의 레코드가 남는 문제가 있었다.
 * 웹서버가 아직 안 떠 있는 시점(globalSetup은 webServer보다 먼저 실행)이라
 * 파일을 통째로 지워도 EBUSY 위험이 없다.
 *
 * 이름에 `-e2e.db`가 든 파일(과 -shm/-wal 곁다리)만 지운다 — 실사용 DB는 건드리지 않는다.
 */
/**
 * 직전 실행의 서버 프로세스가 막 종료된 직후라 Windows가 파일 핸들을 아직 놓지
 * 않은 경우가 있다(EPERM). Node의 rmSync는 몇 초를 재시도해도 실패하지만
 * PowerShell Remove-Item은 안정적으로 지워지는 걸 확인해 최후 수단으로 쓴다.
 */
function rmWithRetry(path: string, attempts = 5, delayMs = 300) {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY") throw error;
      if (i < attempts - 1) {
        const until = Date.now() + delayMs;
        while (Date.now() < until) {
          /* 동기 대기 */
        }
        continue;
      }
      // 마지막 시도까지 실패하면 PowerShell로 강제 삭제
      execFileSync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Remove-Item -Force -LiteralPath '${path.replace(/'/g, "''")}'`,
      ]);
    }
  }
}

export default function globalSetup() {
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) return;

  for (const file of readdirSync(dataDir)) {
    if (!file.includes("-e2e.db")) continue;
    rmWithRetry(join(dataDir, file));
  }
}
