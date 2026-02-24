import { enrichBatch } from "@/lib/enrich/enricher";

/**
 * Cron endpoint for scheduled enrichment.
 * Can be triggered by Cloudflare Cron or external scheduler.
 * Protected by checking a secret header in production.
 */
export async function GET(request: Request) {
  // In production, verify this is a legitimate cron call
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await enrichBatch();
    console.log(`Cron enrichment: processed=${result.processed}, errors=${result.errors}`);
    return Response.json(result);
  } catch (err) {
    console.error("Cron enrichment error:", err);
    return Response.json(
      { error: "Enrichment failed" },
      { status: 500 }
    );
  }
}
