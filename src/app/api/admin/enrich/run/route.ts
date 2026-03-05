import { NextRequest } from "next/server";
import { isAdminAuthenticated, adminUnauthorizedResponse } from "@/lib/validation/admin";
import { enrichBatch } from "@/lib/enrich/enricher";

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const result = await enrichBatch();
    return Response.json(result);
  } catch (err) {
    console.error("POST /api/admin/enrich/run error:", err);
    return Response.json(
      { error: "Enrichment batch failed" },
      { status: 500 }
    );
  }
}
