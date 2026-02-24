# Bazaar

A curated brand directory built with Next.js, TypeScript, and SQLite. Browse brands by category, style, location, and price — with product imagery pulled from Shopify storefronts.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind + shadcn/ui
- **SQLite** via better-sqlite3 (local) / Cloudflare D1 (production)
- **Drizzle ORM** for schema definitions

## Setup

```bash
npm install
cp .env.example .env.local   # edit as needed
npm run db:migrate            # create SQLite database
npm run dev                   # http://localhost:3000
```

## Importing data

Upload a CSV/XLSX through the admin panel at `/admin`, or run directly:

```bash
npx tsx scripts/import-csv.ts path/to/brands.csv
```

Expected columns: `Brand`, `Product Categories`, `Style Focus`, `Notes`, `Based In`, `Website`, `Price Range`, `Rating (Notes)`

## Enrichment

The enrichment pipeline fetches metadata and products from brand websites:

- **Metadata**: HTTP status, title, description, og:image
- **Products**: For Shopify stores (75% of brands), pulls 8 products via `/products.json` with images, prices, and direct links
- **US geo-redirect detection**: Automatically resolves the correct regional storefront

Trigger manually from `/admin` or via the cron endpoint at `/api/cron/enrich`.

## Project structure

```
src/
  app/           # Pages and API routes (thin handlers)
  components/    # UI components
  lib/
    db/          # Schema, migrations, connection
    services/    # Business logic (brand queries, tag aggregation)
    ingest/      # CSV/XLSX parsing + normalization
    enrich/      # Metadata + Shopify product fetching
    validation/  # Admin auth
```

## Roadmap

See [PROGRESS.md](./PROGRESS.md) for detailed status and planned phases (product browsing, affiliate links, SEO collections, newsletters).
