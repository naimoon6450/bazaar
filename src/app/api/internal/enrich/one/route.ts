import { NextRequest } from "next/server";
import { enrichOne } from "@/lib/enrich/enricher";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandId } = body;

    if (!brandId || typeof brandId !== "number") {
      return Response.json(
        { error: "brandId (number) is required" },
        { status: 400 }
      );
    }

    const result = await enrichOne(brandId);
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/internal/enrich/one error:", err);
    return Response.json(
      { error: "Enrichment failed" },
      { status: 500 }
    );
  }
}
