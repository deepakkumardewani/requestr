/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en/chain.json";
import {
  RunLogCollapsedBar,
  TONE_TEXT_CLASSES,
  type RunLogCollapsedBarProps,
} from "./RunLogCollapsedBar";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const template = (en as Record<string, string>)[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name]));
  },
  useFormatter: () => ({
    relativeTime: () => "5s ago",
    dateTime: () => "ABS",
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement<Record<string, unknown>>;
    children: React.ReactNode;
  }) => <render.type {...render.props}>{children}</render.type>,
  TooltipContent: () => null,
}));

type Run = NonNullable<RunLogCollapsedBarProps["run"]>;

const START = 1_000_000;

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    status: "passed",
    counts: { passed: 3, failed: 0, skipped: 0, aborted: 0 },
    startedAt: START,
    finishedAt: START + 1200,
    ...overrides,
  };
}

function renderBar(props: Partial<RunLogCollapsedBarProps> = {}) {
  const onExpand = vi.fn();
  render(
    <RunLogCollapsedBar
      run={makeRun()}
      now={START + 5000}
      panelId="panel-1"
      onExpand={onExpand}
      {...props}
    />
  );
  return { onExpand, strip: screen.getByTestId("run-log-strip") };
}

function renderBarCount(
  override: null | Partial<ReturnType<typeof makeRun>>
): number {
  cleanup();
  const { strip } = renderBar({
    run: override ? makeRun({ finishedAt: undefined, ...override }) : null,
    progress: { done: 1, total: 2 },
  });
  return strip.querySelectorAll("span[aria-hidden='true']").length;
}

describe("RunLogCollapsedBar", () => {
  afterEach(cleanup);

  it("renders the no-runs variant", () => {
    const { strip } = renderBar({ run: null });
    expect(strip).toHaveTextContent("Run Log · No runs yet");
    expect(strip.querySelector("time")).toBeNull();
  });

  it("renders a passed run with counts, duration and relative time", () => {
    const { strip } = renderBar();
    expect(strip).toHaveTextContent(
      "Run Log · Last run passed · 3 passed · 1.2s · 5s ago"
    );
  });

  it("joins multiple count buckets", () => {
    const { strip } = renderBar({
      run: makeRun({
        status: "failed",
        counts: { passed: 2, failed: 1, skipped: 1, aborted: 0 },
      }),
    });
    expect(strip).toHaveTextContent(
      "Run Log · Last run failed · 2 passed, 1 failed, 1 skipped · 1.2s · 5s ago"
    );
    expect(strip.className).toContain("bg-red-500/10");
  });

  it("renders the running variant with step progress and no duration", () => {
    const { strip } = renderBar({
      run: makeRun({ status: "running", finishedAt: undefined }),
      progress: { done: 3, total: 5 },
    });
    expect(strip).toHaveTextContent("Run Log · Running · 3 of 5 steps");
    expect(strip.querySelector("time")).toBeNull();
    expect(strip.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("falls back to the bare running word without progress", () => {
    const { strip } = renderBar({
      run: makeRun({ status: "running", finishedAt: undefined }),
    });
    expect(strip).toHaveTextContent("Run Log · Running");
  });

  it("renders the zero-steps variant", () => {
    const { strip } = renderBar({
      run: makeRun({
        counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
      }),
    });
    expect(strip).toHaveTextContent(
      "Run Log · Last run passed · No steps recorded · 1.2s · 5s ago"
    );
  });

  it("distinguishes stopped from failed by word, icon and tone", () => {
    cleanup();
    const stopped = renderBar({
      run: makeRun({
        status: "passed",
        counts: { passed: 0, failed: 0, skipped: 0, aborted: 2 },
      }),
    }).strip;
    expect(stopped).toHaveTextContent("Run Log · Last run stopped · Stopped");
    expect(stopped.className).toContain("bg-amber-500/10");
    const stoppedIcon = stopped.querySelector("svg")?.getAttribute("class");
    cleanup();

    const failed = renderBar({
      run: makeRun({
        status: "failed",
        counts: { passed: 0, failed: 1, skipped: 0, aborted: 0 },
      }),
    }).strip;
    expect(failed).not.toHaveTextContent("Stopped");
    expect(failed.querySelector("svg")?.getAttribute("class")).not.toBe(
      stoppedIcon
    );
    expect(stoppedIcon).toContain(TONE_TEXT_CLASSES.warning);
  });

  it("is a single button with expanded=false and controls wired", () => {
    const { strip } = renderBar();
    expect(strip.tagName).toBe("BUTTON");
    expect(strip).toHaveAttribute("aria-expanded", "false");
    expect(strip).toHaveAttribute("aria-controls", "panel-1");
    expect(
      strip.querySelectorAll(
        "button, a, input, select, textarea, [tabindex], [role='button']"
      )
    ).toHaveLength(0);
  });

  it("hides decorative icons from assistive tech", () => {
    const { strip } = renderBar();
    strip.querySelectorAll("svg").forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("expands on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const { onExpand, strip } = renderBar();
    await user.click(strip);
    strip.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onExpand).toHaveBeenCalledTimes(3);
  });

  it("keeps title and status unshrinkable while time and duration shrink first", () => {
    const { strip } = renderBar();
    expect(screen.getByText("Run Log").className).toContain("shrink-0");
    expect(screen.getByText("Last run passed").className).toContain("shrink-0");
    const time = strip.querySelector("time") as HTMLElement;
    const duration = screen.getByText("1.2s");
    expect(time.className).toContain("shrink-[3]");
    expect(duration.className).toContain("shrink-[2]");
    expect(strip.className).toContain("min-w-0");
  });

  it("renders one decorative separator between every present segment", () => {
    const { strip } = renderBar();
    const seps = strip.querySelectorAll("span[aria-hidden='true']");
    expect(seps).toHaveLength(4);
    seps.forEach((s) => expect(s.textContent?.trim()).toBe("\u00b7"));
    expect(strip.textContent).not.toMatch(/\u00b7\s*\u00b7/);
    expect(renderBarCount(null)).toBe(1);
    expect(renderBarCount({ status: "running" })).toBe(1);
  });

  it("gives screen readers a punctuated accessible name", () => {
    const { strip } = renderBar();
    expect(strip).toHaveAttribute(
      "aria-label",
      "Run Log, Last run passed, 3 passed, 1.2s, 5s ago"
    );
  });

  it("uses light and dark tone tokens meeting 4.5:1 and no sub-12px text", () => {
    // 700 on light surfaces and 400 on dark surfaces are both >= 4.5:1.
    for (const cls of Object.values(TONE_TEXT_CLASSES)) {
      expect(cls).toMatch(
        /^text-(emerald|red|amber|sky)-700 dark:text-\1-400$/
      );
    }
    const { strip } = renderBar();
    expect(strip.className).toContain("text-xs");
    expect(strip.outerHTML).not.toMatch(/text-\[(\d|1[01])px\]/);
  });

  it("uses a >= 4.5:1 secondary text class on tinted bars, never muted-foreground", () => {
    // muted-foreground is 4.18:1 on the red tint and 4.47:1 on the amber tint (light theme).
    const tinted: Array<[Partial<Run>, string]> = [
      [
        {
          status: "failed",
          counts: { passed: 1, failed: 2, skipped: 0, aborted: 0 },
        },
        "bg-red-500/10",
      ],
      [
        { counts: { passed: 0, failed: 0, skipped: 0, aborted: 2 } },
        "bg-amber-500/10",
      ],
    ];
    for (const [override, tint] of tinted) {
      cleanup();
      const { strip } = renderBar({ run: makeRun(override) });
      expect(strip.className).toContain(tint);
      expect(strip.outerHTML).not.toContain("text-muted-foreground");
      expect(screen.getByText("5s ago").className).toContain(
        "text-foreground/70"
      );
      expect(screen.getByText("1.2s").className).toContain(
        "text-foreground/70"
      );
    }
    cleanup();
    const { strip } = renderBar();
    expect(strip.outerHTML).toContain("text-muted-foreground");
  });
});
