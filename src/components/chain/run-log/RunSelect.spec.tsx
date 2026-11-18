/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/chain.json";
import type { RunSummary } from "@/lib/chainRunHistory";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { RunSelect } from "./RunSelect";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const template = (en as Record<string, string>)[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      String(values?.[name] ?? ""),
    );
  },
}));

const CHAIN_ID = "chain-1";

function makeRun(id: string, startedAt: number): RunSummary {
  return {
    id,
    chainId: CHAIN_ID,
    startedAt,
    finishedAt: startedAt + 1200,
    status: "passed",
    trigger: "full",
    counts: { passed: 2, failed: 0, skipped: 0, aborted: 0 },
    bytes: 0,
    schemaVersion: 1,
    steps: [],
  } as unknown as RunSummary;
}

const RUNS = [makeRun("run-a", 1000), makeRun("run-b", 5000)];

beforeEach(() => {
  useChainRunStore.setState({
    runs: { [CHAIN_ID]: RUNS },
    selectedRunId: "run-a",
    selectedStepId: null,
  });
});

afterEach(cleanup);

describe("RunSelect", () => {
  it("exposes an accessible trigger showing the selected run", () => {
    render(<RunSelect runs={RUNS} />);
    expect(
      screen.getByRole("combobox", { name: "Run selection" }),
    ).toBeInTheDocument();
  });

  it("selects the chosen run in the store", async () => {
    const user = userEvent.setup();
    render(<RunSelect runs={RUNS} />);
    await user.click(screen.getByRole("combobox", { name: "Run selection" }));
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    await user.click(options[1]);
    expect(useChainRunStore.getState().selectedRunId).toBe("run-b");
  });
});
