"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, LayoutGrid, TableProperties, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandGrid } from "@/components/brand-grid";
import { BrandFilters } from "@/components/brand-filters";
import { useBrands, useTags } from "@/lib/hooks/use-brands";

const SORT_OPTIONS = [
  { value: "az", label: "A\u2013Z" },
  { value: "za", label: "Z\u2013A" },
  { value: "updated", label: "Recently Updated" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
] as const;

const PRICE_OPTIONS = [
  { label: "$", slug: "1", count: 0 },
  { label: "$$", slug: "2", count: 0 },
  { label: "$$$", slug: "3", count: 0 },
  { label: "$$$$", slug: "4", count: 0 },
];

function DirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sort, setSort] = useState(searchParams.get("sort") || "az");
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    () => {
      const filters: Record<string, string[]> = {};
      for (const key of ["cat", "style", "based", "price"]) {
        const val = searchParams.get(key);
        if (val) filters[key] = val.split(",");
      }
      return filters;
    }
  );

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (sort !== "az") params.set("sort", sort);
    for (const [key, values] of Object.entries(activeFilters)) {
      if (values.length > 0) params.set(key, values.join(","));
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [debouncedQuery, sort, activeFilters, router]);

  const { tags } = useTags();
  const { brands, total, loading } = useBrands({
    q: debouncedQuery || undefined,
    cat: activeFilters.cat?.join(",") || undefined,
    style: activeFilters.style?.join(",") || undefined,
    based: activeFilters.based?.join(",") || undefined,
    price: activeFilters.price?.join(",") || undefined,
    sort,
  });

  const toggleFilter = useCallback(
    (paramKey: string, slug: string) => {
      setActiveFilters((prev) => {
        const current = prev[paramKey] || [];
        const next = current.includes(slug)
          ? current.filter((s) => s !== slug)
          : [...current, slug];
        return { ...prev, [paramKey]: next };
      });
    },
    []
  );

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setQuery("");
  }, []);

  const filterSections = [
    { label: "Categories", paramKey: "cat", options: tags.categories },
    { label: "Style", paramKey: "style", options: tags.styles },
    { label: "Based In", paramKey: "based", options: tags.basedIn },
    { label: "Price Range", paramKey: "price", options: PRICE_OPTIONS },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-lg font-semibold tracking-tight">Bazaar</h1>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-3xl font-semibold tracking-tight mb-1">
            Brand Directory
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Discover curated brands by category, style, and price.
          </p>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search brands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-background"
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filters */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-4">
              <BrandFilters
                sections={filterSections}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onClearAll={clearAllFilters}
              />
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Loading..."
                  : `${total} brand${total !== 1 ? "s" : ""}`}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="text-sm bg-transparent border-0 text-muted-foreground focus:outline-none cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setView("grid")}
                    className={`p-1.5 ${view === "grid" ? "bg-muted" : ""}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setView("table")}
                    className={`p-1.5 ${view === "table" ? "bg-muted" : ""}`}
                  >
                    <TableProperties className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <BrandGrid brands={brands} loading={loading} view={view} />
          </main>
        </div>
      </div>
    </div>
  );
}

export default function DirectoryPage() {
  return (
    <Suspense>
      <DirectoryContent />
    </Suspense>
  );
}
