import dynamic from "next/dynamic";
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

// Code-split so the Relay demo adds no eager JS to the landing bundle (FR-39).
const RelaySection = dynamic(() =>
  import("./relay/RelaySection").then((m) => m.RelaySection),
);

export function LandingPage() {
  return (
    <>
      <Nav />
      <main id="app-main" className="overflow-x-hidden">
        <Hero />
        <HowItWorks />
        <FeatureShowcase />
        <BeyondSend />
        <RelaySection />
        <ImportSection />
        <ComparisonStatStrip />
        <ComparisonTable />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
