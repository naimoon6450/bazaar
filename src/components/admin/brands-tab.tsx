"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Pencil } from "lucide-react";
import type { BrandListItem } from "@/lib/services/brands";

interface BrandEditData {
  id: number;
  name: string;
  basedIn: string;
  websiteUrlRaw: string;
  notes: string;
  priceLabel: string;
  ratingNotes: string;
}

export function BrandsTab() {
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BrandEditData | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/brands?${params}`);
      const data = await res.json();
      setBrands(data.brands);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [search]);

  const openEdit = async (brand: BrandListItem) => {
    // Fetch full details
    const res = await fetch(`/api/brands/${brand.slug}`);
    const data = await res.json();
    setEditing({
      id: data.id,
      name: data.name || "",
      basedIn: data.basedIn || "",
      websiteUrlRaw: data.websiteUrlRaw || "",
      notes: data.notes || "",
      priceLabel: data.priceLabel || "",
      ratingNotes: data.ratingNotes || "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/brands/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      if (res.ok) {
        setEditing(null);
        fetchBrands();
      }
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-1">Manage Brands</h2>
        <p className="text-sm text-muted-foreground">
          Search and edit brand information.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search brands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Brand
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Based In
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Price
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No brands found.
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr
                  key={brand.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{brand.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {brand.basedIn || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {brand.priceTier ? "$".repeat(brand.priceTier) : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(brand)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit sheet/drawer */}
      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Brand</SheetTitle>
          </SheetHeader>

          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Based In</Label>
                <Input
                  value={editing.basedIn}
                  onChange={(e) =>
                    setEditing({ ...editing, basedIn: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={editing.websiteUrlRaw}
                  onChange={(e) =>
                    setEditing({ ...editing, websiteUrlRaw: e.target.value })
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Price Label</Label>
                <Input
                  value={editing.priceLabel}
                  onChange={(e) =>
                    setEditing({ ...editing, priceLabel: e.target.value })
                  }
                  placeholder="e.g. $$$"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({ ...editing, notes: e.target.value })
                  }
                  rows={4}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Rating Notes</Label>
                <Textarea
                  value={editing.ratingNotes}
                  onChange={(e) =>
                    setEditing({ ...editing, ratingNotes: e.target.value })
                  }
                  rows={3}
                  className="rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl"
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditing(null)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
