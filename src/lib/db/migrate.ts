/**
 * Run this script to create/migrate the database tables.
 * Usage: npx tsx src/lib/db/migrate.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bazaar.db");

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    based_in TEXT,
    website_url_raw TEXT,
    website_url_canonical TEXT,
    website_host TEXT,
    notes TEXT,
    price_tier INTEGER,
    price_label TEXT,
    rating_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('category', 'style', 'based_in')),
    label TEXT NOT NULL,
    slug TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS tags_type_slug_idx ON tags(type, slug);

  CREATE TABLE IF NOT EXISTS brand_tags (
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (brand_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS enrichment (
    brand_id INTEGER PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
    last_checked_at TEXT,
    http_status INTEGER,
    final_url TEXT,
    title TEXT,
    meta_description TEXT,
    og_image_url TEXT,
    etag TEXT,
    last_modified TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS ingestion_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    rows_total INTEGER DEFAULT 0,
    rows_inserted INTEGER DEFAULT 0,
    rows_updated INTEGER DEFAULT 0,
    rows_failed INTEGER DEFAULT 0,
    log TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
  CREATE INDEX IF NOT EXISTS idx_brand_tags_tag_id ON brand_tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_enrichment_last_checked ON enrichment(last_checked_at);
`);

// Phase 1 migrations: brand_products table + is_shopify flag
db.exec(`
  CREATE TABLE IF NOT EXISTS brand_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT,
    price TEXT,
    currency TEXT DEFAULT 'USD',
    product_url TEXT NOT NULL,
    product_type TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS brand_products_brand_external_idx
    ON brand_products(brand_id, external_id);

  CREATE INDEX IF NOT EXISTS idx_brand_products_brand_id
    ON brand_products(brand_id);
`);

// Add is_shopify column to enrichment if it doesn't exist
try {
  db.exec(`ALTER TABLE enrichment ADD COLUMN is_shopify INTEGER`);
  console.log("Added is_shopify column to enrichment table");
} catch {
  // Column already exists — fine
}

console.log(`Database initialized at ${DB_PATH}`);
db.close();
