/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import jaChain from "../../../../messages/ja/chain.json";
import type { EvaluateBlock, ValidateBlock } from "@/types/chain";
import { EvaluateConfigPanel } from "./EvaluateConfigPanel";
import { ValidateConfigPanel } from "./ValidateConfigPanel";

// The global setup mocks next-intl with English-only messages; this spec needs the real one.
vi.unmock("next-intl");
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/chainEvalHost", () => ({ runInWorker: vi.fn() }));

const evaluateNode: EvaluateBlock = {
  id: "eval-1",
  type: "evaluate",
  code: "return 1",
  outputAlias: "collect.bad",
};

const validateNode: ValidateBlock = {
  id: "validate-1",
  type: "validate",
  schema: "{}",
  sourceJsonPath: "",
};

function renderJa(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="ja" messages={{ chain: jaChain }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("chain config panels in ja", () => {
  afterEach(cleanup);

  it("renders EvaluateConfigPanel copy in Japanese with no English leftovers", () => {
    renderJa(
      <EvaluateConfigPanel
        open
        node={evaluateNode}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Evaluate を設定")).toBeInTheDocument();
    expect(screen.getByText("出力エイリアス")).toBeInTheDocument();
    expect(screen.getByText("前回の実行でテスト")).toBeInTheDocument();
    expect(screen.queryByText("Configure Evaluate")).toBeNull();
    expect(screen.queryByText("Output alias")).toBeNull();
    expect(screen.queryByText("Test with last run")).toBeNull();
    expect(screen.getByText(/予約されています/)).toBeInTheDocument();
  });

  it("renders ValidateConfigPanel copy in Japanese with no English leftovers", () => {
    renderJa(
      <ValidateConfigPanel
        open
        node={validateNode}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Validate を設定")).toBeInTheDocument();
    expect(screen.getByText("ソース JSONPath")).toBeInTheDocument();
    expect(screen.queryByText("Configure Validate")).toBeNull();
    expect(screen.queryByText("Source JSONPath")).toBeNull();
    expect(screen.queryByText("Save")).toBeNull();
  });
});
