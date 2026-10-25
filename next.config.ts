import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the root so Next doesn't pick up a stray lockfile in a parent dir (~/bun.lock).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withNextIntl(nextConfig);
