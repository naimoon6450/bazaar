# BAZAAR — Progress Tracker

## Completed

### Foundation (Phase 0)
- [x] Next.js 16 + TypeScript + Tailwind + shadcn/ui scaffold
- [x] SQLite database with Drizzle ORM (better-sqlite3 for local dev)
- [x] Database schema: brands, tags, brand_tags, enrichment, ingestion_runs
- [x] CSV/XLSX ingestion pipeline (parse, normalize, import)
- [x] Normalization: URL cleaning, tracking param stripping, price tier parsing, slugification
- [x] 156 brands imported from source CSV (zero failures)
- [x] Public APIs: GET /api/brands (filtered, paginated, sorted), GET /api/brands/[slug], GET /api/tags
- [x] Directory homepage: search, sidebar filters (category, style, location, price), grid/table toggle, sort, URL persistence
- [x] Brand detail page: hero, metadata, tags, similar brands (weighted by shared style tags)
- [x] Admin panel: password login, CSV/XLSX upload + import report, brand edit drawer, enrichment trigger
- [x] Enrichment pipeline: metadata fetch (title, description, og:image, ETag, 304 support), batch processing with concurrency/domain delay
- [x] Cron endpoint for scheduled enrichment
- [x] Light/dark theme toggle
- [x] Shopify detection scan: 117/156 brands (75%) confirmed Shopify

### Enrichment v1
- [x] Single brand enrichment test (11.11 Clothing — HTTP 200, title, description, og:image fetched)
- [x] og:image hero + meta description rendered on brand detail page

---

## In Progress

### Phase 1 — Shopify Product Sampling

Goal: Fetch 6-8 products per Shopify brand via `/products.json`, display product gallery on brand detail pages, and product thumbnails on homepage brand cards.

#### Schema changes
- [ ] Add `brand_products` table (id, brand_id, external_id, title, image_url, price, currency, product_url, product_type, fetched_at)
- [ ] Add `is_shopify` flag to `enrichment` table
- [ ] Run migration

#### Product fetcher service (`src/lib/enrich/products.ts`)
- [ ] `detectShopify(url)` — probe `/products.json?limit=1`
- [ ] `fetchProducts(brandId, domain, limit=8)` — fetch, parse, upsert into `brand_products`
- [ ] Map Shopify response: product.id, title, images[0].src, variants[0].price, handle → product URL, product_type
- [ ] Clear stale products before inserting (replace strategy)
- [ ] Respect same concurrency/delay rules as metadata enrichment

#### Integration with enrichment (`src/lib/enrich/enricher.ts`)
- [ ] During `enrichOne()`, detect Shopify if not yet flagged
- [ ] If Shopify, fetch products after metadata enrichment
- [ ] Store `is_shopify` on enrichment record

#### Brand service updates (`src/lib/services/brands.ts`)
- [ ] Add `products` array to `BrandDetail` interface
- [ ] Query `brand_products` in `getBrandBySlug()`, include in response
- [ ] Add first product image per brand to `listBrands()` for homepage thumbnails

#### Brand detail UI (`src/components/brand-detail.tsx`)
- [ ] Product gallery grid: 2x4 desktop, 2x2 mobile
- [ ] Product card: image (3:4 aspect ratio), title, price, external "Shop" link
- [ ] When products exist, show product grid; otherwise fall back to og:image hero

#### Brand card UI (`src/components/brand-card.tsx`)
- [ ] Show first product image as thumbnail at top of card on homepage grid
- [ ] Graceful fallback when no products available

#### Testing
- [ ] Enrich + fetch products for 1 brand, verify on detail page
- [ ] Run batch for all 117 Shopify brands
- [ ] Verify homepage cards show thumbnails
- [ ] Build compiles cleanly

---

## Planned

### Phase 2 — Cross-brand product browsing
- [ ] New `/shop` page aggregating products across all brands
- [ ] Filter by category, style, actual product price range
- [ ] Product cards: image, brand name, product name, price, link out

### Phase 3 — Affiliate monetization
- [ ] Affiliate link management (store affiliate URLs per brand)
- [ ] `/go/:slug` redirect endpoint with click tracking
- [ ] Replace outbound product links with affiliate-tracked links
- [ ] Click analytics dashboard in admin

### Phase 4 — SEO + editorial content
- [ ] Curated collection pages (e.g. "Best South Asian Bridal Jewelry Under $500")
- [ ] Collections schema: title, slug, description, cover image + junction tables
- [ ] SEO metadata: structured data (JSON-LD), sitemap.xml, robots.txt
- [ ] Open Graph tags per page for social sharing

### Phase 5 — User engagement
- [ ] Email capture + newsletter signup
- [ ] New product detection (diff `/products.json` between fetches)
- [ ] Weekly digest email (new arrivals from brands)
- [ ] Wishlists / saves (requires user accounts or local storage)

### Phase 6 — Brand partnerships
- [ ] Featured/sponsored brand placements (admin-managed, time-boxed)
- [ ] Enhanced brand profiles (verified badge, custom description, brand-selected featured products)
- [ ] Brand self-service portal (optional, longer term)

---

## Architecture Notes

- **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui + SQLite (better-sqlite3 local / D1 production)
- **ORM**: Drizzle for typed schema; raw SQL via better-sqlite3 for complex queries
- **Pattern**: Thin route handlers → business logic in `/lib/services` and `/lib/enrich`
- **Enrichment rules**: Recheck 14 days, retry failures 3 days, batch 30, concurrency 5, per-domain 1s delay, honest User-Agent, respect 304
- **Shopify coverage**: 117/156 brands (75%) — product data via public `/products.json` endpoint
