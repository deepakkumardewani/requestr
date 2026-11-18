import { DarkMarketingSurface } from "@/components/landing/DarkMarketingSurface";

/** The feature hub and every feature page share the landing's always-dark look. */
export default function FeaturesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DarkMarketingSurface>{children}</DarkMarketingSurface>;
}
