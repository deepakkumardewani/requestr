import dynamic from "next/dynamic";
import { ComparisonTable } from "./ComparisonTable";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { LandingNav } from "./nav/LandingNav";
import { Basics } from "./sections/Basics";
import { Capabilities } from "./sections/Capabilities";
import { CommandPalette } from "./sections/CommandPalette";
import { Control } from "./sections/Control";
import { FinalCta } from "./sections/FinalCta";
import { ImportBackup } from "./sections/ImportBackup";
import { Toolbox } from "./sections/Toolbox";
import { AuthFlipBand } from "./status/AuthFlipBand";
import { StatusRail } from "./status/StatusRail";

// The recorded Relay demo; code-split so the video player adds no eager JS.
const RelaySection = dynamic(() =>
  import("./relay/RelaySection").then((m) => m.RelaySection),
);

/**
 * The home page: the Relay-first story (hero, basics, demo, capabilities,
 * approvals) followed by proof that the client stands on its own (command
 * palette, import and backup, the other tools, the comparison).
 */
export function LandingPage() {
  return (
    <>
      <LandingNav />
      <StatusRail />
      <main id="app-main" className="overflow-x-clip">
        <Hero />
        <Basics />
        <RelaySection />
        <Capabilities />
        <AuthFlipBand />
        <Control />
        <CommandPalette />
        <ImportBackup />
        <Toolbox />
        <ComparisonTable />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
