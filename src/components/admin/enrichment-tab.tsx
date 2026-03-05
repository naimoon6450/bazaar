"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export function EnrichmentTab() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    processed: number;
    errors: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [forceAll, setForceAll] = useState(false);

  const runEnrichment = async () => {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/admin/enrich/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Enrichment failed");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-1">Enrichment</h2>
        <p className="text-sm text-muted-foreground">
          Fetch metadata for brand websites: HTTP status, title, description,
          og:image. Re-checks every 14 days, retries failures after 3 days.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="forceAll"
          checked={forceAll}
          onChange={(e) => setForceAll(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="forceAll" className="text-sm font-medium">
          Force enrich all brands (ignore schedule)
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {forceAll
          ? "Will process ALL brands with websites, regardless of when they were last checked."
          : "Will only process brands that haven't been checked recently or had errors."
        }
      </p>

      <Button
        onClick={runEnrichment}
        disabled={running}
        className="rounded-xl"
      >
        <RefreshCw
          className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`}
        />
        {running ? "Running..." : `Run enrichment${forceAll ? " (all brands)" : " batch"}`}
      </Button>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-border text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <span>
            Processed {result.processed} brands.{" "}
            {result.errors > 0 && (
              <span className="text-destructive">
                {result.errors} errors.
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
