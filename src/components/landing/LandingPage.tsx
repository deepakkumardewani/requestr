import { BeyondSend } from "./BeyondSend";
import { ComparisonStatStrip } from "./ComparisonStatStrip";
import { ComparisonTable } from "./ComparisonTable";
import { FeatureShowcase } from "./FeatureShowcase";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { ImportSection } from "./ImportSection";
import { Nav } from "./Nav";

export function LandingPage() {
  return (
    <>
      <Nav />
      <main id="app-main" className="overflow-x-hidden">
        <Hero />
        <HowItWorks />
        <FeatureShowcase />
        <BeyondSend />
        <ImportSection />
        <ComparisonStatStrip />
        <ComparisonTable />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
