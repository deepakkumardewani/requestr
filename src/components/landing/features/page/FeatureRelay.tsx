import Link from "next/link";
import { RelayLogo } from "@/components/relay/RelayLogo";
import { cn } from "@/lib/utils";
import {
  SECTION_CONTAINER,
  SECTION_DIVIDER,
  SECTION_PADDING,
  SECTION_SURFACE_ALT,
} from "../../constants";
import { LINK_INTERACTIVE } from "../../interactionStyles";
import { SectionHeader } from "../../SectionHeader";
import type { FeatureRelayUse } from "../data/featureDetails";
import { FEATURE_SECTION_IDS, titleId } from "./pageConstants";

const EYEBROW = "With Relay";
const TITLE = "Or ask Relay to do it.";
/** On Relay's own page the section is a list of things to try. */
const RELAY_PAGE_TITLE = "Things to try first.";
const TOOLS_LABEL = "Relay tools it uses";
const RELAY_PAGE_LINK = {
  href: "/features/relay",
  label: "How Relay works",
} as const;
const TITLE_ID = titleId(FEATURE_SECTION_IDS.relay);

function PromptBubble({ prompt }: { prompt: string }) {
  return (
    <li className="ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-md border border-border bg-muted/60 px-4 py-2.5 text-sm text-foreground">
      {prompt}
    </li>
  );
}

function ToolList({ tools }: { tools: FeatureRelayUse["tools"] }) {
  return (
    <div className="mt-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {TOOLS_LABEL}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tools.map((tool) => (
          <li
            key={tool}
            className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-xs text-[var(--landing-accent)]"
          >
            {tool}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where Relay helps with this feature, in its own words and tools. */
export function FeatureRelay({ relay }: { relay: FeatureRelayUse }) {
  const onRelayPage = relay.tools.length === 0;
  return (
    <section
      id={FEATURE_SECTION_IDS.relay}
      aria-labelledby={TITLE_ID}
      className={cn(SECTION_PADDING, SECTION_DIVIDER, SECTION_SURFACE_ALT)}
    >
      <div
        className={cn(
          SECTION_CONTAINER,
          "grid items-start gap-10 lg:grid-cols-2",
        )}
      >
        <div>
          <SectionHeader
            titleId={TITLE_ID}
            eyebrow={EYEBROW}
            title={onRelayPage ? RELAY_PAGE_TITLE : TITLE}
            lede={relay.lede}
            className="mb-0"
          />
          {onRelayPage ? null : <ToolList tools={relay.tools} />}
          {onRelayPage ? null : (
            <Link
              href={RELAY_PAGE_LINK.href}
              className={cn(
                LINK_INTERACTIVE,
                "mt-6 inline-block text-sm font-medium text-[var(--landing-accent)]",
              )}
            >
              {RELAY_PAGE_LINK.label} →
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-border bg-[var(--surface-deep)] p-4 shadow-2xl shadow-black/30">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <RelayLogo />
            Relay
          </p>
          <ul className="space-y-3">
            {relay.prompts.map((prompt) => (
              <PromptBubble key={prompt} prompt={prompt} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
