import { DarkMarketingSurface } from "@/components/landing/DarkMarketingSurface";
import { LandingAnalytics } from "@/components/landing/LandingAnalytics";

/** The route group keeps the always-dark rule to "/" without touching the root layout. */
export default function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DarkMarketingSurface>
      <LandingAnalytics />
      {children}
    </DarkMarketingSurface>
  );
}
