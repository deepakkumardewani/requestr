/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import jaChain from "../../../../messages/ja/chain.json";
import type { RunStep } from "@/lib/chainRunHistory";
import { GhostNode } from "../canvas/GhostNode";
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
