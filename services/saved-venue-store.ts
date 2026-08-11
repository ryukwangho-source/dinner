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
  pricePerPerson: number;
  savedAt: string;
}

interface SavedVenueRow {
  id: string;
  venue_id: string;
  name: string;
  category: string;
  region: string;
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
      price_per_person INTEGER NOT NULL,
      saved_at TEXT NOT NULL
    )
  `);

  const insert = db.prepare(
    "INSERT INTO saved_venues (id, venue_id, name, category, region, price_per_person, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  return {
    saveMany(venues: Venue[]): SavedVenue[] {
      const now = new Date().toISOString();
      const saved: SavedVenue[] = [];
      const tx = db.transaction((items: Venue[]) => {
        for (const v of items) {
          const id = randomUUID();
          insert.run(id, v.id, v.name, v.category, v.region, v.pricePerPerson, now);
          saved.push({
            id,
            venueId: v.id,
            name: v.name,
            category: v.category,
            region: v.region,
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
