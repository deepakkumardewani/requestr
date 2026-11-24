import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Requestr",
    short_name: "Requestr",
    description: SITE_DESCRIPTION,
    start_url: "/app",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#10b981",
    icons: [
      { src: "/icon.png", sizes: "1024x1024", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
