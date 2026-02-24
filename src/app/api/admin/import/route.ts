import { NextRequest } from "next/server";
import { isAdminAuthenticated, adminUnauthorizedResponse } from "@/lib/validation/admin";
import { parseSpreadsheet } from "@/lib/ingest/parse";
import { importRows } from "@/lib/ingest/import";

export async function POST(request: NextRequest) {
  if (!isAdminAuthenticated(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors: parseErrors } = parseSpreadsheet(buffer, file.name);

    if (rows.length === 0 && parseErrors.length > 0) {
      return Response.json(
        { error: "Failed to parse file", details: parseErrors },
        { status: 400 }
      );
    }

    const result = importRows(rows);

    return Response.json({
      ...result,
      parseErrors,
    });
  } catch (err) {
    console.error("POST /api/admin/import error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
