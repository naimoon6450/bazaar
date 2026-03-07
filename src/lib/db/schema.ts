import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  basedIn: text("based_in"),
  websiteUrlRaw: text("website_url_raw"),
  websiteUrlCanonical: text("website_url_canonical"),
  websiteHost: text("website_host"),
  notes: text("notes"),
  priceTier: integer("price_tier"),
  priceLabel: text("price_label"),
  priceAmount: real("price_amount"),
  priceAmountMin: real("price_amount_min"),
  priceAmountMax: real("price_amount_max"),
  priceCurrency: text("price_currency"),
  priceRaw: text("price_raw"),
  ratingNotes: text("rating_notes"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: ["category", "style", "based_in"] }).notNull(),
    label: text("label").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => [uniqueIndex("tags_type_slug_idx").on(table.type, table.slug)]
);

export const brandTags = sqliteTable(
  "brand_tags",
  {
    brandId: integer("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.brandId, table.tagId] })]
);

export const enrichment = sqliteTable("enrichment", {
  brandId: integer("brand_id")
    .primaryKey()
    .references(() => brands.id, { onDelete: "cascade" }),
  lastCheckedAt: text("last_checked_at"),
  httpStatus: integer("http_status"),
  finalUrl: text("final_url"),
  title: text("title"),
  metaDescription: text("meta_description"),
  ogImageUrl: text("og_image_url"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  error: text("error"),
  isShopify: integer("is_shopify"),
});

export const brandProducts = sqliteTable(
  "brand_products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    price: text("price"),
    currency: text("currency").default("USD"),
    productUrl: text("product_url").notNull(),
    productType: text("product_type"),
    fetchedAt: text("fetched_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("brand_products_brand_external_idx").on(
      table.brandId,
      table.externalId
    ),
  ]
);

export const ingestionRuns = sqliteTable("ingestion_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  finishedAt: text("finished_at"),
  rowsTotal: integer("rows_total").default(0),
  rowsInserted: integer("rows_inserted").default(0),
  rowsUpdated: integer("rows_updated").default(0),
  rowsFailed: integer("rows_failed").default(0),
  log: text("log"),
});

// Type exports
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type BrandTag = typeof brandTags.$inferSelect;
export type Enrichment = typeof enrichment.$inferSelect;
export type BrandProduct = typeof brandProducts.$inferSelect;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
