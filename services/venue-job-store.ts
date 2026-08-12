import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { CACHE_TTL_MS } from "@/config/venue-generation";
import type { RankedVenue } from "@/types/recommendation";

export type VenueJobStatus = "pending" | "running" | "done" | "error";

export interface VenueGenerationJob {
  id: string;
  status: VenueJobStatus;
  region: string;
  partySize: number;
  budgetPerPerson: number;
  result: RankedVenue[] | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VenueJobRow {
  id: string;
  status: VenueJobStatus;
  region: string;
  party_size: number;
  budget_per_person: number;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: VenueJobRow): VenueGenerationJob {
  return {
    id: row.id,
    status: row.status,
    region: row.region,
    partySize: row.party_size,
    budgetPerPerson: row.budget_per_person,
    result: row.result ? (JSON.parse(row.result) as RankedVenue[]) : null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 실시간 장소 생성 작업 저장소. 화면 이탈·새로고침에도 지속되도록 SQLite에 남긴다
 * (travel의 job-store.ts와 동일 패턴). region+partySize+budgetPerPerson 조합으로
 * 캐시(findFresh)·진행 중 작업 재사용(findActive)을 조회한다.
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
      region TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      budget_per_person INTEGER NOT NULL,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const findByKeyStmt = db.prepare(
    "SELECT * FROM venue_jobs WHERE region = ? AND party_size = ? AND budget_per_person = ? AND status = ? ORDER BY created_at DESC LIMIT 1",
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
    create(region: string, partySize: number, budgetPerPerson: number): VenueGenerationJob {
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO venue_jobs (id, status, region, party_size, budget_per_person, result, error, created_at, updated_at) VALUES (?, 'pending', ?, ?, ?, NULL, NULL, ?, ?)",
      ).run(id, region, partySize, budgetPerPerson, now, now);
      return {
        id,
        status: "pending",
        region,
        partySize,
        budgetPerPerson,
        result: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    markRunning(id: string) {
      touch(id, { status: "running" });
    },

    markDone(id: string, result: RankedVenue[]) {
      touch(id, { status: "done", result: JSON.stringify(result) });
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

    /** 같은 조합의 6시간 이내 완료된 작업(캐시) — 있으면 새 생성 없이 재사용 */
    findFresh(
      region: string,
      partySize: number,
      budgetPerPerson: number,
      now = new Date(),
    ): VenueGenerationJob | null {
      const row = findByKeyStmt.get(region, partySize, budgetPerPerson, "done") as
        | VenueJobRow
        | undefined;
      if (!row) return null;
      const age = now.getTime() - Date.parse(row.updated_at);
      if (age > CACHE_TTL_MS) return null;
      return rowToJob(row);
    },

    /** 같은 조합으로 아직 진행 중인 작업 — 있으면 새로고침해도 중복 생성하지 않는다 */
    findActive(region: string, partySize: number, budgetPerPerson: number): VenueGenerationJob | null {
      for (const status of ["pending", "running"] as const) {
        const row = findByKeyStmt.get(region, partySize, budgetPerPerson, status) as
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
