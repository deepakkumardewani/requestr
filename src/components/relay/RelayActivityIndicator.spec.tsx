/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RelayActivityIndicator } from "./RelayActivityIndicator";

afterEach(cleanup);

const classesOf = (el: HTMLElement) => el.className.split(/\s+/).filter(Boolean);
const ANIMATION_PREFIXES = ["animate-", "bg-clip-text", "text-transparent", "bg-[linear", "bg-[length"];

describe("RelayActivityIndicator", () => {
  it("is a polite status region", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("data-kind", "thinking");
  });

  it("shows the thinking label for thinking", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    expect(screen.getByTestId("relay-activity-label")).toHaveTextContent(
      "activity.thinking",
    );
  });

  it("shows the step label for a tool with a target name", () => {
    render(
      <RelayActivityIndicator
        activity={{ kind: "tool", toolName: "create_collection", input: { name: "Orders" } }}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("data-kind", "tool");
    expect(screen.getByTestId("relay-activity-label")).toHaveTextContent(
      "activity.tools.create_collection",
    );
  });

  it("shows the generic label for an unknown tool", () => {
    render(
      <RelayActivityIndicator
        activity={{ kind: "tool", toolName: "mystery", input: {} }}
      />,
    );
    expect(screen.getByTestId("relay-activity-label")).toHaveTextContent(
      "activity.generic",
    );
  });

  it("hides the decorative dot from assistive tech", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    expect(screen.getByTestId("relay-activity-dot")).toHaveAttribute("aria-hidden", "true");
  });

  it("gates every shimmer class on motion-safe", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    const animated = classesOf(screen.getByTestId("relay-activity-label")).filter(
      (c) => ANIMATION_PREFIXES.some((p) => c.includes(p)),
    );
    expect(animated.length).toBeGreaterThan(0);
    for (const c of animated) expect(c.startsWith("motion-safe:")).toBe(true);
  });

  it("gates the dot pulse on motion-safe", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    const dot = classesOf(screen.getByTestId("relay-activity-dot"));
    expect(dot).toContain("motion-safe:animate-pulse");
    expect(dot.filter((c) => c.includes("animate-") && !c.startsWith("motion-safe:"))).toEqual([]);
  });

  it("applies no shimmer to a tool step label", () => {
    render(
      <RelayActivityIndicator
        activity={{ kind: "tool", toolName: "get_request", input: {} }}
      />,
    );
    expect(screen.getByTestId("relay-activity-label").className).toBe("");
  });
});
