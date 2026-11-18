/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import type { RunStep } from "@/lib/chainRunHistory";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { ExtractedTab } from "./ExtractedTab";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

afterEach(cleanup);

function makeStep(
  extractedValues: Record<string, unknown> = {},
  overrides: Partial<RunStep> = {},
): RunStep {
  return {
    id: "step-1",
    nodeId: "node-1",
    nodeType: "api",
    label: "Get users",
    state: "passed",
    startedAt: Date.now(),
    durationMs: 120,
    extractedValues,
    unresolvedVars: [],
    ...overrides,
  };
}

describe("ExtractedTab", () => {
  beforeEach(() => {
    vi.mocked(getDB).mockReturnValue(null);
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    vi.clearAllMocks();
  });

  it("renders the empty state when there are no detailed keys", () => {
    render(<ExtractedTab step={makeStep({})} />);
    expect(screen.getByText("No extracted values")).toBeInTheDocument();
  });

  it("renders the empty state when only bare edgeId keys are present", () => {
    render(<ExtractedTab step={makeStep({ "edge-1": "abc123" })} />);
    expect(screen.getByText("No extracted values")).toBeInTheDocument();
  });

  it("renders alias, path, and destination for a detailed entry", () => {
    render(
      <ExtractedTab
        step={makeStep({ "edge-1:$.data.token": "abc123" })}
      />,
    );
    expect(screen.getByText("token")).toBeInTheDocument();
    expect(screen.getByText("$.data.token")).toBeInTheDocument();
    expect(screen.getByText(/Destination: edge-1/)).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it('renders a "not found" indicator when the value is null', () => {
    render(
      <ExtractedTab step={makeStep({ "edge-1:$.data.token": null })} />,
    );
    expect(screen.getByText("not found")).toBeInTheDocument();
  });

  it("calls onSavePromotion with the correct promotion when promoting a value", async () => {
    const env = useEnvironmentsStore.getState().createEnv("Staging");
    const onSave = vi.fn();

    render(
      <ExtractedTab
        step={makeStep({ "edge-1:$.data.token": "abc123" })}
        onSavePromotion={onSave}
        onRemovePromotion={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Promote to environment variable"));

    await waitFor(() => {
      expect(
        screen.getByText(/promote to environment variable/i),
      ).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/auth_token/i), {
      target: { value: "MY_TOKEN" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith({
      edgeId: "edge-1",
      envId: env.id,
      envVarName: "MY_TOKEN",
    });
  });

  it("does not render the promote popover when handlers are omitted", () => {
    render(
      <ExtractedTab step={makeStep({ "edge-1:$.data.token": "abc123" })} />,
    );
    expect(
      screen.queryByTitle("Promote to environment variable"),
    ).not.toBeInTheDocument();
  });
});
