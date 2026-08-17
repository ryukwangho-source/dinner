import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { Venue } from "@/types/recommendation";

export interface SavedVenue {
  id: string;
  venueId: string;
  name: string;
  category: string;
  region: string;
  rating: number;
  pricePerPerson: number;
  savedAt: string;
}

interface SavedVenueRow {
  id: string;
  venue_id: string;
  name: string;
  category: string;
  region: string;
  rating: number;
  price_per_person: number;
  saved_at: string;
}

function rowToSavedVenue(row: SavedVenueRow): SavedVenue {
  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    category: row.category,
    region: row.region,
    rating: row.rating,
    pricePerPerson: row.price_per_person,
    savedAt: row.saved_at,
  };
}

/**
 * 로그인 없이 누구나 저장·삭제하는 공유 목록 (travel의 trip-store와 동일 패턴).
 * 시드 데이터가 바뀌어도 흔들리지 않도록 저장 시점 스냅샷을 컬럼으로 그대로 둔다.
 */
export function createSavedVenueStore(dbPath: string) {
  if (dbPath !== ":memory:") {
    mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_venues (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      region TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 0,
      price_per_person INTEGER NOT NULL,
      saved_at TEXT NOT NULL
    )
  `);
  // 기존 DB에는 rating 컬럼이 없을 수 있다 — CREATE TABLE IF NOT EXISTS는 이미
  // 있는 테이블에 컬럼을 추가하지 않으므로 직접 확인 후 붙인다.
  const hasRatingColumn = (
    db.prepare("PRAGMA table_info(saved_venues)").all() as { name: string }[]
  ).some((c) => c.name === "rating");
  if (!hasRatingColumn) {
    db.exec("ALTER TABLE saved_venues ADD COLUMN rating REAL NOT NULL DEFAULT 0");
  }

  const insert = db.prepare(
    "INSERT INTO saved_venues (id, venue_id, name, category, region, rating, price_per_person, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  return {
    saveMany(venues: Venue[]): SavedVenue[] {
      const now = new Date().toISOString();
      const saved: SavedVenue[] = [];
      const tx = db.transaction((items: Venue[]) => {
        for (const v of items) {
          const id = randomUUID();
          insert.run(id, v.id, v.name, v.category, v.region, v.rating, v.pricePerPerson, now);
          saved.push({
            id,
            venueId: v.id,
            name: v.name,
            category: v.category,
            region: v.region,
            rating: v.rating,
            pricePerPerson: v.pricePerPerson,
            savedAt: now,
          });
        }
      });
      tx(venues);
      return saved;
    },

    list(): SavedVenue[] {
      const rows = db
        .prepare("SELECT * FROM saved_venues ORDER BY saved_at DESC, rowid DESC")
        .all() as SavedVenueRow[];
      return rows.map(rowToSavedVenue);
    },

    remove(id: string): boolean {
      return db.prepare("DELETE FROM saved_venues WHERE id = ?").run(id).changes > 0;
    },

    removeAll(): number {
      return db.prepare("DELETE FROM saved_venues").run().changes;
    },
  };
}

export type SavedVenueStore = ReturnType<typeof createSavedVenueStore>;

let store: SavedVenueStore | null = null;

/** 프로세스 공유 싱글턴 — 경로는 SAVED_VENUES_DB_PATH(기본 data/saved-venues.db) */
export function getSavedVenueStore(): SavedVenueStore {
  if (!store) {
    store = createSavedVenueStore(process.env.SAVED_VENUES_DB_PATH ?? "data/saved-venues.db");
  }
  return store;
}
