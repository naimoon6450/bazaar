import { getAllTags } from "@/lib/services/brands";

export async function GET() {
  try {
    const tags = getAllTags();
    return Response.json(tags);
  } catch (err) {
    console.error("GET /api/tags error:", err);
    return Response.json({ categories: [], styles: [], basedIn: [] });
  }
}
