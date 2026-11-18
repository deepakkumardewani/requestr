import { FEATURES } from "./data/features";
import { Footer } from "./Footer";
import { CompareLinks } from "./features/hub/CompareLinks";
import { FeatureGroupSection } from "./features/hub/FeatureGroupSection";
import { HubHero } from "./features/hub/HubHero";
import { groupByCategory } from "./features/hub/hubModel";
import { ScrollReset } from "./features/hub/ScrollReset";
import { LandingNav } from "./nav/LandingNav";

/** Server-rendered hub; only the cards, previews and scroll reset hydrate. */
export function AllFeaturesPage() {
  const groups = groupByCategory(FEATURES);
  return (
    <>
      <ScrollReset />
      <LandingNav />
      <main id="app-main" className="overflow-x-clip pb-8">
        <HubHero groups={groups} featureCount={FEATURES.length} />
        {groups.map((group, index) => (
          <FeatureGroupSection
            key={group.category}
            group={group}
            index={index}
          />
        ))}
        <CompareLinks />
      </main>
      <Footer />
    </>
  );
}
