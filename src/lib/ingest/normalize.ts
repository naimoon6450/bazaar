import slugifyLib from "slugify";

/**
 * Slugify a string: lowercase, hyphenated, no parens, no special chars.
 */
export function slugify(input: string): string {
  return slugifyLib(input, { lower: true, strict: true, trim: true });
}

/**
 * Split a multi-value field by comma, trim, deduplicate case-insensitive.
 * Returns array of { label, slug } pairs.
 */
export function parseMultiValue(
  raw: string | undefined | null
): { label: string; slug: string }[] {
  if (!raw || !raw.trim()) return [];

  const seen = new Set<string>();
  const results: { label: string; slug: string }[] = [];

  for (const part of raw.split(",")) {
    const label = part.trim();
    if (!label) continue;

    const slug = slugify(label);
    if (seen.has(slug)) continue;

    seen.add(slug);
    results.push({ label, slug });
  }

  return results;
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "srsltid",
  "gclid",
  "fbclid",
]);

/**
 * Normalize a website URL:
 * - Add https:// if missing
 * - Strip tracking params
 * - Return raw, canonical, and host
 */
export function normalizeWebsite(raw: string | undefined | null): {
  websiteUrlRaw: string;
  websiteUrlCanonical: string;
  websiteHost: string;
} | null {
  if (!raw || !raw.trim()) return null;

  let urlStr = raw.trim();

  // Detect social media handles (e.g. @username) — not a URL
  if (/^@[\w.]+$/.test(urlStr)) return null;

  // Store the raw input
  const websiteUrlRaw = urlStr;

  // Add protocol if missing
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { websiteUrlRaw, websiteUrlCanonical: urlStr, websiteHost: "" };
  }

  // Strip tracking params
  for (const param of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(param.toLowerCase())) {
      url.searchParams.delete(param);
    }
  }

  // Remove trailing hash if empty
  const canonical = url.toString().replace(/#$/, "");

  return {
    websiteUrlRaw,
    websiteUrlCanonical: canonical,
    websiteHost: url.hostname,
  };
}

/**
 * Parse price string to numeric tier.
 * Count $ signs -> tier 1-4.
 */
export function parsePriceTier(raw: string | undefined | null): {
  priceTier: number | null;
  priceLabel: string;
} {
  if (!raw || !raw.trim()) return { priceTier: null, priceLabel: "" };

  const label = raw.trim();
  const dollarCount = (label.match(/\$/g) || []).length;

  return {
    priceTier: dollarCount > 0 ? Math.min(dollarCount, 4) : null,
    priceLabel: label,
  };
}

/**
 * Generate a unique slug with deterministic collision handling.
 * Appends -2, -3, etc. if slug already exists.
 */
export function makeUniqueSlug(
  base: string,
  existingSlugs: Set<string>
): string {
  const baseSlug = slugify(base);
  if (!existingSlugs.has(baseSlug)) return baseSlug;

  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-${counter}`;
}
