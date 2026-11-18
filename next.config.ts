import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // E2E_DIST_DIR=.next-e2e gives the e2e prod server its own build output so it never touches the dev server's `.next`.
  distDir: process.env.E2E_DIST_DIR ?? ".next",
  // Pin the root so Next doesn't pick up a stray lockfile in a parent dir (~/bun.lock).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withNextIntl(nextConfig);
