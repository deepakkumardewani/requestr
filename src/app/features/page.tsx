import type { Metadata } from "next";
import { AllFeaturesPage } from "@/components/landing/AllFeaturesPage";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  absoluteUrl,
  buildBreadcrumbList,
} from "@/components/seo/jsonLdBuilders";
import { SITE_URL } from "@/lib/constants";

const HUB_PATH = "/features";
const TITLE = "Features: every Requestr tool in one browser tab";
const DESCRIPTION =
  "Browse Requestr features: the Relay AI, request chains, JSON transform, compare and visualize, import, environments and backup. All in your browser, no account.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(HUB_PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl(HUB_PATH),
    type: "website",
  },
};

const BREADCRUMBS = buildBreadcrumbList([
  { name: "Requestr", path: "/" },
  { name: "Features", path: HUB_PATH },
]);

export default function FeaturesRoute() {
  return (
    <>
      <JsonLd data={BREADCRUMBS} />
      <AllFeaturesPage />
    </>
  );
}
