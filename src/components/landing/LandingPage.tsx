import { ComparisonTable } from "./ComparisonTable";
import { FeatureShowcase } from "./FeatureShowcase";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Nav } from "./Nav";
import { ScreenshotGallery } from "./ScreenshotGallery";
import { TrustStrip } from "./TrustStrip";

export function LandingPage() {
  return (
    <>
      <Nav />
      <main id="app-main">
        <Hero />
        <TrustStrip />
        <FeatureShowcase />
        <ScreenshotGallery />
        <ComparisonTable />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
