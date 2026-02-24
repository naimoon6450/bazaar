"use client";

import { useState, useEffect, useCallback } from "react";
import type { BrandListItem } from "@/lib/services/brands";

interface UseBrandsParams {
  q?: string;
  cat?: string;
  style?: string;
  based?: string;
  price?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

interface UseBrandsResult {
  brands: BrandListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBrands(params: UseBrandsParams): UseBrandsResult {
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      const p = JSON.parse(paramsKey) as UseBrandsParams;

      if (p.q) searchParams.set("q", p.q);
      if (p.cat) searchParams.set("cat", p.cat);
      if (p.style) searchParams.set("style", p.style);
      if (p.based) searchParams.set("based", p.based);
      if (p.price) searchParams.set("price", p.price);
      if (p.sort) searchParams.set("sort", p.sort);
      if (p.limit) searchParams.set("limit", String(p.limit));
      if (p.offset) searchParams.set("offset", String(p.offset));

      const res = await fetch(`/api/brands?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch brands");

      const data = await res.json();
      setBrands(data.brands);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return { brands, total, loading, error, refetch: fetchBrands };
}

interface TagsData {
  categories: { label: string; slug: string; count: number }[];
  styles: { label: string; slug: string; count: number }[];
  basedIn: { label: string; slug: string; count: number }[];
}

export function useTags() {
  const [tags, setTags] = useState<TagsData>({
    categories: [],
    styles: [],
    basedIn: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => {
        setTags(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { tags, loading };
}
