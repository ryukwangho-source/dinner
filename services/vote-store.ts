import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { computeDeadline } from "@/lib/vote-deadline";
import type { Venue } from "@/types/recommendation";
import type { SubmitBallotResult, VoteDetail, VoteDuration, VoteSummary } from "@/types/vote";

interface VoteRow {
  id: string;
  deadline_at: string;
  created_at: string;
}

interface VoteCandidateRow {
  id: string;
  vote_id: string;
  venue_id: string;
  name: string;
  region: string;
  rating: number;
  review_count: number;
  view_count: number;
  price_per_person: number;
}

interface VoteSubmissionRow {
  vote_id: string;
  device_id: string;
  selected_candidate_ids: string;
  submitted_at: string;
}

/**
 * 투표 저장소. 후보는 생성 시점 스냅샷(saved-venue-store와 동일 원칙),
 * 득표수는 캐시하지 않고 조회 시점에 vote_submissions를 다시 집계한다 —
 * 캐시와 실제 제출이 어긋날 위험을 원천 차단한다.
 * 같은 (vote_id, device_id)는 항상 최신 제출로 덮어쓴다 (재투표 규칙).
 */
export function createVoteStore(dbPath: string) {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      deadline_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vote_candidates (
      id TEXT PRIMARY KEY,
      vote_id TEXT NOT NULL,
      venue_id TEXT NOT NULL,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      price_per_person INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vote_submissions (
      vote_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      selected_candidate_ids TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      PRIMARY KEY (vote_id, device_id)
    );
  `);
  // 기존 DB에는 rating·review_count·view_count 컬럼이 없을 수 있다 — CREATE TABLE
  // IF NOT EXISTS는 이미 있는 테이블에 컬럼을 추가하지 않으므로 직접 확인 후 붙인다.
  const candidateColumns = new Set(
    (db.prepare("PRAGMA table_info(vote_candidates)").all() as { name: string }[]).map(
      (c) => c.name,
    ),
  );
  if (!candidateColumns.has("rating")) {
    db.exec("ALTER TABLE vote_candidates ADD COLUMN rating REAL NOT NULL DEFAULT 0");
  }
  if (!candidateColumns.has("review_count")) {
    db.exec("ALTER TABLE vote_candidates ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!candidateColumns.has("view_count")) {
    db.exec("ALTER TABLE vote_candidates ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0");
  }

  const insertVote = db.prepare(
    "INSERT INTO votes (id, deadline_at, created_at) VALUES (?, ?, ?)",
  );
  const insertCandidate = db.prepare(
    "INSERT INTO vote_candidates (id, vote_id, venue_id, name, region, rating, review_count, view_count, price_per_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const upsertSubmission = db.prepare(`
    INSERT INTO vote_submissions (vote_id, device_id, selected_candidate_ids, submitted_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(vote_id, device_id) DO UPDATE SET
      selected_candidate_ids = excluded.selected_candidate_ids,
      submitted_at = excluded.submitted_at
  `);
  const deleteVote = db.prepare("DELETE FROM votes WHERE id = ?");
  const deleteCandidatesByVote = db.prepare("DELETE FROM vote_candidates WHERE vote_id = ?");
  const deleteSubmissionsByVote = db.prepare("DELETE FROM vote_submissions WHERE vote_id = ?");
  const removeTx = db.transaction((voteId: string) => {
    deleteSubmissionsByVote.run(voteId);
    deleteCandidatesByVote.run(voteId);
    return deleteVote.run(voteId).changes > 0;
  });

  function isClosed(deadlineAt: string, now: Date): boolean {
    return new Date(deadlineAt).getTime() <= now.getTime();
  }

  return {
    create(
      candidates: Venue[],
      duration: VoteDuration,
      now = new Date(),
      customMinutes?: number,
    ): { id: string; deadlineAt: string } {
      const id = randomUUID();
      const createdAt = now.toISOString();
      const deadlineAt = computeDeadline(duration, now, customMinutes).toISOString();
      const tx = db.transaction(() => {
        insertVote.run(id, deadlineAt, createdAt);
        for (const venue of candidates) {
          insertCandidate.run(
            randomUUID(),
            id,
            venue.id,
            venue.name,
            venue.region,
            venue.rating,
            venue.reviewCount,
            venue.viewCount,
            venue.pricePerPerson,
          );
        }
      });
      tx();
      return { id, deadlineAt };
    },

    get(voteId: string, deviceId: string, now = new Date()): VoteDetail | null {
      const vote = db.prepare("SELECT * FROM votes WHERE id = ?").get(voteId) as
        | VoteRow
        | undefined;
      if (!vote) return null;

      const candidates = db
        .prepare("SELECT * FROM vote_candidates WHERE vote_id = ?")
        .all(voteId) as VoteCandidateRow[];
      const submissions = db
        .prepare("SELECT * FROM vote_submissions WHERE vote_id = ?")
        .all(voteId) as VoteSubmissionRow[];

      const tally = new Map<string, number>();
      for (const sub of submissions) {
        const selected = JSON.parse(sub.selected_candidate_ids) as string[];
        for (const candidateId of selected) {
          tally.set(candidateId, (tally.get(candidateId) ?? 0) + 1);
        }
      }

      const mine = submissions.find((sub) => sub.device_id === deviceId);

      return {
        id: vote.id,
        deadlineAt: vote.deadline_at,
        isClosed: isClosed(vote.deadline_at, now),
        candidates: candidates.map((c) => ({
          id: c.id,
          venueId: c.venue_id,
          name: c.name,
          region: c.region,
          rating: c.rating,
          reviewCount: c.review_count,
          viewCount: c.view_count,
          pricePerPerson: c.price_per_person,
          voteCount: tally.get(c.id) ?? 0,
        })),
        mySelection: mine ? (JSON.parse(mine.selected_candidate_ids) as string[]) : [],
      };
    },

    submitBallot(
      voteId: string,
      deviceId: string,
      selectedCandidateIds: string[],
      now = new Date(),
    ): SubmitBallotResult {
      const vote = db.prepare("SELECT * FROM votes WHERE id = ?").get(voteId) as
        | VoteRow
        | undefined;
      if (!vote) return "not-found";
      if (isClosed(vote.deadline_at, now)) return "closed";

      // 중복 id·이 투표에 속하지 않는 id는 걸러낸다 — 그렇지 않으면 같은 후보를 여러 번
      // 보내 득표수를 부풀릴 수 있다 (한 기기의 한 번 제출은 후보당 최대 1표여야 한다).
      const validCandidateIds = new Set(
        (
          db
            .prepare("SELECT id FROM vote_candidates WHERE vote_id = ?")
            .all(voteId) as { id: string }[]
        ).map((row) => row.id),
      );
      const sanitized = Array.from(new Set(selectedCandidateIds)).filter((candidateId) =>
        validCandidateIds.has(candidateId),
      );

      upsertSubmission.run(voteId, deviceId, JSON.stringify(sanitized), now.toISOString());
      return "ok";
    },

    /** 투표와 그 후보·제출 기록을 함께 삭제한다. 존재하지 않으면 false. */
    remove(voteId: string): boolean {
      return removeTx(voteId);
    },

    listAll(now = new Date()): VoteSummary[] {
      const votes = db
        .prepare("SELECT * FROM votes ORDER BY created_at DESC, rowid DESC")
        .all() as VoteRow[];
      const countStmt = db.prepare(
        "SELECT COUNT(*) as c FROM vote_candidates WHERE vote_id = ?",
      );

      return votes.map((vote) => {
        const { c: candidateCount } = countStmt.get(vote.id) as { c: number };
        return {
          id: vote.id,
          candidateCount,
          status: isClosed(vote.deadline_at, now) ? "closed" : "open",
          createdAt: vote.created_at,
          deadlineAt: vote.deadline_at,
        };
      });
    },
  };
}

export type VoteStore = ReturnType<typeof createVoteStore>;

let store: VoteStore | null = null;

/** 프로세스 공유 싱글턴 — 경로는 VOTES_DB_PATH(기본 data/votes.db) */
export function getVoteStore(): VoteStore {
  if (!store) {
    store = createVoteStore(process.env.VOTES_DB_PATH ?? "data/votes.db");
  }
  return store;
}
