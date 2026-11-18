import type { MetadataRoute } from "next";
import { ALL_SEO_ROUTES } from "@/components/landing/data/seoPages";
import { SITE_URL } from "@/lib/constants";

const STATIC_ROUTES = ["/", "/features", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [...STATIC_ROUTES, ...ALL_SEO_ROUTES].map((route) => ({
    url: route === "/" ? SITE_URL : `${SITE_URL}${route}`,
  }));
}
