/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frChain from "../../../../messages/fr/chain.json";
import frErrors from "../../../../messages/fr/errors.json";
import jaChain from "../../../../messages/ja/chain.json";
import jaErrors from "../../../../messages/ja/errors.json";
import enChain from "../../../../messages/en/chain.json";
import enErrors from "../../../../messages/en/errors.json";
import type { RunStep } from "@/lib/chainRunHistory";
import { StepDetail } from "./StepDetail";

// The global setup mocks next-intl with English-only messages; this spec needs the real one.
vi.unmock("next-intl");

const LEGACY_ERROR = "Legacy English failure";

function makeStep(overrides: Partial<RunStep>): RunStep {
  return {
    id: "s1",
    nodeId: "n1",
    nodeType: "delay",
    label: "wait",
    state: "failed",
    startedAt: 0,
    durationMs: 5,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

const LOCALES = {
  en: { chain: enChain, errors: enErrors },
  fr: { chain: frChain, errors: frErrors },
  ja: { chain: jaChain, errors: jaErrors },
} as const;

async function openErrorTab(locale: keyof typeof LOCALES, step: RunStep) {
  const messages = LOCALES[locale];
  const missing: string[] = [];
  render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={messages}
      onError={(error) => missing.push(error.message)}
    >
      <StepDetail step={step} />
    </NextIntlClientProvider>,
  );
  await userEvent.click(
    screen.getByRole("tab", { name: messages.chain.runLogTabError }),
  );
  return missing;
}

describe.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])(
  "StepDetail error tab in %s",
  (locale) => {
    afterEach(cleanup);
    const { runStopped } = LOCALES[locale].errors.chain.runError;

    it("renders the translated step error line for a coded error", async () => {
      const missing = await openErrorTab(locale, makeStep({ errorCode: "runStopped" }));
      expect(missing, missing.join("; ")).toEqual([]);
      expect(screen.getByText(runStopped)).toBeInTheDocument();
      if (locale !== "en") {
        expect(screen.queryByText(enErrors.chain.runError.runStopped)).not.toBeInTheDocument();
      }
    });

    it("falls back to the stored error for legacy steps", async () => {
      await openErrorTab(locale, makeStep({ error: LEGACY_ERROR }));
      expect(screen.getByText(LEGACY_ERROR)).toBeInTheDocument();
    });
  },
);
