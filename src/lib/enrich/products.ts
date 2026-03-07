import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { brandProducts, enrichment } from "@/lib/db/schema";

const USER_AGENT =
  "BazaarBot/1.0 (+https://bazaar.site; brand directory crawler)";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  published_at: string | null;
  product_type: string;
  variants: { price: string; available: boolean }[];
  images: { src: string }[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

/**
 * Detect whether a domain is a Shopify store by probing /products.json.
 */
export async function detectShopify(url: string): Promise<boolean> {
  try {
    const base = new URL(url);
    const probeUrl = `${base.protocol}//${base.host}/products.json?limit=1`;

    const res = await fetch(probeUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!res.ok) return false;

    const text = await res.text();
    return text.includes('"products"');
  } catch {
    return false;
  }
}

/**
 * Detect the user-facing domain for a Shopify store.
 * Some stores have geo-redirect scripts that send US users to a different domain.
 * We check the homepage HTML for redirect patterns like `redirectTo('domain.us')`.
 */
async function resolveUserFacingDomain(base: URL): Promise<string> {
  try {
    const res = await fetch(`${base.protocol}//${base.host}/`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!res.ok) return base.host;

    const html = await res.text();

    // Look for geo-redirect patterns targeting US users
    // Common patterns:
    //   country === 'US' && host !== 'domain.us') { redirectTo('domain.us')
    //   "US": "domain.us"
    const usRedirectMatch = html.match(
      /country\s*===?\s*['"]US['"][\s\S]*?redirectTo\(['"]([^'"]+)['"]\)/
    );
    if (usRedirectMatch) {
      const usDomain = usRedirectMatch[1];
      // Verify this domain actually has /products.json
      try {
        const probe = await fetch(
          `${base.protocol}//${usDomain}/products.json?limit=1`,
          {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (probe.ok) return usDomain;
      } catch {
        // US domain doesn't work, fall back to original
      }
    }
  } catch {
    // Can't fetch homepage, use original domain
  }

  return base.host;
}

/**
 * Fetch products from a Shopify store and upsert into brand_products.
 * Returns number of products stored.
 */
export async function fetchProducts(
  brandId: number,
  websiteUrl: string,
  limit: number = 8
): Promise<{ count: number; error: string | null }> {
  const db = getDb();

  let base: URL;
  try {
    base = new URL(websiteUrl);
  } catch {
    return { count: 0, error: `Invalid URL: ${websiteUrl}` };
  }

  // Detect if this store redirects US users to a different domain
  const userFacingHost = await resolveUserFacingDomain(base);
  const hasSeparateStorefronts = userFacingHost !== base.host;

  // Fetch products from the USER-FACING domain (US storefront if it exists).
  // This gives us the prices a US shopper will actually see on checkout.
  const fetchLimit = limit + 8;
  const productsUrl = `${base.protocol}//${userFacingHost}/products.json?limit=${fetchLimit}`;

  let data: ShopifyProductsResponse;
  try {
    const res = await fetch(productsUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!res.ok) {
      return { count: 0, error: `HTTP ${res.status} from ${productsUrl}` };
    }

    data = (await res.json()) as ShopifyProductsResponse;
  } catch (err) {
    return {
      count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!data.products || data.products.length === 0) {
    return { count: 0, error: null };
  }

  // Detect display currency from the user-facing domain
  const firstHandle = data.products.find((p) => p.handle)?.handle;
  let displayCurrency: string;
  if (firstHandle) {
    displayCurrency = await detectStoreCurrency(
      `${base.protocol}//${userFacingHost}/products/${firstHandle}`,
      userFacingHost
    );
  } else {
    displayCurrency = detectCurrencyHeuristic(userFacingHost);
  }

  // If there's a separate origin storefront, detect its currency and
  // build a price map by handle for origin prices
  let originCurrency: string | null = null;
  const originPriceByHandle = new Map<string, string>();

  if (hasSeparateStorefronts) {
    // Detect origin currency
    const originProbeHandle = firstHandle; // same product name may differ, but try
    if (originProbeHandle) {
      originCurrency = await detectStoreCurrency(
        `${base.protocol}//${base.host}/products/${originProbeHandle}`,
        base.host
      );
      // If heuristic-only result matches display, it's not useful
      if (originCurrency === displayCurrency) originCurrency = null;
    }

    // Fetch origin products for origin prices
    if (originCurrency) {
      try {
        const originUrl = `${base.protocol}//${base.host}/products.json?limit=${fetchLimit}`;
        const originRes = await fetch(originUrl, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
          redirect: "follow",
        });
        if (originRes.ok) {
          const originData = (await originRes.json()) as ShopifyProductsResponse;
          // Match by title since handles/IDs differ across storefronts
          for (const p of originData.products || []) {
            const price = p.variants?.[0]?.price;
            if (price) originPriceByHandle.set(p.title, price);
          }
        }
      } catch {
        // Origin fetch failed — we'll just have display prices
      }
    }
  }

  // Clear existing products for this brand (replace strategy)
  db.delete(brandProducts).where(eq(brandProducts.brandId, brandId)).run();

  const now = new Date().toISOString();
  let count = 0;

  for (const product of data.products) {
    // Stop once we have enough valid products
    if (count >= limit) break;

    // Skip products with no images
    const imageUrl = product.images?.[0]?.src;
    if (!imageUrl) continue;

    // Skip unpublished products
    if (!product.published_at) continue;

    // Skip products where no variant is available
    const hasAvailable = product.variants?.some((v) => v.available);
    if (!hasAvailable) continue;

    const productUrl = `${base.protocol}//${userFacingHost}/products/${product.handle}`;

    // Verify the product page actually exists
    try {
      const checkRes = await fetch(`${productUrl}.json`, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });
      if (!checkRes.ok) continue;
    } catch {
      continue;
    }

    const price = product.variants?.[0]?.price || null;

    // Look up origin price by title match
    const originPrice = originPriceByHandle.get(product.title) || null;

    db.insert(brandProducts)
      .values({
        brandId,
        externalId: String(product.id),
        title: product.title,
        imageUrl,
        price,
        currency: displayCurrency,
        priceOrigin: originPrice,
        currencyOrigin: originPrice ? originCurrency : null,
        productUrl,
        productType: product.product_type || null,
        fetchedAt: now,
      })
      .run();

    count++;
  }

  return { count, error: null };
}

/**
 * Detect the store's currency by scraping JSON-LD structured data from a product page.
 * Falls back to a domain + magnitude heuristic if JSON-LD is unavailable.
 */
async function detectStoreCurrency(
  productPageUrl: string,
  host: string
): Promise<string> {
  try {
    const res = await fetch(productPageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (res.ok) {
      const html = await res.text();

      // Extract JSON-LD blocks and look for priceCurrency
      const jsonLdPattern =
        /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;

      while ((match = jsonLdPattern.exec(html)) !== null) {
        try {
          const data = JSON.parse(match[1]);

          // priceCurrency can be at top level or nested in offers
          const currency =
            data?.priceCurrency ||
            data?.offers?.priceCurrency ||
            (Array.isArray(data?.offers) && data.offers[0]?.priceCurrency);

          if (currency && typeof currency === "string") {
            return currency.toUpperCase();
          }
        } catch {
          // Malformed JSON-LD block, try next one
        }
      }

      // Fallback: look for Shopify's inline currency meta/config
      const metaCurrencyMatch = html.match(
        /\"currency\"\s*:\s*\"([A-Z]{3})\"/
      );
      if (metaCurrencyMatch) {
        return metaCurrencyMatch[1];
      }
    }
  } catch {
    // Network error, fall through to heuristic
  }

  return detectCurrencyHeuristic(host);
}

/**
 * Fallback heuristic based on domain TLD.
 */
function detectCurrencyHeuristic(host: string): string {
  if (host.endsWith(".in")) return "INR";
  if (host.endsWith(".co.uk") || host.endsWith(".uk")) return "GBP";
  if (host.endsWith(".eu")) return "EUR";
  return "USD";
}

/**
 * Update the is_shopify flag on the enrichment record.
 */
export function setShopifyFlag(brandId: number, isShopify: boolean): void {
  const db = getDb();

  const existing = db
    .select({ brandId: enrichment.brandId })
    .from(enrichment)
    .where(eq(enrichment.brandId, brandId))
    .get();

  if (existing) {
    db.update(enrichment)
      .set({ isShopify: isShopify ? 1 : 0 })
      .where(eq(enrichment.brandId, brandId))
      .run();
  }
}
