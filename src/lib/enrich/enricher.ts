import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { brands, enrichment } from "@/lib/db/schema";
import { detectShopify, fetchProducts, setShopifyFlag } from "./products";

const USER_AGENT = "BazaarBot/1.0 (+https://bazaar.site; brand directory crawler)";
const RECHECK_DAYS = 14;
const RETRY_DAYS = 3;
const BATCH_SIZE = 30;
const PER_DOMAIN_DELAY_MS = 1000;
const CONCURRENCY = 5;

interface EnrichResult {
  brandId: number;
  httpStatus: number | null;
  finalUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  etag: string | null;
  lastModified: string | null;
  error: string | null;
}

/**
 * Fetch metadata from a single URL.
 */
async function fetchMetadata(
  url: string,
  existingEtag?: string | null,
  existingLastModified?: string | null
): Promise<Omit<EnrichResult, "brandId">> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/html",
  };

  // Respect 304 — send conditional headers if we have them
  if (existingEtag) headers["If-None-Match"] = existingEtag;
  if (existingLastModified) headers["If-Modified-Since"] = existingLastModified;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 304) {
      return {
        httpStatus: 304,
        finalUrl: res.url || url,
        title: null,
        metaDescription: null,
        ogImageUrl: null,
        etag: existingEtag || null,
        lastModified: existingLastModified || null,
        error: null,
      };
    }

    const html = await res.text();

    // Parse basic metadata from HTML
    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription =
      extractMeta(html, "description") || extractMeta(html, "og:description");
    const ogImage = extractMeta(html, "og:image");

    return {
      httpStatus: res.status,
      finalUrl: res.url || url,
      title: title?.slice(0, 500) || null,
      metaDescription: metaDescription?.slice(0, 1000) || null,
      ogImageUrl: ogImage?.slice(0, 2000) || null,
      etag: res.headers.get("etag") || null,
      lastModified: res.headers.get("last-modified") || null,
      error: null,
    };
  } catch (err) {
    return {
      httpStatus: null,
      finalUrl: null,
      title: null,
      metaDescription: null,
      ogImageUrl: null,
      etag: null,
      lastModified: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function extractTag(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match?.[1]?.trim().replace(/\s+/g, " ") || null;
}

function extractMeta(html: string, name: string): string | null {
  // Match both name= and property= attributes
  const regex = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return match[1].trim();

  // Try reversed order (content before name)
  const regex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  return match2?.[1]?.trim() || null;
}

/**
 * Get brands that need enrichment checking.
 */
export function getBrandsToEnrich(forceAll = false): {
  brandId: number;
  url: string;
  host: string;
  existingEtag: string | null;
  existingLastModified: string | null;
}[] {
  const db = getDb();

  // If forceAll is true, get all brands with websites
  if (forceAll) {
    const Database = require("better-sqlite3");
    const path = require("path");
    const dbPath =
      process.env.DATABASE_PATH ||
      path.join(process.cwd(), "data", "bazaar.db");
    const sqlite = new Database(dbPath, { readonly: true });

    try {
      const rows = sqlite
        .prepare(
          `SELECT b.id as brand_id, b.website_url_canonical as url,
                  b.website_host as host, e.etag, e.last_modified
           FROM brands b
           LEFT JOIN enrichment e ON e.brand_id = b.id
           WHERE b.website_url_canonical IS NOT NULL
           ORDER BY b.id`
        )
        .all() as {
        brand_id: number;
        url: string;
        host: string;
        etag: string | null;
        last_modified: string | null;
      }[];

      return rows.map((r) => ({
        brandId: r.brand_id,
        url: r.url,
        host: r.host || "",
        existingEtag: r.etag,
        existingLastModified: r.last_modified,
      }));
    } finally {
      sqlite.close();
    }
  }

  // Original logic for selective enrichment
  const now = new Date();

  const recheckCutoff = new Date(
    now.getTime() - RECHECK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const retryCutoff = new Date(
    now.getTime() - RETRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // Use raw SQL for the complex LEFT JOIN query
  const Database = require("better-sqlite3");
  const path = require("path");
  const dbPath =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "bazaar.db");
  const sqlite = new Database(dbPath, { readonly: true });

  try {
    const rows = sqlite
      .prepare(
        `SELECT b.id as brand_id, b.website_url_canonical as url,
                b.website_host as host, e.etag, e.last_modified,
                e.last_checked_at, e.error
         FROM brands b
         LEFT JOIN enrichment e ON e.brand_id = b.id
         WHERE b.website_url_canonical IS NOT NULL
           AND (
             e.brand_id IS NULL
             OR (e.error IS NULL AND e.last_checked_at < ?)
             OR (e.error IS NOT NULL AND e.last_checked_at < ?)
           )
         ORDER BY e.last_checked_at ASC NULLS FIRST
         LIMIT ?`
      )
      .all(recheckCutoff, retryCutoff, BATCH_SIZE) as {
      brand_id: number;
      url: string;
      host: string;
      etag: string | null;
      last_modified: string | null;
    }[];

    return rows.map((r) => ({
      brandId: r.brand_id,
      url: r.url,
      host: r.host || "",
      existingEtag: r.etag,
      existingLastModified: r.last_modified,
    }));
  } finally {
    sqlite.close();
  }
}

/**
 * Enrich a single brand by ID.
 */
export async function enrichOne(brandId: number): Promise<EnrichResult> {
  const db = getDb();

  const brand = db
    .select({
      id: brands.id,
      url: brands.websiteUrlCanonical,
    })
    .from(brands)
    .where(eq(brands.id, brandId))
    .get();

  if (!brand || !brand.url) {
    return {
      brandId,
      httpStatus: null,
      finalUrl: null,
      title: null,
      metaDescription: null,
      ogImageUrl: null,
      etag: null,
      lastModified: null,
      error: "Brand not found or has no URL",
    };
  }

  const existing = db
    .select()
    .from(enrichment)
    .where(eq(enrichment.brandId, brandId))
    .get();

  const result = await fetchMetadata(
    brand.url,
    existing?.etag,
    existing?.lastModified
  );

  const now = new Date().toISOString();

  // Upsert enrichment record
  const data = {
    brandId,
    lastCheckedAt: now,
    httpStatus: result.httpStatus,
    finalUrl: result.finalUrl,
    title: result.httpStatus === 304 ? existing?.title ?? null : result.title,
    metaDescription:
      result.httpStatus === 304
        ? existing?.metaDescription ?? null
        : result.metaDescription,
    ogImageUrl:
      result.httpStatus === 304
        ? existing?.ogImageUrl ?? null
        : result.ogImageUrl,
    etag: result.etag,
    lastModified: result.lastModified,
    error: result.error,
  };

  if (existing) {
    db.update(enrichment)
      .set(data)
      .where(eq(enrichment.brandId, brandId))
      .run();
  } else {
    db.insert(enrichment).values(data).run();
  }

  // Shopify detection + product fetching
  // Only run detection if we haven't checked yet (isShopify is null)
  const enrichRecord = db
    .select({ isShopify: enrichment.isShopify })
    .from(enrichment)
    .where(eq(enrichment.brandId, brandId))
    .get();

  const shopifyKnown = enrichRecord?.isShopify !== null && enrichRecord?.isShopify !== undefined;

  if (!shopifyKnown && brand.url) {
    const isShopify = await detectShopify(brand.url);
    setShopifyFlag(brandId, isShopify);

    if (isShopify) {
      await fetchProducts(brandId, brand.url);
    }
  } else if (enrichRecord?.isShopify === 1 && brand.url) {
    // Already known Shopify — refresh products
    await fetchProducts(brandId, brand.url);
  }

  return { brandId, ...result };
}

/**
 * Run a batch enrichment with per-domain delay and concurrency cap.
 */
export async function enrichBatch(forceAll = false): Promise<{
  processed: number;
  errors: number;
}> {
  const toEnrich = getBrandsToEnrich(forceAll);

  if (toEnrich.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let errors = 0;

  // Group by host to apply per-domain delay
  const domainLastFetch = new Map<string, number>();

  // Process with concurrency limit
  const queue = [...toEnrich];
  const active: Promise<void>[] = [];

  const processOne = async (item: (typeof toEnrich)[0]) => {
    // Per-domain delay
    const lastFetch = domainLastFetch.get(item.host) || 0;
    const timeSince = Date.now() - lastFetch;
    if (timeSince < PER_DOMAIN_DELAY_MS) {
      await new Promise((r) => setTimeout(r, PER_DOMAIN_DELAY_MS - timeSince));
    }

    domainLastFetch.set(item.host, Date.now());

    try {
      const result = await enrichOne(item.brandId);
      if (result.error) errors++;
    } catch {
      errors++;
    }
  };

  // Simple concurrency pool
  for (const item of queue) {
    const promise = processOne(item).then(() => {
      active.splice(active.indexOf(promise), 1);
    });
    active.push(promise);

    if (active.length >= CONCURRENCY) {
      await Promise.race(active);
    }
  }

  await Promise.all(active);

  return { processed: toEnrich.length, errors };
}
