"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterSection {
  label: string;
  paramKey: string;
  options: { label: string; slug: string; count: number }[];
}

interface BrandFiltersProps {
  sections: FilterSection[];
  activeFilters: Record<string, string[]>;
  onToggleFilter: (paramKey: string, slug: string) => void;
  onClearAll: () => void;
}

export function BrandFilters({
  sections,
  activeFilters,
  onToggleFilter,
  onClearAll,
}: BrandFiltersProps) {
  const hasActiveFilters = Object.values(activeFilters).some(
    (v) => v.length > 0
  );

  return (
    <div className="space-y-4">
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs"
          >
            Clear all
            <X className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      {sections.map((section) => {
        if (section.options.length === 0) return null;

        const active = activeFilters[section.paramKey] || [];

        return (
          <div key={section.paramKey}>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {section.label}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {section.options.map((opt) => {
                const isActive = active.includes(opt.slug);
                return (
                  <button
                    key={opt.slug}
                    onClick={() => onToggleFilter(section.paramKey, opt.slug)}
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs transition-colors",
                      "border",
                      isActive
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                    <span className="ml-1.5 opacity-50">{opt.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
