"use client";

import { BrandCard } from "@/components/brand-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BrandListItem } from "@/lib/services/brands";

interface BrandGridProps {
  brands: BrandListItem[];
  loading: boolean;
  view: "grid" | "table";
}

function BrandGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border p-5 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BrandTableView({ brands }: { brands: BrandListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Brand</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Based In</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Style</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Website</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => (
            <tr key={brand.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">
                <a
                  href={`/brand/${brand.slug}`}
                  className="font-medium hover:underline underline-offset-2"
                >
                  {brand.name}
                </a>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{brand.basedIn || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {brand.priceTier ? "$".repeat(brand.priceTier) : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {brand.tags
                    .filter((t) => t.type === "style")
                    .slice(0, 2)
                    .map((t) => (
                      <span
                        key={t.slug}
                        className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs"
                      >
                        {t.label}
                      </span>
                    ))}
                </div>
              </td>
              <td className="px-4 py-3">
                {brand.websiteHost && (
                  <a
                    href={brand.websiteUrlCanonical || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    {brand.websiteHost}
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BrandGrid({ brands, loading, view }: BrandGridProps) {
  if (loading) return <BrandGridSkeleton />;

  if (brands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No brands found.</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  if (view === "table") {
    return <BrandTableView brands={brands} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {brands.map((brand) => (
        <BrandCard key={brand.id} brand={brand} />
      ))}
    </div>
  );
}
