import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated, adminUnauthorizedResponse } from "@/lib/validation/admin";
import { getDb } from "@/lib/db";
import { brands } from "@/lib/db/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminAuthenticated(request)) {
    return adminUnauthorizedResponse();
  }

  try {
    const { id } = await params;
    const brandId = parseInt(id, 10);
    if (isNaN(brandId)) {
      return Response.json({ error: "Invalid brand ID" }, { status: 400 });
    }

    const body = await request.json();
    const db = getDb();

    // Only allow updating specific fields
    const allowedFields = [
      "name",
      "basedIn",
      "websiteUrlRaw",
      "notes",
      "priceLabel",
      "ratingNotes",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date().toISOString();

    db.update(brands)
      .set(updates)
      .where(eq(brands.id, brandId))
      .run();

    const updated = db
      .select()
      .from(brands)
      .where(eq(brands.id, brandId))
      .get();

    return Response.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/brands/[id] error:", err);
    return Response.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }
}
