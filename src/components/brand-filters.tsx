"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

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
          <DropdownMenu key={section.paramKey}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                {section.label}
                <svg
                  className="ml-2 h-3 w-3"
                  viewBox="0 0 10 6"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 1L5 5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {section.options.map((opt) => {
                const isActive = active.includes(opt.slug);
                return (
                  <label
                    key={opt.slug}
                    className="flex items-center px-3 py-1 text-sm cursor-pointer hover:bg-muted/10"
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => onToggleFilter(section.paramKey, opt.slug)}
                      className="mr-2 h-4 w-4"
                    />
                    <span className="flex-1">{opt.label}</span>
                    <span className="text-xs opacity-50">{opt.count}</span>
                  </label>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </div>
  );
}
