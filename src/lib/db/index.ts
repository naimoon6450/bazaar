import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import * as schema from "./schema";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bazaar.db");

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
