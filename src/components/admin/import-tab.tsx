"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImportResult {
  runId: number;
  rowsTotal: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsFailed: number;
  errors: string[];
  parseErrors?: string[];
}

export function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError("");
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error during import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-1">Import Data</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV or XLSX file to import brand data.
        </p>
      </div>

      {/* File picker */}
      <div
        className={cn(
          "border-2 border-dashed border-border rounded-2xl p-8",
          "flex flex-col items-center justify-center gap-3",
          "cursor-pointer hover:border-foreground/20 transition-colors"
        )}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFile}
          className="hidden"
        />

        {file ? (
          <>
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop a file or click to browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supports .csv, .xlsx, .xls
              </p>
            </div>
          </>
        )}
      </div>

      <Button
        onClick={handleImport}
        disabled={!file || importing}
        className="rounded-xl"
      >
        {importing ? "Importing..." : "Import"}
      </Button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h3 className="font-medium">Import Complete</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-semibold">{result.rowsTotal}</p>
              <p className="text-xs text-muted-foreground">Total rows</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-green-500">
                {result.rowsInserted}
              </p>
              <p className="text-xs text-muted-foreground">Inserted</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-blue-500">
                {result.rowsUpdated}
              </p>
              <p className="text-xs text-muted-foreground">Updated</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-destructive">
                {result.rowsFailed}
              </p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {(result.errors.length > 0 ||
            (result.parseErrors && result.parseErrors.length > 0)) && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                Errors
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-lg bg-muted p-3 text-xs font-mono space-y-0.5">
                {result.parseErrors?.map((e, i) => (
                  <p key={`p-${i}`}>{e}</p>
                ))}
                {result.errors.map((e, i) => (
                  <p key={`e-${i}`}>{e}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
