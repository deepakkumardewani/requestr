import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FEATURE_PAGES,
  getFeaturePage,
} from "@/components/landing/data/seoPages";
import { FeaturePageLayout } from "@/components/seo/FeaturePageLayout";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";
import { SITE_URL } from "@/lib/constants";

// Only slugs in FEATURE_PAGES exist; anything else is a 404.
export const dynamicParams = false;

interface FeatureRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return FEATURE_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: FeatureRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getFeaturePage(slug);
  if (!page) return {};

  const image = absoluteUrl(page.screenshot.src);
  return {
    metadataBase: new URL(SITE_URL),
    title: page.title,
    description: page.description,
    alternates: { canonical: absoluteUrl(page.route) },
    openGraph: {
      title: page.title,
      description: page.description,
      url: absoluteUrl(page.route),
      type: "website",
      images: [{ url: image, alt: page.screenshot.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image],
    },
  };
}

export default async function FeatureRoute({ params }: FeatureRouteProps) {
  const { slug } = await params;
  const page = getFeaturePage(slug);
  if (!page) notFound();

  return <FeaturePageLayout page={page} />;
}
