import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";

/** Expected column headers (case-insensitive matching) */
const COLUMN_MAP: Record<string, string> = {
  brand: "brand",
  "product categories": "productCategories",
  "style focus": "styleFocus",
  notes: "notes",
  "based in": "basedIn",
  website: "website",
  "price range": "priceRange",
  "rating (notes)": "ratingNotes",
  "rating notes": "ratingNotes",
};

export interface RawBrandRow {
  brand: string;
  productCategories: string;
  styleFocus: string;
  notes: string;
  basedIn: string;
  website: string;
  priceRange: string;
  ratingNotes: string;
}

/**
 * Parse a CSV or XLSX buffer into normalized row objects.
 */
export function parseSpreadsheet(
  buffer: Buffer,
  filename: string
): { rows: RawBrandRow[]; errors: string[] } {
  const ext = filename.toLowerCase().split(".").pop();
  const errors: string[] = [];

  let rawRows: Record<string, string>[];

  if (ext === "csv") {
    rawRows = csvParse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } else if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { rows: [], errors: ["No sheets found in workbook"] };
    }
    rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets[sheetName],
      { defval: "" }
    );
  } else {
    return { rows: [], errors: [`Unsupported file type: ${ext}`] };
  }

  const rows: RawBrandRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const mapped: Record<string, string> = {};

    // Map column headers to our keys
    for (const [rawKey, value] of Object.entries(raw)) {
      const normalized = rawKey.trim().toLowerCase();
      const mappedKey = COLUMN_MAP[normalized];
      if (mappedKey) {
        mapped[mappedKey] = String(value ?? "").trim();
      }
    }

    // Brand name is required
    if (!mapped.brand) {
      errors.push(`Row ${i + 2}: missing brand name, skipped`);
      continue;
    }

    rows.push({
      brand: mapped.brand || "",
      productCategories: mapped.productCategories || "",
      styleFocus: mapped.styleFocus || "",
      notes: mapped.notes || "",
      basedIn: mapped.basedIn || "",
      website: mapped.website || "",
      priceRange: mapped.priceRange || "",
      ratingNotes: mapped.ratingNotes || "",
    });
  }

  return { rows, errors };
}
