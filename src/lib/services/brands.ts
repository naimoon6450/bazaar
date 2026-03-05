import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { brands, tags, brandTags, enrichment, brandProducts } from "@/lib/db/schema";

export interface BrandListParams {
  q?: string;
  cat?: string;
  style?: string;
  based?: string;
  price?: string;
  sort?: "az" | "za" | "updated";
  limit?: number;
  offset?: number;
}

export interface BrandListItem {
  id: number;
  name: string;
  slug: string;
  basedIn: string | null;
  websiteUrlCanonical: string | null;
  websiteHost: string | null;
  notes: string | null;
  priceTier: number | null;
  priceLabel: string | null;
  tags: { type: string; label: string; slug: string }[];
  thumbnailUrl: string | null;
}

export interface ProductItem {
  title: string;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  productUrl: string;
  productType: string | null;
}

export interface BrandDetail extends BrandListItem {
  websiteUrlRaw: string | null;
  ratingNotes: string | null;
  createdAt: string;
  updatedAt: string;
  enrichment: {
    title: string | null;
    metaDescription: string | null;
    ogImageUrl: string | null;
    httpStatus: number | null;
    lastCheckedAt: string | null;
  } | null;
  products: ProductItem[];
  similarBrands: BrandListItem[];
}

/**
 * List brands with filtering, search, sorting, and pagination.
 */
export function listBrands(params: BrandListParams): {
  brands: BrandListItem[];
  total: number;
} {
  const db = getDb();
  const limit = Math.min(params.limit || 24, 100);
  const offset = params.offset || 0;

  // Build conditions dynamically via raw SQL for flexibility
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (params.q) {
    conditions.push("b.name LIKE ?");
    bindings.push(`%${params.q}%`);
  }

  if (params.price) {
    const tiers = params.price
      .split(",")
      .map((t) => parseInt(t, 10))
      .filter((t) => t >= 1 && t <= 4);
    if (tiers.length > 0) {
      conditions.push(
        `b.price_tier IN (${tiers.map(() => "?").join(",")})`
      );
      bindings.push(...tiers);
    }
  }

  // Tag filters: brand must have ALL specified tag slugs of the given type
  const tagFilters: { type: string; slugs: string[] }[] = [];
  if (params.cat) tagFilters.push({ type: "category", slugs: params.cat.split(",") });
  if (params.style) tagFilters.push({ type: "style", slugs: params.style.split(",") });
  if (params.based) tagFilters.push({ type: "based_in", slugs: params.based.split(",") });

  for (const tf of tagFilters) {
    for (const slug of tf.slugs) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM brand_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE bt.brand_id = b.id AND t.type = ? AND t.slug = ?
        )
      `);
      bindings.push(tf.type, slug);
    }
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Sorting
  let orderClause: string;
  switch (params.sort) {
    case "za":
      orderClause = "ORDER BY b.name COLLATE NOCASE DESC";
      break;
    case "updated":
      orderClause = "ORDER BY b.updated_at DESC";
      break;
    default:
      orderClause = "ORDER BY b.name COLLATE NOCASE ASC";
  }

  const allBindings = [...bindings];
  const mainQuery = `
    SELECT b.id, b.name, b.slug, b.based_in, b.website_url_canonical,
           b.website_host, b.notes, b.price_tier, b.price_label
    FROM brands b
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;
  allBindings.push(limit, offset);

  const countQuery = `SELECT COUNT(*) as count FROM brands b ${whereClause}`;

  // Use better-sqlite3 directly for parameterized raw queries
  const Database = require("better-sqlite3");
  const path = require("path");
  const dbPath =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "bazaar.db");
  const sqlite = new Database(dbPath, { readonly: true });

  try {
    const total =
      (sqlite.prepare(countQuery).get(...bindings) as { count: number })
        ?.count ?? 0;

    const brandRows = sqlite.prepare(mainQuery).all(...allBindings) as {
      id: number;
      name: string;
      slug: string;
      based_in: string | null;
      website_url_canonical: string | null;
      website_host: string | null;
      notes: string | null;
      price_tier: number | null;
      price_label: string | null;
    }[];

    // Fetch tags for all brands in one query
    const brandIds = brandRows.map((b) => b.id);
    let tagMap: Map<number, { type: string; label: string; slug: string }[]> =
      new Map();

    if (brandIds.length > 0) {
      const placeholders = brandIds.map(() => "?").join(",");
      const tagRows = sqlite
        .prepare(
          `SELECT bt.brand_id, t.type, t.label, t.slug
           FROM brand_tags bt JOIN tags t ON t.id = bt.tag_id
           WHERE bt.brand_id IN (${placeholders})`
        )
        .all(...brandIds) as {
        brand_id: number;
        type: string;
        label: string;
        slug: string;
      }[];

      for (const tr of tagRows) {
        const existing = tagMap.get(tr.brand_id) || [];
        existing.push({ type: tr.type, label: tr.label, slug: tr.slug });
        tagMap.set(tr.brand_id, existing);
      }
    }

    // Fetch first product thumbnail per brand
    const thumbMap = new Map<number, string>();
    if (brandIds.length > 0) {
      const thumbPlaceholders = brandIds.map(() => "?").join(",");
      const thumbRows = sqlite
        .prepare(
          `SELECT brand_id, image_url FROM brand_products
           WHERE brand_id IN (${thumbPlaceholders})
           GROUP BY brand_id
           HAVING MIN(id)`
        )
        .all(...brandIds) as { brand_id: number; image_url: string }[];

      for (const tr of thumbRows) {
        if (tr.image_url) thumbMap.set(tr.brand_id, tr.image_url);
      }
    }

    // also get og:image from enrichment as fallback
    const enrichMap = new Map<number, string>();
    if (brandIds.length > 0) {
      const enrichPlaceholders = brandIds.map(() => "?").join(",");
      const enrichRows = sqlite
        .prepare(
          `SELECT brand_id, og_image_url FROM enrichment
           WHERE brand_id IN (${enrichPlaceholders}) AND og_image_url IS NOT NULL`
        )
        .all(...brandIds) as { brand_id: number; og_image_url: string }[];
      for (const er of enrichRows) {
        if (er.og_image_url) enrichMap.set(er.brand_id, er.og_image_url);
      }
    }

    const result: BrandListItem[] = brandRows.map((b) => {
      // prefer a product thumbnail, otherwise use enrichment og:image
      const prodThumb = thumbMap.get(b.id) || null;
      const enrichThumb = enrichMap.get(b.id) || null;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        basedIn: b.based_in,
        websiteUrlCanonical: b.website_url_canonical,
        websiteHost: b.website_host,
        notes: b.notes,
        priceTier: b.price_tier,
        priceLabel: b.price_label,
        tags: tagMap.get(b.id) || [],
        thumbnailUrl: prodThumb || enrichThumb,
      };
    });

    return { brands: result, total };
  } finally {
    sqlite.close();
  }
}

/**
 * Get a single brand by slug with full detail.
 */
export function getBrandBySlug(slug: string): BrandDetail | null {
  const db = getDb();

  const brand = db
    .select()
    .from(brands)
    .where(eq(brands.slug, slug))
    .get();

  if (!brand) return null;

  // Get tags
  const brandTagRows = db
    .select({
      type: tags.type,
      label: tags.label,
      slug: tags.slug,
    })
    .from(brandTags)
    .innerJoin(tags, eq(tags.id, brandTags.tagId))
    .where(eq(brandTags.brandId, brand.id))
    .all();

  // Get enrichment data
  const enrichmentData = db
    .select()
    .from(enrichment)
    .where(eq(enrichment.brandId, brand.id))
    .get();

  // Find similar brands by shared style tags
  const styleTags = brandTagRows
    .filter((t) => t.type === "style")
    .map((t) => t.slug);

  let similarBrands: BrandListItem[] = [];
  if (styleTags.length > 0) {
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath =
      process.env.DATABASE_PATH ||
      path.join(process.cwd(), "data", "bazaar.db");
    const sqlite = new Database(dbPath, { readonly: true });

    try {
      const placeholders = styleTags.map(() => "?").join(",");
      const similarRows = sqlite
        .prepare(
          `SELECT b.id, b.name, b.slug, b.based_in, b.website_url_canonical,
                  b.website_host, b.notes, b.price_tier, b.price_label,
                  COUNT(DISTINCT t.slug) as shared_tags
           FROM brands b
           JOIN brand_tags bt ON bt.brand_id = b.id
           JOIN tags t ON t.id = bt.tag_id AND t.type = 'style'
           WHERE t.slug IN (${placeholders}) AND b.id != ?
           GROUP BY b.id
           ORDER BY shared_tags DESC, b.name COLLATE NOCASE ASC
           LIMIT 6`
        )
        .all(...styleTags, brand.id) as (Record<string, unknown> & {
        id: number;
        name: string;
        slug: string;
      })[];

      // Get tags for similar brands
      const simIds = similarRows.map((r) => r.id);
      let simTagMap = new Map<
        number,
        { type: string; label: string; slug: string }[]
      >();

      if (simIds.length > 0) {
        const simPlaceholders = simIds.map(() => "?").join(",");
        const simTagRows = sqlite
          .prepare(
            `SELECT bt.brand_id, t.type, t.label, t.slug
             FROM brand_tags bt JOIN tags t ON t.id = bt.tag_id
             WHERE bt.brand_id IN (${simPlaceholders})`
          )
          .all(...simIds) as {
          brand_id: number;
          type: string;
          label: string;
          slug: string;
        }[];

        for (const tr of simTagRows) {
          const existing = simTagMap.get(tr.brand_id) || [];
          existing.push({ type: tr.type, label: tr.label, slug: tr.slug });
          simTagMap.set(tr.brand_id, existing);
        }
      }

      // Fetch thumbnails for similar brands
      const simThumbMap = new Map<number, string>();
      if (simIds.length > 0) {
        const simThumbPlaceholders = simIds.map(() => "?").join(",");
        const simThumbRows = sqlite
          .prepare(
            `SELECT brand_id, image_url FROM brand_products
             WHERE brand_id IN (${simThumbPlaceholders})
             GROUP BY brand_id
             HAVING MIN(id)`
          )
          .all(...simIds) as { brand_id: number; image_url: string }[];

        for (const tr of simThumbRows) {
          if (tr.image_url) simThumbMap.set(tr.brand_id, tr.image_url);
        }
      }

      similarBrands = similarRows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        basedIn: r.based_in as string | null,
        websiteUrlCanonical: r.website_url_canonical as string | null,
        websiteHost: r.website_host as string | null,
        notes: r.notes as string | null,
        priceTier: r.price_tier as number | null,
        priceLabel: r.price_label as string | null,
        tags: simTagMap.get(r.id) || [],
        thumbnailUrl: simThumbMap.get(r.id) || null,
      }));
    } finally {
      sqlite.close();
    }
  }

  // Get products
  const productRows = db
    .select({
      title: brandProducts.title,
      imageUrl: brandProducts.imageUrl,
      price: brandProducts.price,
      currency: brandProducts.currency,
      productUrl: brandProducts.productUrl,
      productType: brandProducts.productType,
    })
    .from(brandProducts)
    .where(eq(brandProducts.brandId, brand.id))
    .all();

  // Get first product thumbnail for the brand
  const thumbnailUrl = productRows[0]?.imageUrl || null;

  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    basedIn: brand.basedIn,
    websiteUrlRaw: brand.websiteUrlRaw,
    websiteUrlCanonical: brand.websiteUrlCanonical,
    websiteHost: brand.websiteHost,
    notes: brand.notes,
    priceTier: brand.priceTier,
    priceLabel: brand.priceLabel,
    ratingNotes: brand.ratingNotes,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
    tags: brandTagRows,
    thumbnailUrl,
    enrichment: enrichmentData
      ? {
          title: enrichmentData.title,
          metaDescription: enrichmentData.metaDescription,
          ogImageUrl: enrichmentData.ogImageUrl,
          httpStatus: enrichmentData.httpStatus,
          lastCheckedAt: enrichmentData.lastCheckedAt,
        }
      : null,
    products: productRows,
    similarBrands,
  };
}

/**
 * Get all tags grouped by type.
 */
export function getAllTags(): {
  categories: { label: string; slug: string; count: number }[];
  styles: { label: string; slug: string; count: number }[];
  basedIn: { label: string; slug: string; count: number }[];
} {
  const Database = require("better-sqlite3");
  const path = require("path");
  const dbPath =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "bazaar.db");
  const sqlite = new Database(dbPath, { readonly: true });

  try {
    const rows = sqlite
      .prepare(
        `SELECT t.type, t.label, t.slug, COUNT(bt.brand_id) as count
         FROM tags t
         LEFT JOIN brand_tags bt ON bt.tag_id = t.id
         GROUP BY t.id
         HAVING count > 0
         ORDER BY t.label COLLATE NOCASE ASC`
      )
      .all() as {
      type: string;
      label: string;
      slug: string;
      count: number;
    }[];

    return {
      categories: rows.filter((r) => r.type === "category"),
      styles: rows.filter((r) => r.type === "style"),
      basedIn: rows.filter((r) => r.type === "based_in"),
    };
  } finally {
    sqlite.close();
  }
}
