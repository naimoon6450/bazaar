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
 * Detect whether a domain is a Shopify store by probing /products.json and checking HTML.
 */
export async function detectShopify(url: string): Promise<boolean> {
  try {
    const base = new URL(url);
    const probeUrl = `${base.protocol}//${base.host}/products.json?limit=1`;

    // First try the standard products.json endpoint
    const res = await fetch(probeUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (res.ok) {
      const text = await res.text();
      if (text.includes('"products"')) return true;
    }

    // If that fails, check the homepage HTML for Shopify indicators
    const homeRes = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (homeRes.ok) {
      const html = await homeRes.text();
      // Check for various Shopify indicators
      const shopifyIndicators = [
        'shopify',
        'Shopify',
        'cdn.shopify.com',
        'shopifyapps.com',
        'myshopify.com',
        'ForestShopify', // For Forest CMS
        'data-shopify' // HTML attributes
      ];

      return shopifyIndicators.some(indicator => html.includes(indicator));
    }

    return false;
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

  // Fetch more than needed to account for unavailable/hidden products
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

  // Clear existing products for this brand (replace strategy)
  db.delete(brandProducts).where(eq(brandProducts.brandId, brandId)).run();

  const now = new Date().toISOString();

  // Filter valid products: has image, published, and available variants
  const validProducts = data.products.filter((product) => {
    // Must have image
    if (!product.images?.[0]?.src) return false;
    // Must be published
    if (!product.published_at) return false;
    // Must have available variant
    if (!product.variants?.some((v) => v.available)) return false;
    return true;
  });

  // Sort by published_at DESC (newest first)
  validProducts.sort(
    (a, b) =>
      new Date(b.published_at || 0).getTime() -
      new Date(a.published_at || 0).getTime()
  );

  let count = 0;

  for (const product of validProducts) {
    // Stop once we have enough valid products
    if (count >= limit) break;

    const imageUrl = product.images?.[0]?.src!;
    const productUrl = `${base.protocol}//${userFacingHost}/products/${product.handle}`;

    // Verify the product page actually exists via its .json endpoint
    // (catches geo-locked, Locksmith-hidden, and soft-404 pages)
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

    db.insert(brandProducts)
      .values({
        brandId,
        externalId: String(product.id),
        title: product.title,
        imageUrl,
        price,
        currency: detectCurrency(price, userFacingHost),
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
 * Simple currency heuristic based on domain and price magnitude.
 * Indian domains (.in) with high prices are likely INR.
 */
function detectCurrency(price: string | null, host: string): string {
  if (!price) return "USD";

  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return "USD";

  // Indian domains with prices > 500 are almost certainly INR
  if (host.endsWith(".in") && numPrice > 500) return "INR";

  // Other high-value indicators for INR
  if (host.endsWith(".in") && numPrice > 100) return "INR";

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
