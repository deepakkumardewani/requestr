import { ComparisonTable } from "./ComparisonTable";
import { FeatureShowcase } from "./FeatureShowcase";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { TrustStrip } from "./TrustStrip";

export function LandingPage() {
  return (
    <>
      <Nav />
      <main id="app-main" className="overflow-x-hidden">
        <Hero />
        <TrustStrip />
        <FeatureShowcase />
        <ComparisonTable />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
