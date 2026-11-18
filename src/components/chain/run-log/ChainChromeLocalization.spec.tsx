/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createTranslator } from "use-intl/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import enChain from "../../../../messages/en/chain.json";
import frChain from "../../../../messages/fr/chain.json";
import jaChain from "../../../../messages/ja/chain.json";
import { RelativeNowProvider } from "@/components/chain/RelativeNowProvider";
import type { RunStep, RunSummary } from "@/lib/chainRunHistory";
import { GhostNode } from "../canvas/GhostNode";
import { RunCard } from "./RunCard";
import { RunFilterTabs } from "./RunFilterTabs";
import { RunLogCollapsedBar } from "./RunLogCollapsedBar";
import { RunLogEmptyState } from "./RunLogEmptyState";
import { RunSummaryHeader } from "./RunSummaryHeader";
import { StepRow } from "./StepRow";

// The global setup mocks next-intl with English-only messages; this spec needs the real one.
vi.unmock("next-intl");

function renderJa(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="ja" messages={{ chain: jaChain }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const step: RunStep = {
  id: "s1",
  nodeId: "n1",
  nodeType: "delay",
  label: "wait",
  state: "passed",
  startedAt: 0,
  durationMs: 5,
  extractedValues: {},
  unresolvedVars: [],
};

describe("chain canvas and run-log chrome in ja", () => {
  afterEach(cleanup);

  it("names the StepRow lane in Japanese", () => {
    renderJa(
      <StepRow
        step={step}
        index={0}
        isSelected={false}
        onSelect={vi.fn()}
        lane={1}
        showLane
      />,
    );

    expect(screen.getByRole("img", { name: "レーン 2" })).toBeInTheDocument();
  });

  it("labels the GhostNode with the Japanese block name and hint", () => {
    renderJa(<GhostNode type="evaluate" cursorPos={{ x: 0, y: 0 }} />);

    expect(screen.getByText(jaChain.blockMenuEvaluateName)).toBeInTheDocument();
    expect(screen.getByText(jaChain.ghostPlacementHint)).toBeInTheDocument();
    expect(screen.queryByText("Evaluate")).not.toBeInTheDocument();
  });
});

const MESSAGES = { en: enChain, fr: frChain, ja: jaChain } as const;
type Locale = keyof typeof MESSAGES;
const LOCALES = Object.keys(MESSAGES) as Locale[];

type Translate = (key: string, values?: Record<string, unknown>) => string;

/** Renders through the real provider and records every missing-key / format error. */
function renderLocale(locale: Locale, ui: React.ReactElement) {
  const errors: string[] = [];
  const view = render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={{ chain: MESSAGES[locale] }}
      onError={(error) => errors.push(error.message)}
    >
      <RelativeNowProvider>{ui}</RelativeNowProvider>
    </NextIntlClientProvider>,
  );
  return { ...view, errors };
}

function translatorFor(locale: Locale): Translate {
  return createTranslator({
    locale,
    messages: { chain: MESSAGES[locale] },
    namespace: "chain",
  }) as unknown as Translate;
}

/** Fails when text still equals the English string a translated locale should have replaced. */
function expectNoEnglishLeftover(
  locale: Locale,
  text: string,
  key: keyof typeof enChain,
  values?: Record<string, unknown>,
) {
  if (locale === "en") return;
  const english = translatorFor("en")(key, values);
  const localized = translatorFor(locale)(key, values);
  if (english === localized) return;
  expect(text).not.toContain(english);
}

const START = Date.now() - 60_000;

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: "run-1",
    chainId: "chain-1",
    startedAt: START,
    finishedAt: START + 1200,
    status: "failed",
    trigger: "full",
    counts: { passed: 2, failed: 1, skipped: 1, aborted: 0 },
    bytes: 1,
    schemaVersion: 1,
    steps: [step, { ...step, id: "s2" }, { ...step, id: "s3" }],
    ...overrides,
  };
}

describe.each(LOCALES)("run-log chrome in %s", (locale) => {
  afterEach(cleanup);
  const tr = translatorFor(locale);

  it("localizes the collapsed bar", () => {
    const { errors } = renderLocale(
      locale,
      <RunLogCollapsedBar
        run={makeRun()}
        now={START + 5000}
        panelId="p"
        onExpand={vi.fn()}
      />,
    );
    const label = screen.getByTestId("run-log-strip").getAttribute("aria-label") ?? "";
    expect(errors, errors.join("; ")).toEqual([]);
    expect(label).toContain(tr("runLogTitle"));
    expect(label).toContain(tr("runLogCollapsedLastRunFailed"));
    expect(label).toContain(tr("runLogCountFailed", { count: 1 }));
    expectNoEnglishLeftover(locale, label, "runLogCollapsedLastRunFailed");
  });

  it("localizes the collapsed bar with no runs", () => {
    const { errors } = renderLocale(
      locale,
      <RunLogCollapsedBar run={null} now={START} panelId="p" onExpand={vi.fn()} />,
    );
    expect(errors, errors.join("; ")).toEqual([]);
    expect(screen.getByText(tr("runLogNoRunsYet"))).toBeInTheDocument();
  });

  it("localizes the run card", () => {
    const { errors, container } = renderLocale(
      locale,
      <RunCard run={makeRun()} selected={false} onSelect={vi.fn()} />,
    );
    expect(errors, errors.join("; ")).toEqual([]);
    const text = container.textContent ?? "";
    expect(text).toContain(tr("runLogCountPassed", { count: 2 }));
    expect(text).toContain(tr("runLogCountFailed", { count: 1 }));
    expectNoEnglishLeftover(locale, text, "runLogCountPassed", { count: 2 });
  });

  it("localizes the run summary header", () => {
    const { errors } = renderLocale(
      locale,
      <RunSummaryHeader
        run={makeRun()}
        liveNodeIds={new Set(["n1"])}
        onRerun={vi.fn()}
      />,
    );
    expect(errors, errors.join("; ")).toEqual([]);
    expect(
      screen.getByRole("button", { name: tr("runLogRerun") }),
    ).toBeInTheDocument();
    const text = screen.getByTestId("run-summary-header").textContent ?? "";
    expect(text).toContain(tr("runLogStepCount", { count: 3 }));
    expectNoEnglishLeftover(locale, text, "runLogStepCount", { count: 3 });
  });

  it("localizes the filter tabs", () => {
    const { errors } = renderLocale(
      locale,
      <RunFilterTabs
        counts={{ all: 4, passed: 2, failed: 1, skipped: 1 }}
        value="all"
        onChange={vi.fn()}
      />,
    );
    expect(errors, errors.join("; ")).toEqual([]);
    for (const [key, count] of [
      ["runLogFilterAllCount", 4],
      ["runLogFilterPassedCount", 2],
      ["runLogFilterFailedCount", 1],
      ["runLogFilterSkippedCount", 1],
    ] as const) {
      expect(screen.getByRole("button", { name: tr(key, { count }) })).toBeInTheDocument();
    }
  });

  it.each([
    ["noRuns", ["runLogNoRunsYet", "runLogRunFlow"]],
    ["noSteps", ["runLogStepsEmpty"]],
    ["filtered", ["runLogStepsEmptyFiltered", "runLogClearFilter"]],
    ["noStepSelected", ["runLogSelectStepPrompt"]],
  ] as const)("localizes the %s empty state", (kind, keys) => {
    const { errors, container } = renderLocale(
      locale,
      <RunLogEmptyState kind={kind} onRunFlow={vi.fn()} onClearFilter={vi.fn()} />,
    );
    expect(errors, errors.join("; ")).toEqual([]);
    const text = container.textContent ?? "";
    for (const key of keys) {
      expect(text).toContain(tr(key));
      expectNoEnglishLeftover(locale, text, key);
    }
  });
});

describe("run-log plurals", () => {
  afterEach(cleanup);

  it("uses only the `other` branch in ja", () => {
    expect(jaChain.runLogStepCount).not.toMatch(/\bone\s*\{/);
    expect(jaChain.runLogCollapsedSummary).not.toMatch(/\bone\s*\{/);
    const tr = translatorFor("ja");
    expect(tr("runLogStepCount", { count: 1 })).toBe("1ステップ");
    expect(tr("runLogStepCount", { count: 3 })).toBe("3ステップ");
  });

  it("distinguishes one and other in fr", () => {
    const tr = translatorFor("fr");
    expect(tr("runLogStepCount", { count: 1 })).toBe("1 étape");
    expect(tr("runLogStepCount", { count: 3 })).toBe("3 étapes");
  });
});
