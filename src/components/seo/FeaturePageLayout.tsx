import type { FeaturePage } from "@/components/landing/data/seoPages";
import { Footer } from "@/components/landing/Footer";
import { getFeatureDetail } from "@/components/landing/features/data/featureDetails";
import { getFeatureDemo } from "@/components/landing/features/demos/registry";
import { FeatureCapabilities } from "@/components/landing/features/page/FeatureCapabilities";
import { FeatureClosing } from "@/components/landing/features/page/FeatureClosing";
import { FeatureDemoSection } from "@/components/landing/features/page/FeatureDemoSection";
import { FeatureHero } from "@/components/landing/features/page/FeatureHero";
import { FeatureRelated } from "@/components/landing/features/page/FeatureRelated";
import { FeatureRelay } from "@/components/landing/features/page/FeatureRelay";
import { FeatureSteps } from "@/components/landing/features/page/FeatureSteps";
import { LandingNav } from "@/components/landing/nav/LandingNav";
import { JsonLd } from "./JsonLd";
import {
  buildBreadcrumbList,
  buildFeaturePageSchema,
  buildPageBreadcrumbs,
} from "./jsonLdBuilders";

interface FeaturePageLayoutProps {
  page: FeaturePage;
}

/**
 * Promise, live demo, how it works, capabilities, Relay, related, action: the
 * order a visitor's questions arrive in. SEO copy comes from the page; the
 * rest from its feature details.
 */
export function FeaturePageLayout({ page }: FeaturePageLayoutProps) {
  const detail = getFeatureDetail(page.slug);
  const Demo = getFeatureDemo(page.slug);
  if (!detail || !Demo) {
    throw new Error(
      `Feature page "${page.slug}" has no details or demo registered`,
    );
  }
  const [, ...paragraphs] = page.body;

  return (
    <>
      <JsonLd data={buildFeaturePageSchema(page)} />
      <JsonLd data={buildBreadcrumbList(buildPageBreadcrumbs(page))} />
      <LandingNav />
      <main id="app-main" className="overflow-x-clip">
        <FeatureHero page={page} detail={detail} />
        <FeatureDemoSection
          detail={detail}
          Demo={Demo}
          paragraphs={paragraphs}
        />
        <FeatureSteps steps={detail.steps} />
        <FeatureCapabilities capabilities={detail.capabilities} />
        {detail.relay ? <FeatureRelay relay={detail.relay} /> : null}
        <FeatureRelated page={page} />
        <FeatureClosing closing={detail.closing} cta={page.cta} />
      </main>
      <Footer />
    </>
  );
}
