import { DarkMarketingSurface } from "@/components/landing/DarkMarketingSurface";

/** The route group keeps the always-dark rule to "/" without touching the root layout. */
export default function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DarkMarketingSurface>{children}</DarkMarketingSurface>;
}
