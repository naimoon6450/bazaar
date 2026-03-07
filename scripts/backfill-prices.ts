/**
 * Backfill normalized price fields on existing brands.
 * Parses the existing price_label column through parsePrice()
 * and populates price_amount, price_amount_min, price_amount_max,
 * price_currency, and price_raw.
 *
 * Usage: npx tsx scripts/backfill-prices.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { parsePrice } from "../src/lib/ingest/normalize";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bazaar.db");

if (!fs.existsSync(DB_PATH)) {
  console.error(
    `Database not found at ${DB_PATH}. Run "npm run db:migrate" first.`
  );
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const rows = db
  .prepare("SELECT id, name, price_label FROM brands")
  .all() as { id: number; name: string; price_label: string | null }[];

const update = db.prepare(`
  UPDATE brands
  SET price_amount = ?,
      price_amount_min = ?,
      price_amount_max = ?,
      price_currency = ?,
      price_raw = ?
  WHERE id = ?
`);

let updated = 0;
let skipped = 0;
let parsed = 0;

const txn = db.transaction(() => {
  for (const row of rows) {
    if (!row.price_label) {
      skipped++;
      continue;
    }

    const result = parsePrice(row.price_label);

    update.run(
      result.amount,
      result.amountMin,
      result.amountMax,
      result.currency,
      result.raw || null,
      row.id
    );

    if (result.amount !== null) {
      parsed++;
      console.log(
        `  ${row.name}: "${row.price_label}" -> ${result.currency} ${result.amount}${result.amountMin !== result.amountMax ? ` (${result.amountMin}-${result.amountMax})` : ""}`
      );
    } else {
      // Still store the raw value even if we couldn't parse a numeric amount
      console.log(
        `  ${row.name}: "${row.price_label}" -> stored raw only (tier string)`
      );
    }

    updated++;
  }
});

txn();

console.log(`\nBackfill complete:`);
console.log(`  Total brands: ${rows.length}`);
console.log(`  Updated:      ${updated}`);
console.log(`  Parsed numeric: ${parsed}`);
console.log(`  Skipped (no price_label): ${skipped}`);

db.close();
