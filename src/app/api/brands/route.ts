import { NextRequest } from "next/server";
import { listBrands, type BrandListParams } from "@/lib/services/brands";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const params: BrandListParams = {
      q: searchParams.get("q") || undefined,
      cat: searchParams.get("cat") || undefined,
      style: searchParams.get("style") || undefined,
      based: searchParams.get("based") || undefined,
      price: searchParams.get("price") || undefined,
      sort: (searchParams.get("sort") as BrandListParams["sort"]) || undefined,
      limit: searchParams.has("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : undefined,
      offset: searchParams.has("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : undefined,
    };

    const result = listBrands(params);
    return Response.json(result);
  } catch (err) {
    console.error("GET /api/brands error:", err);
    return Response.json({ brands: [], total: 0 });
  }
}
