/**
 * Import a CSV/XLSX file into the database.
 * Usage: npx tsx scripts/import-csv.ts <path-to-file>
 */
import fs from "fs";
import path from "path";

// Ensure DB exists
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bazaar.db");
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}. Run "npm run db:migrate" first.`);
  process.exit(1);
}

import { parseSpreadsheet } from "../src/lib/ingest/parse";
import { importRows } from "../src/lib/ingest/import";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/import-csv.ts <path-to-file>");
  process.exit(1);
}

const absPath = path.resolve(filePath);
if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(1);
}

const buffer = fs.readFileSync(absPath);
const filename = path.basename(absPath);

console.log(`Parsing ${filename}...`);
const { rows, errors: parseErrors } = parseSpreadsheet(buffer, filename);

if (parseErrors.length > 0) {
  console.log(`Parse warnings: ${parseErrors.length}`);
  parseErrors.forEach((e) => console.log(`  - ${e}`));
}

console.log(`Parsed ${rows.length} rows. Importing...`);
const result = importRows(rows);

console.log(`\nImport complete:`);
console.log(`  Total:    ${result.rowsTotal}`);
console.log(`  Inserted: ${result.rowsInserted}`);
console.log(`  Updated:  ${result.rowsUpdated}`);
console.log(`  Failed:   ${result.rowsFailed}`);

if (result.errors.length > 0) {
  console.log(`\nErrors:`);
  result.errors.forEach((e) => console.log(`  - ${e}`));
}
