import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { CACHE_TTL_MS } from "@/config/venue-generation";
import type { GenerationUsage } from "@/types/generation-usage";
import type { RegionRecommendation } from "@/types/recommendation";

export type VenueJobStatus = "pending" | "running" | "done" | "error";
/** region: 지역명 기준 자동 추천, manual: 사용자가 지정한 1차 장소 기준. 같은 문자열도 mode가 다르면 별개 캐시로 취급한다 */
export type VenueJobMode = "region" | "manual";

export interface VenueGenerationJob {
  id: string;
  status: VenueJobStatus;
  mode: VenueJobMode;
  regions: string[];
  partySize: number;
  budgetPerPerson: number;
  result: RegionRecommendation[] | null;
  error: string | null;
  usage: GenerationUsage | null;
  createdAt: string;
  updatedAt: string;
}

interface VenueJobRow {
  id: string;
  status: VenueJobStatus;
  mode: VenueJobMode;
  regions: string;
  party_size: number;
  budget_per_person: number;
  result: string | null;
  error: string | null;
  usage: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: VenueJobRow): VenueGenerationJob {
  return {
    id: row.id,
    status: row.status,
    mode: row.mode ?? "region",
    regions: JSON.parse(row.regions) as string[],
    partySize: row.party_size,
    budgetPerPerson: row.budget_per_person,
    result: row.result ? (JSON.parse(row.result) as RegionRecommendation[]) : null,
    error: row.error,
    usage: row.usage ? (JSON.parse(row.usage) as GenerationUsage) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 실시간 장소 생성 작업 저장소. 화면 이탈·새로고침에도 지속되도록 SQLite에 남긴다
 * (travel의 job-store.ts와 동일 패턴). regions(JSON 배열, 입력 순서 그대로 비교)+
 * partySize+budgetPerPerson 조합으로 캐시(findFresh)·진행 중 작업 재사용(findActive)을 조회한다.
 */
export function createVenueJobStore(dbPath: string) {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS venue_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      regions TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      budget_per_person INTEGER NOT NULL,
      result TEXT,
      error TEXT,
      usage TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 이미 배포된 DB에는 mode 컬럼이 없을 수 있다 — CREATE TABLE IF NOT EXISTS는 이미
  // 있는 테이블에 컬럼을 추가하지 않으므로 직접 확인 후 붙인다. DEFAULT 'region'을 주면
  // SQLite가 기존 row에도 그 값을 채워 넣어 별도 backfill이 필요 없다.
  const hasModeColumn = (
    db.prepare("PRAGMA table_info(venue_jobs)").all() as { name: string }[]
  ).some((c) => c.name === "mode");
  if (!hasModeColumn) {
    db.exec("ALTER TABLE venue_jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'region'");
  }

  // 이 프로세스가 막 시작하는 시점에 pending/running으로 남아있는 job은 전부
  // 이전 프로세스(배포로 재기동되기 전 등)에서 끝맺지 못하고 죽은 것뿐이다 —
  // fire-and-forget 생성은 프로세스가 죽으면 결과를 영영 못 받으므로, 그대로 두면
  // 폴링하던 화면이 "추천 장소를 찾고 있어요"에서 무한정 멈춘다. 시작할 때 한 번 정리한다.
  db.prepare(
    "UPDATE venue_jobs SET status = 'error', error = ?, updated_at = ? WHERE status IN ('pending', 'running')",
  ).run("서버 재시작으로 생성이 중단됐어요. 다시 시도해주세요.", new Date().toISOString());

  const findByKeyStmt = db.prepare(
    "SELECT * FROM venue_jobs WHERE regions = ? AND party_size = ? AND budget_per_person = ? AND mode = ? AND status = ? ORDER BY created_at DESC LIMIT 1",
  );

  function touch(id: string, patch: Partial<VenueJobRow>) {
    const now = new Date().toISOString();
    const cols = Object.keys(patch);
    const set = cols.map((c) => `${c} = ?`).join(", ");
    db.prepare(`UPDATE venue_jobs SET ${set}, updated_at = ? WHERE id = ?`).run(
      ...cols.map((c) => patch[c as keyof VenueJobRow]),
      now,
      id,
    );
  }

  return {
    create(
      regions: string[],
      partySize: number,
      budgetPerPerson: number,
      mode: VenueJobMode = "region",
    ): VenueGenerationJob {
      const id = randomUUID();
      const now = new Date().toISOString();
      const regionsJson = JSON.stringify(regions);
      db.prepare(
        "INSERT INTO venue_jobs (id, status, mode, regions, party_size, budget_per_person, result, error, usage, created_at, updated_at) VALUES (?, 'pending', ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)",
      ).run(id, mode, regionsJson, partySize, budgetPerPerson, now, now);
      return {
        id,
        status: "pending",
        mode,
        regions,
        partySize,
        budgetPerPerson,
        result: null,
        error: null,
        usage: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    markRunning(id: string) {
      touch(id, { status: "running" });
    },

    markDone(id: string, result: RegionRecommendation[], usage: GenerationUsage | null = null) {
      touch(id, {
        status: "done",
        result: JSON.stringify(result),
        usage: usage ? JSON.stringify(usage) : null,
      });
    },

    markError(id: string, message: string) {
      touch(id, { status: "error", error: message });
    },

    get(id: string): VenueGenerationJob | null {
      const row = db.prepare("SELECT * FROM venue_jobs WHERE id = ?").get(id) as
        | VenueJobRow
        | undefined;
      return row ? rowToJob(row) : null;
    },

    /**
     * 같은 조합의 6시간 이내 완료된 작업(캐시) — 있으면 새 생성 없이 재사용.
     * mode는 마지막에 둔다(기본값 "region") — 기존 호출부가 `now`까지만 넘겨도 그대로 컴파일·동작한다.
     */
    findFresh(
      regions: string[],
      partySize: number,
      budgetPerPerson: number,
      now = new Date(),
      mode: VenueJobMode = "region",
    ): VenueGenerationJob | null {
      const row = findByKeyStmt.get(JSON.stringify(regions), partySize, budgetPerPerson, mode, "done") as
        | VenueJobRow
        | undefined;
      if (!row) return null;
      const age = now.getTime() - Date.parse(row.updated_at);
      if (age > CACHE_TTL_MS) return null;
      return rowToJob(row);
    },

    /** 같은 조합으로 아직 진행 중인 작업 — 있으면 새로고침해도 중복 생성하지 않는다 */
    findActive(
      regions: string[],
      partySize: number,
      budgetPerPerson: number,
      mode: VenueJobMode = "region",
    ): VenueGenerationJob | null {
      const regionsJson = JSON.stringify(regions);
      for (const status of ["pending", "running"] as const) {
        const row = findByKeyStmt.get(regionsJson, partySize, budgetPerPerson, mode, status) as
          | VenueJobRow
          | undefined;
        if (row) return rowToJob(row);
      }
      return null;
    },
  };
}

export type VenueJobStore = ReturnType<typeof createVenueJobStore>;

let store: VenueJobStore | null = null;

/** 프로세스 공유 싱글턴 — 경로는 VENUE_JOBS_DB_PATH(기본 data/venue-jobs.db) */
export function getVenueJobStore(): VenueJobStore {
  if (!store) {
    store = createVenueJobStore(process.env.VENUE_JOBS_DB_PATH ?? "data/venue-jobs.db");
  }
  return store;
}
