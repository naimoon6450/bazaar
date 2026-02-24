"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BrandCard } from "@/components/brand-card";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BrandDetail, ProductItem } from "@/lib/services/brands";
import { formatPrice } from "@/lib/format";

function PriceDots({ tier }: { tier: number | null }) {
  if (!tier) return null;
  return (
    <span className="text-sm">
      {"$".repeat(tier)}
      <span className="opacity-30">{"$".repeat(4 - tier)}</span>
    </span>
  );
}

function ProductCard({ product }: { product: ProductItem }) {
  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-border overflow-hidden transition-all duration-200 hover:border-foreground/20 hover:shadow-sm"
    >
      {product.imageUrl && (
        <div className="aspect-[3/4] w-full bg-muted overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        <p className="text-xs leading-snug line-clamp-2">{product.title}</p>
        {product.price && (
          <p className="text-xs text-muted-foreground">
            {formatPrice(product.price, product.currency || "USD")}
          </p>
        )}
      </div>
    </a>
  );
}

export function BrandDetailView({ brand }: { brand: BrandDetail }) {
  const [copied, setCopied] = useState(false);

  const categories = brand.tags.filter((t) => t.type === "category");
  const styles = brand.tags.filter((t) => t.type === "style");

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to directory
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            {brand.name}
          </h1>

          <div className="flex items-center gap-3 text-muted-foreground text-sm mb-6">
            {brand.basedIn && <span>{brand.basedIn}</span>}
            {brand.basedIn && brand.priceTier && (
              <span className="opacity-30">·</span>
            )}
            <PriceDots tier={brand.priceTier} />
          </div>

          <div className="flex items-center gap-3">
            {brand.websiteUrlCanonical && (
              <Button asChild className="rounded-xl">
                <a
                  href={brand.websiteUrlCanonical}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit website
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={copyLink}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy link
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Product gallery or og:image fallback */}
        {brand.products.length > 0 ? (
          <div className="mb-10">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Products
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {brand.products.map((product, i) => (
                <ProductCard key={i} product={product} />
              ))}
            </div>
          </div>
        ) : brand.enrichment?.ogImageUrl ? (
          <div className="mb-10 overflow-hidden rounded-2xl border border-border">
            <div className="relative aspect-[2/1] w-full bg-muted">
              <img
                src={brand.enrichment.ogImageUrl}
                alt={brand.name}
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        ) : null}

        {/* Enrichment description */}
        {brand.enrichment?.metaDescription && (
          <p className="text-base leading-relaxed text-muted-foreground mb-10">
            {brand.enrichment.metaDescription}
          </p>
        )}

        <Separator className="mb-10" />

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Main content */}
          <div className="md:col-span-2 space-y-8">
            {brand.notes && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Notes
                </h3>
                <p className="text-sm leading-relaxed">{brand.notes}</p>
              </section>
            )}

            {brand.ratingNotes && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Rating Notes
                </h3>
                <p className="text-sm leading-relaxed">{brand.ratingNotes}</p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {categories.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Categories
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/?cat=${tag.slug}`}
                      className="inline-block"
                    >
                      <Badge
                        variant="secondary"
                        className="text-xs font-normal hover:bg-foreground hover:text-background transition-colors"
                      >
                        {tag.label}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {styles.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Style Focus
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {styles.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/?style=${tag.slug}`}
                      className="inline-block"
                    >
                      <Badge
                        variant="outline"
                        className="text-xs font-normal hover:bg-foreground hover:text-background transition-colors"
                      >
                        {tag.label}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {brand.websiteHost && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Website
                </h3>
                <a
                  href={brand.websiteUrlCanonical || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline underline-offset-2"
                >
                  {brand.websiteHost}
                </a>
              </section>
            )}

            {brand.priceLabel && (
              <section>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Price Range
                </h3>
                <p className="text-sm">{brand.priceLabel}</p>
              </section>
            )}
          </div>
        </div>

        {/* Similar brands */}
        {brand.similarBrands.length > 0 && (
          <>
            <Separator className="my-12" />
            <section>
              <h3 className="text-lg font-medium mb-6">Similar Brands</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {brand.similarBrands.map((similar) => (
                  <BrandCard key={similar.id} brand={similar} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
