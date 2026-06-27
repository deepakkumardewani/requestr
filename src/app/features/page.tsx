import type { Metadata } from "next";
import { AllFeaturesPage } from "@/components/landing/AllFeaturesPage";

export const metadata: Metadata = {
  title: "Features — Requestr",
  description:
    "Explore every Requestr feature: JSON transform, compare, visualize, shareable links, chains, environments, and more — all in your browser.",
  openGraph: {
    title: "Features — Requestr",
    description:
      "Explore every Requestr feature: JSON transform, compare, visualize, shareable links, chains, environments, and more.",
    type: "website",
  },
};

export default function FeaturesRoute() {
  return <AllFeaturesPage />;
}
