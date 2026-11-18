/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { READ_SEGMENT } from "@/lib/relay/stepLabels";
import type { TurnLabel } from "@/lib/relay/timing";
import { ReadsLine, ThoughtLine, WorkedGroup } from "./WorkedGroup";

vi.mock("next-intl", async () => {
  const { relayIntlMock } = await import("./relayIntlMock");
  const real = relayIntlMock();
  // The shared mock cannot expand ICU plurals, so counted keys render as "key:count".
  const translate = (key: string, values?: Record<string, string | number>) =>
    values?.count === undefined
      ? real.useTranslations()(key, values)
      : `${key.split(".").pop()}:${values.count}`;
  return { ...real, useTranslations: () => translate };
});

afterEach(cleanup);

const toggle = () => screen.getByRole("button");

describe("WorkedGroup", () => {
  it("is collapsed by default and hides its children", () => {
    render(
      <WorkedGroup label={{ kind: "worked", seconds: 12 }}>
        <p>inner step</p>
      </WorkedGroup>,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent("Worked for 12s");
    expect(screen.queryByText("inner step")).toBeNull();
    expect(screen.queryByTestId("relay-worked-group-body")).toBeNull();
  });

  it("expands and collapses on click, wiring aria-controls to the body", () => {
    render(
      <WorkedGroup label={{ kind: "worked", seconds: 3 }}>
        <p>inner step</p>
      </WorkedGroup>,
    );
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("inner step")).toBeInTheDocument();
    const body = screen.getByTestId("relay-worked-group-body");
    expect(toggle().getAttribute("aria-controls")).toBe(body.id);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("inner step")).toBeNull();
  });

  it("shows a stale-card line passed in as a child once expanded", () => {
    render(
      <WorkedGroup label={{ kind: "worked", seconds: 5 }}>
        <p>Skipped because the chat moved on</p>
      </WorkedGroup>,
    );
    expect(screen.queryByText(/Skipped because/)).toBeNull();
    fireEvent.click(toggle());
    expect(screen.getByTestId("relay-worked-group-body")).toHaveTextContent(
      "Skipped because the chat moved on",
    );
  });

  it.each<[TurnLabel, string]>([
    [{ kind: "worked", seconds: 65 }, "Worked for 1m 5s"],
    [{ kind: "stopped", seconds: 4 }, "Stopped after 4s"],
    [{ kind: "failed", seconds: 7 }, "Failed after 7s"],
    [{ kind: "interrupted", seconds: 9 }, "Interrupted after 9s"],
    [{ kind: "legacy" }, "Worked"],
    [{ kind: "worked" }, "Worked for 0s"],
  ])("renders the %o label", (label, text) => {
    render(<WorkedGroup label={label}>x</WorkedGroup>);
    expect(toggle()).toHaveTextContent(new RegExp(`^${text}$`));
    expect(screen.getByTestId("relay-worked-group")).toHaveAttribute("data-label", label.kind);
  });
});

describe("ReadsLine", () => {
  it("joins the segments into one capitalised line", () => {
    render(
      <ReadsLine
        segments={[
          { key: READ_SEGMENT.request, count: 3 },
          { key: READ_SEGMENT.searched, count: 1 },
        ]}
      />,
    );
    expect(screen.getByTestId("relay-reads-line")).toHaveTextContent(
      "ReadRequest:3, searched:1",
    );
    expect(screen.queryByTestId("relay-step-duration")).toBeNull();
  });

  it("shows the duration when given, including zero", () => {
    render(<ReadsLine segments={[{ key: READ_SEGMENT.item, count: 1 }]} seconds={0} />);
    expect(screen.getByTestId("relay-step-duration")).toHaveTextContent("0s");
  });
});

describe("ThoughtLine", () => {
  it("shows the thinking duration", () => {
    render(<ThoughtLine seconds={75} />);
    expect(screen.getByTestId("relay-thought-line")).toHaveTextContent("Thought 1m 15s");
  });
});
