import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Requestr — Browser-native API testing",
  description:
    "Test HTTP APIs directly in your browser. No install, no account, no data leaving your device. Import from Postman, Insomnia, and cURL.",
  openGraph: {
    title: "Requestr — Browser-native API testing",
    description:
      "Test HTTP APIs directly in your browser. No install, no account, no data leaving your device.",
    url: "https://requestr.app",
    siteName: "Requestr",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Requestr — Browser-native API testing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Requestr — Browser-native API testing",
    description:
      "Test HTTP APIs directly in your browser. No install, no account, no data leaving your device.",
    images: ["/og-image.png"],
  },
};

export default function Home() {
  return <LandingPage />;
}
