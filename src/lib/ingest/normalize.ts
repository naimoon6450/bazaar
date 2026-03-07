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
 * Result of parsing a raw price string into normalized parts.
 */
export interface ParsedPrice {
  /** Single numeric value (midpoint if range) */
  amount: number | null;
  /** Lower bound for ranges, same as amount for single values */
  amountMin: number | null;
  /** Upper bound for ranges, same as amount for single values */
  amountMax: number | null;
  /** ISO 4217 currency code */
  currency: string | null;
  /** Original source string */
  raw: string;
}

/** Currency symbol/prefix → ISO code */
const CURRENCY_PATTERNS: [RegExp, string][] = [
  [/^₹/, "INR"],
  [/^Rs\.?\s*/i, "INR"],
  [/^INR\s*/i, "INR"],
  [/^\$/, "USD"],
  [/^USD\s*/i, "USD"],
  [/^US\$\s*/i, "USD"],
  [/^£/, "GBP"],
  [/^GBP\s*/i, "GBP"],
  [/^€/, "EUR"],
  [/^EUR\s*/i, "EUR"],
];

/** Range separators: " - ", " – ", " to " */
const RANGE_SEP = /\s*(?:-|–|to)\s*/i;

/**
 * Strip a currency prefix from a string, returning the currency code and remainder.
 */
function extractCurrency(s: string): { currency: string | null; rest: string } {
  for (const [pattern, code] of CURRENCY_PATTERNS) {
    if (pattern.test(s)) {
      return { currency: code, rest: s.replace(pattern, "").trim() };
    }
  }
  return { currency: null, rest: s };
}

/**
 * Parse a numeric string that may contain commas (e.g. "2,499" or "2,499.00").
 * Returns NaN if unparseable.
 */
function parseNumeric(s: string): number {
  // Strip commas and whitespace
  const cleaned = s.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return NaN;
  return parseFloat(cleaned);
}

/**
 * Parse a raw price string into normalized components.
 *
 * Handles formats like:
 *   "INR 2,499", "Rs. 2499", "₹2499"
 *   "$39", "USD 39", "US$39"
 *   "£50", "GBP 50"
 *   "€30", "EUR 30"
 *   "$20 - $40", "₹1,000 to ₹5,000"
 *   "$$$" (tier-only strings — returns nulls for amounts)
 *
 * For ranges, amount is set to the midpoint.
 */
export function parsePrice(raw: string | undefined | null): ParsedPrice {
  const empty: ParsedPrice = {
    amount: null,
    amountMin: null,
    amountMax: null,
    currency: null,
    raw: raw?.trim() || "",
  };

  if (!raw || !raw.trim()) return empty;

  const trimmed = raw.trim();

  // Skip tier-only strings like "$", "$$", "$$$", "$$$$"
  if (/^\$+$/.test(trimmed)) return { ...empty, raw: trimmed };

  // Skip "N/A" or similar
  if (/^n\/?a$/i.test(trimmed)) return { ...empty, raw: trimmed };

  // Check if it's a range (e.g. "$20 - $40", "₹1,000 to ₹5,000")
  const rangeParts = trimmed.split(RANGE_SEP);

  if (rangeParts.length === 2) {
    const left = extractCurrency(rangeParts[0].trim());
    const right = extractCurrency(rangeParts[1].trim());

    const minVal = parseNumeric(left.rest);
    const maxVal = parseNumeric(right.rest);

    // Use whichever side has a detected currency, prefer left
    const currency = left.currency || right.currency;

    if (!isNaN(minVal) && !isNaN(maxVal) && currency) {
      return {
        amount: Math.round(((minVal + maxVal) / 2) * 100) / 100,
        amountMin: minVal,
        amountMax: maxVal,
        currency,
        raw: trimmed,
      };
    }
  }

  // Single value
  const { currency, rest } = extractCurrency(trimmed);
  const num = parseNumeric(rest);

  if (!isNaN(num) && currency) {
    return {
      amount: num,
      amountMin: num,
      amountMax: num,
      currency,
      raw: trimmed,
    };
  }

  // Could be a bare number with no currency indicator — still extract if numeric
  if (!isNaN(num) && !currency) {
    return {
      amount: num,
      amountMin: num,
      amountMax: num,
      currency: null,
      raw: trimmed,
    };
  }

  // Unparseable — return raw only
  return { ...empty, raw: trimmed };
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
