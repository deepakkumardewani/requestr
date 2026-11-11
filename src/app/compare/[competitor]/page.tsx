import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  COMPARE_PAGES,
  getComparePage,
} from "@/components/landing/data/seoPages";
import { ComparePageLayout } from "@/components/seo/ComparePageLayout";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";
import { SITE_URL } from "@/lib/constants";

// Only competitors in COMPARE_PAGES exist; anything else is a 404.
export const dynamicParams = false;

interface CompareRouteProps {
  params: Promise<{ competitor: string }>;
}

export function generateStaticParams() {
  return COMPARE_PAGES.map(({ slug }) => ({ competitor: slug }));
}

export async function generateMetadata({
  params,
}: CompareRouteProps): Promise<Metadata> {
  const { competitor } = await params;
  const page = getComparePage(competitor);
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

export default async function CompareRoute({ params }: CompareRouteProps) {
  const { competitor } = await params;
  const page = getComparePage(competitor);
  if (!page) notFound();

  return <ComparePageLayout page={page} />;
}
