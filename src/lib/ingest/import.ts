import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  brands,
  tags,
  brandTags,
  ingestionRuns,
  type NewBrand,
} from "@/lib/db/schema";
import {
  parseMultiValue,
  normalizeWebsite,
  parsePriceTier,
  makeUniqueSlug,
} from "./normalize";
import type { RawBrandRow } from "./parse";

export interface ImportResult {
  runId: number;
  rowsTotal: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsFailed: number;
  errors: string[];
}

/**
 * Get or create a tag, returning its ID.
 */
function getOrCreateTag(
  db: ReturnType<typeof getDb>,
  type: "category" | "style" | "based_in",
  label: string,
  slug: string
): number {
  const existing = db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.type, type), eq(tags.slug, slug)))
    .get();

  if (existing) return existing.id;

  const result = db
    .insert(tags)
    .values({ type, label, slug })
    .returning({ id: tags.id })
    .get();

  return result.id;
}

/**
 * Link a brand to a tag (idempotent).
 */
function linkBrandTag(
  db: ReturnType<typeof getDb>,
  brandId: number,
  tagId: number
) {
  const existing = db
    .select({ brandId: brandTags.brandId })
    .from(brandTags)
    .where(and(eq(brandTags.brandId, brandId), eq(brandTags.tagId, tagId)))
    .get();

  if (!existing) {
    db.insert(brandTags).values({ brandId, tagId }).run();
  }
}

/**
 * Import parsed rows into the database.
 * Upserts brands by slug; creates/links tags.
 */
export function importRows(rows: RawBrandRow[]): ImportResult {
  const db = getDb();
  const errors: string[] = [];
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsFailed = 0;

  // Create ingestion run
  const run = db
    .insert(ingestionRuns)
    .values({ rowsTotal: rows.length })
    .returning({ id: ingestionRuns.id })
    .get();

  // Collect existing slugs for collision handling
  const existingSlugs = new Set(
    db
      .select({ slug: brands.slug })
      .from(brands)
      .all()
      .map((r) => r.slug)
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Normalize fields
      const website = normalizeWebsite(row.website);
      const price = parsePriceTier(row.priceRange);
      const categories = parseMultiValue(row.productCategories);
      const styles = parseMultiValue(row.styleFocus);

      // Check for existing brand by name slug
      const candidateSlug = makeUniqueSlug(row.brand, new Set()); // base slug
      const existingBrand = db
        .select({ id: brands.id, slug: brands.slug })
        .from(brands)
        .where(eq(brands.slug, candidateSlug))
        .get();

      let brandId: number;
      const now = new Date().toISOString();

      if (existingBrand) {
        // Update existing brand
        brandId = existingBrand.id;
        db.update(brands)
          .set({
            name: row.brand,
            basedIn: row.basedIn || null,
            websiteUrlRaw: website?.websiteUrlRaw ?? null,
            websiteUrlCanonical: website?.websiteUrlCanonical ?? null,
            websiteHost: website?.websiteHost ?? null,
            notes: row.notes || null,
            priceTier: price.priceTier,
            priceLabel: price.priceLabel || null,
            ratingNotes: row.ratingNotes || null,
            updatedAt: now,
          })
          .where(eq(brands.id, brandId))
          .run();

        // Clear existing tag links for this brand (re-link below)
        db.delete(brandTags).where(eq(brandTags.brandId, brandId)).run();

        rowsUpdated++;
      } else {
        // Insert new brand
        const slug = makeUniqueSlug(row.brand, existingSlugs);
        existingSlugs.add(slug);

        const brandData: NewBrand = {
          name: row.brand,
          slug,
          basedIn: row.basedIn || null,
          websiteUrlRaw: website?.websiteUrlRaw ?? null,
          websiteUrlCanonical: website?.websiteUrlCanonical ?? null,
          websiteHost: website?.websiteHost ?? null,
          notes: row.notes || null,
          priceTier: price.priceTier,
          priceLabel: price.priceLabel || null,
          ratingNotes: row.ratingNotes || null,
          createdAt: now,
          updatedAt: now,
        };

        const result = db
          .insert(brands)
          .values(brandData)
          .returning({ id: brands.id })
          .get();

        brandId = result.id;
        rowsInserted++;
      }

      // Link category tags
      for (const cat of categories) {
        const tagId = getOrCreateTag(db, "category", cat.label, cat.slug);
        linkBrandTag(db, brandId, tagId);
      }

      // Link style tags
      for (const style of styles) {
        const tagId = getOrCreateTag(db, "style", style.label, style.slug);
        linkBrandTag(db, brandId, tagId);
      }

      // Link based_in tag
      if (row.basedIn?.trim()) {
        const basedInParsed = parseMultiValue(row.basedIn);
        for (const loc of basedInParsed) {
          const tagId = getOrCreateTag(db, "based_in", loc.label, loc.slug);
          linkBrandTag(db, brandId, tagId);
        }
      }
    } catch (err) {
      const msg = `Row ${i + 2} (${row.brand}): ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      rowsFailed++;
    }
  }

  // Update ingestion run
  db.update(ingestionRuns)
    .set({
      finishedAt: new Date().toISOString(),
      rowsInserted,
      rowsUpdated,
      rowsFailed,
      log: errors.length > 0 ? errors.join("\n") : null,
    })
    .where(eq(ingestionRuns.id, run.id))
    .run();

  return {
    runId: run.id,
    rowsTotal: rows.length,
    rowsInserted,
    rowsUpdated,
    rowsFailed,
    errors,
  };
}
