import { getBrandBySlug } from "@/lib/services/brands";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const brand = getBrandBySlug(slug);

    if (!brand) {
      return Response.json({ error: "Brand not found" }, { status: 404 });
    }

    return Response.json(brand);
  } catch (err) {
    console.error("GET /api/brands/[slug] error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
