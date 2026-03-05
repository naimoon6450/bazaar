"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BrandCardProps {
  brand: {
    id: number;
    name: string;
    slug: string;
    basedIn: string | null;
    websiteUrlCanonical: string | null;
    websiteHost: string | null;
    notes: string | null;
    priceTier: number | null;
    priceLabel: string | null;
    tags: { type: string; label: string; slug: string }[];
    thumbnailUrl?: string | null;
  };
}

function PriceDots({ tier }: { tier: number | null }) {
  if (!tier) return null;
  return (
    <span className="text-muted-foreground text-sm">
      {"$".repeat(tier)}
      <span className="opacity-30">{"$".repeat(4 - tier)}</span>
    </span>
  );
}

export function BrandCard({ brand }: BrandCardProps) {
  const styleTags = brand.tags
    .filter((t) => t.type === "style")
    .slice(0, 3);

  return (
    <Link
      href={`/brand/${brand.slug}`}
      className={cn(
        "group block rounded-2xl border border-border bg-card overflow-hidden",
        "transition-all duration-200",
        "hover:border-foreground/20 hover:shadow-sm"
      )}
    >
      {brand.thumbnailUrl && (
        <div className="aspect-[4/3] w-full bg-muted overflow-hidden">
          <img
            src={brand.thumbnailUrl}
            alt={brand.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-base leading-tight group-hover:underline underline-offset-2">
          {brand.name}
        </h3>
        {brand.websiteHost && (
          <a
            href={brand.websiteUrlCanonical || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        {brand.basedIn && <span>{brand.basedIn}</span>}
        {brand.basedIn && brand.priceTier && (
          <span className="opacity-30">·</span>
        )}
        <PriceDots tier={brand.priceTier} />
      </div>

      {brand.notes && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-1">
          {brand.notes}
        </p>
      )}

      {styleTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {styleTags.map((tag) => (
            <Badge
              key={tag.slug}
              variant="secondary"
              className="text-xs font-normal"
            >
              {tag.label}
            </Badge>
          ))}
        </div>
      )}
      </div>
    </Link>
  );
}
