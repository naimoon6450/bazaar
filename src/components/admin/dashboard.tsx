"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImportTab } from "@/components/admin/import-tab";
import { BrandsTab } from "@/components/admin/brands-tab";
import { EnrichmentTab } from "@/components/admin/enrichment-tab";
import Link from "next/link";

export function AdminDashboard() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-lg font-semibold tracking-tight"
              >
                Bazaar
              </Link>
              <span className="text-xs font-medium uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Admin
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="import" className="space-y-6">
          <TabsList>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="brands">Brands</TabsTrigger>
            <TabsTrigger value="enrichment">Enrichment</TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <ImportTab />
          </TabsContent>

          <TabsContent value="brands">
            <BrandsTab />
          </TabsContent>

          <TabsContent value="enrichment">
            <EnrichmentTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
