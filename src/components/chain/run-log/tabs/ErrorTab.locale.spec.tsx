/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { CHAIN_ERROR_CODE } from "@/lib/chainRunner/errorCodes";
import enMessages from "../../../../../messages/en";
import jaMessages from "../../../../../messages/ja";
import { ErrorTab } from "./ErrorTab";

// The global setup stubs next-intl with English only; these tests need the real provider.
vi.unmock("next-intl");

afterEach(cleanup);

const step: RunStep = {
  id: "step-1",
  nodeId: "node-1",
  nodeType: "display",
  label: "Show",
  state: "failed",
  startedAt: 0,
  durationMs: 1,
  extractedValues: {},
  unresolvedVars: [],
  error: 'Could not extract "$.id" from source response',
  errorCode: CHAIN_ERROR_CODE.DISPLAY_EXTRACT_FAILED,
  errorParams: { path: "$.id" },
};

function renderIn(locale: "en" | "ja", ui: React.ReactElement) {
  const messages = locale === "en" ? enMessages : jaMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ErrorTab error codes", () => {
  it("translates the code with its params in en", () => {
    renderIn("en", <ErrorTab step={step} errorKind="extraction" />);
    expect(
      screen.getByText('Could not extract "$.id" from source response'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Extraction error/)).toBeInTheDocument();
  });

  it("translates the code with its params in ja", () => {
    renderIn("ja", <ErrorTab step={step} errorKind="extraction" />);
    expect(
      screen.getByText('ソースレスポンスから "$.id" を抽出できませんでした'),
    ).toBeInTheDocument();
    expect(screen.getByText(/抽出エラー/)).toBeInTheDocument();
  });

  it("shows the stored text for legacy steps without a code", () => {
    renderIn(
      "ja",
      <ErrorTab
        step={{ ...step, errorCode: undefined, errorParams: undefined }}
      />,
    );
    expect(
      screen.getByText('Could not extract "$.id" from source response'),
    ).toBeInTheDocument();
  });
});
