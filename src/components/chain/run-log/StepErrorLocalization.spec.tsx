/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import jaChain from "../../../../messages/ja/chain.json";
import jaErrors from "../../../../messages/ja/errors.json";
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

async function openErrorTab(step: RunStep) {
  render(
    <NextIntlClientProvider
      locale="ja"
      messages={{ chain: jaChain, errors: jaErrors }}
    >
      <StepDetail step={step} />
    </NextIntlClientProvider>,
  );
  const tab = screen.getByRole("tab", { name: jaChain.runLogTabError });
  await userEvent.click(tab);
}

describe("StepDetail error tab in ja", () => {
  afterEach(cleanup);

  it("renders translated text for a coded error without an English string", async () => {
    await openErrorTab(makeStep({ errorCode: "runStopped" }));
    expect(
      screen.getByText(jaErrors.chain.runError.runStopped),
    ).toBeInTheDocument();
  });

  it("falls back to the stored error for legacy steps", async () => {
    await openErrorTab(makeStep({ error: LEGACY_ERROR }));
    expect(screen.getByText(LEGACY_ERROR)).toBeInTheDocument();
  });
});
