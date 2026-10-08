/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@/lib/chainRunHistory";

const realCopy = vi.hoisted(() => ({ enabled: false }));

vi.mock("next-intl", async () => {
  const en = (await import("../../../../messages/en/chain.json"))
    .default as Record<string, string>;
  const t = (key: string, values?: Record<string, unknown>) => {
    if (realCopy.enabled && key !== "runLogStartedAt") {
      return (en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) =>
        String(values?.[k])
      );
    }
    if (key === "runLogStartedAt") return `started[${values?.time}]`;
    return values ? `${key}(${Object.values(values).join(",")})` : key;
  };
  return {
    useTranslations: () => t,
    useFormatter: () => ({
      relativeTime: (date: number, now: number) =>
        `${Math.round((now - date) / 1000)}s ago`,
      dateTime: (date: number) => `ABS:${date}`,
    }),
  };
});

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement<Record<string, unknown>>;
    children: React.ReactNode;
  }) => <render.type {...render.props}>{children}</render.type>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
}));

import { RelativeNowProvider } from "@/components/chain/RelativeNowProvider";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { RunSummaryHeader } from "./RunSummaryHeader";

const NOW = 1_000_000;

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: "r1",
    chainId: "c1",
    startedAt: NOW - 5000,
    finishedAt: NOW - 3800,
    status: "passed",
    trigger: "full",
    counts: { passed: 2, failed: 0, skipped: 0, aborted: 0 },
    bytes: 1,
    schemaVersion: 1,
    steps: [{}, {}] as RunSummary["steps"],
    ...overrides,
  } as RunSummary;
}

function renderHeader(
  run: RunSummary,
  props: Partial<React.ComponentProps<typeof RunSummaryHeader>> = {}
) {
  const onRerun = vi.fn();
  render(
    <RelativeNowProvider>
      <RunSummaryHeader
        run={run}
        liveNodeIds={new Set(["n1"])}
        onRerun={onRerun}
        {...props}
      />
    </RelativeNowProvider>
  );
  return { onRerun };
}

afterEach(() => {
  cleanup();
  realCopy.enabled = false;
});

describe("RunSummaryHeader", () => {
  it("renders full-run label, started time, duration and step count", () => {
    renderHeader(makeRun());
    const header = screen.getByTestId("run-summary-header");
    expect(header.textContent).toContain("runLogTriggerFull");
    expect(header.textContent).toContain("started[");
    expect(header.textContent).toMatch(/s ago/);
    expect(header.textContent).toContain("1.2s");
    expect(header.textContent).toContain("runLogStepCount(2)");
  });

  it("renders the anchored label with the node name", () => {
    renderHeader(makeRun({ trigger: "fromHere", anchorNodeId: "n1" }), {
      anchorLabel: "Login",
    });
    expect(screen.getByTestId("run-summary-header").textContent).toContain(
      "runLogTriggerFromHere(Login)"
    );
  });

  it("omits duration while the run is live", () => {
    renderHeader(makeRun({ status: "running", finishedAt: undefined }));
    expect(screen.getByTestId("run-summary-header").textContent).not.toContain(
      "1.2s"
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("calls onRerun with the run when enabled", () => {
    const run = makeRun({ trigger: "single", anchorNodeId: "n1" });
    const { onRerun } = renderHeader(run, { anchorLabel: "Login" });
    const button = screen.getByRole("button", { name: /runLogRerun/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(onRerun).toHaveBeenCalledWith(run);
  });

  it("disables Re-run with a tooltip when the anchor node is deleted", () => {
    const { onRerun } = renderHeader(
      makeRun({ trigger: "upTo", anchorNodeId: "gone" })
    );
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(screen.getByTestId("run-summary-header").textContent).toContain(
      "runLogFromDeletedNode"
    );
    expect(button.disabled).toBe(true);
    expect(
      screen.getAllByTestId("tooltip").map((el) => el.textContent)
    ).toContain("runLogRerunDisabledNodeGone");
    fireEvent.click(button);
    expect(onRerun).not.toHaveBeenCalled();
  });

  it("reads the exact acceptance copy in English", () => {
    realCopy.enabled = true;
    const text = () => screen.getByTestId("run-summary-header").textContent;

    renderHeader(makeRun());
    expect(text()).toMatch(/^Full run · /);
    cleanup();

    renderHeader(makeRun({ trigger: "fromHere", anchorNodeId: "n1" }), {
      anchorLabel: "Login",
    });
    expect(text()).toMatch(/^From "Login" · /);
    cleanup();

    renderHeader(makeRun({ trigger: "fromHere", anchorNodeId: "gone" }));
    expect(text()).toMatch(/^From a deleted node · /);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("hides the failure link when no step failed", () => {
    renderHeader(makeRun());
    expect(screen.queryByTestId("run-summary-jump-to-failure")).toBeNull();
  });

  it("selects the first failed step from the failure link", () => {
    renderHeader(
      makeRun({
        steps: [
          { id: "a", state: "passed" },
          { id: "b", state: "failed" },
          { id: "c", state: "failed" },
        ] as RunSummary["steps"],
      })
    );
    fireEvent.click(screen.getByTestId("run-summary-jump-to-failure"));
    expect(useChainRunStore.getState().selectedStepId).toBe("b");
  });
});
