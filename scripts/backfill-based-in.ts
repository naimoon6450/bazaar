/**
 * Backfill script: normalize existing "based_in" tags to country level.
 *
 * Usage: npx tsx scripts/backfill-based-in.ts [--dry-run]
 *
 * What it does:
 *  1. Reads all brand rows that have a non-null `based_in` column.
 *  2. For each brand, parses the raw based_in string through
 *     `parseBasedIn()` (country-level normalization).
 *  3. Removes old `based_in` tag links for that brand.
 *  4. Upserts the new country-level tags and links them.
 *  5. Deletes any `based_in` tags that are no longer referenced by any brand.
 *
 * Pass --dry-run to preview changes without writing to the database.
 */

import Database from "better-sqlite3";
import path from "path";
import { parseBasedIn } from "../src/lib/ingest/countries";

const DRY_RUN = process.argv.includes("--dry-run");
const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bazaar.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log(`Database: ${DB_PATH}`);
console.log(DRY_RUN ? "Mode: DRY RUN (no writes)" : "Mode: LIVE (writing changes)");
console.log();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateTag(type: string, label: string, slug: string): number {
  const existing = db
    .prepare("SELECT id FROM tags WHERE type = ? AND slug = ?")
    .get(type, slug) as { id: number } | undefined;

  if (existing) return existing.id;

  const result = db
    .prepare("INSERT INTO tags (type, label, slug) VALUES (?, ?, ?) RETURNING id")
    .get(type, label, slug) as { id: number };

  return result.id;
}

function linkBrandTag(brandId: number, tagId: number) {
  const existing = db
    .prepare("SELECT 1 FROM brand_tags WHERE brand_id = ? AND tag_id = ?")
    .get(brandId, tagId);

  if (!existing) {
    db.prepare("INSERT INTO brand_tags (brand_id, tag_id) VALUES (?, ?)").run(
      brandId,
      tagId
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Fetch all brands with a based_in value
const brandsWithLocation = db
  .prepare(
    "SELECT id, name, based_in FROM brands WHERE based_in IS NOT NULL AND based_in != ''"
  )
  .all() as { id: number; name: string; based_in: string }[];

console.log(`Found ${brandsWithLocation.length} brand(s) with a based_in value.\n`);

let brandsProcessed = 0;
let tagsCreated = 0;
let tagsLinked = 0;
let tagsUnlinked = 0;

const processAll = db.transaction(() => {
  for (const brand of brandsWithLocation) {
    const normalized = parseBasedIn(brand.based_in);

    if (DRY_RUN) {
      const raw = brand.based_in.trim();
      const labels = normalized.map((n) => n.label).join(", ");
      if (raw !== labels) {
        console.log(`  "${brand.name}": "${raw}" → "${labels}"`);
      }
      continue;
    }

    // Remove all existing based_in tag links for this brand
    const oldLinks = db
      .prepare(
        `SELECT bt.tag_id FROM brand_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE bt.brand_id = ? AND t.type = 'based_in'`
      )
      .all(brand.id) as { tag_id: number }[];

    for (const link of oldLinks) {
      db.prepare(
        "DELETE FROM brand_tags WHERE brand_id = ? AND tag_id = ?"
      ).run(brand.id, link.tag_id);
      tagsUnlinked++;
    }

    // Create/link new country-level tags
    for (const loc of normalized) {
      const tagId = getOrCreateTag("based_in", loc.label, loc.slug);
      linkBrandTag(brand.id, tagId);
      tagsLinked++;
    }

    brandsProcessed++;
  }

  if (!DRY_RUN) {
    // Delete orphaned based_in tags (not linked to any brand)
    const orphaned = db
      .prepare(
        `SELECT id, label FROM tags
         WHERE type = 'based_in'
           AND id NOT IN (SELECT DISTINCT tag_id FROM brand_tags)`
      )
      .all() as { id: number; label: string }[];

    for (const tag of orphaned) {
      console.log(`  Removing orphaned tag: "${tag.label}" (id=${tag.id})`);
      db.prepare("DELETE FROM tags WHERE id = ?").run(tag.id);
    }

    console.log(`\nSummary:`);
    console.log(`  Brands processed : ${brandsProcessed}`);
    console.log(`  Tag links removed: ${tagsUnlinked}`);
    console.log(`  Tag links added  : ${tagsLinked}`);
    console.log(`  Orphaned tags deleted: ${orphaned.length}`);
  }
});

if (DRY_RUN) {
  console.log("Changes that would be made:");
  processAll();
  console.log("\nRun without --dry-run to apply changes.");
} else {
  processAll();
}

db.close();
