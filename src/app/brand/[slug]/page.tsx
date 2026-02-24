import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/services/brands";
import { BrandDetailView } from "@/components/brand-detail";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);

  if (!brand) {
    return { title: "Brand Not Found" };
  }

  return {
    title: `${brand.name} — Bazaar`,
    description:
      brand.enrichment?.metaDescription ||
      brand.notes ||
      `${brand.name} brand profile on Bazaar.`,
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);

  if (!brand) {
    notFound();
  }

  return <BrandDetailView brand={brand} />;
}
