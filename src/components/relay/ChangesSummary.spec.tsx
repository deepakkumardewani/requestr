/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangesSummary as Model, SummaryRow } from "@/lib/relay/changesSummary";
import { createTranslator } from "use-intl";
import { ChangesSummary } from "./ChangesSummary";
import { relayMessages } from "./relayIntlMock";

const en = relayMessages("en");

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { relay: en } as never,
      namespace: namespace as never,
    }),
}));

afterEach(cleanup);

const row = (overrides: Partial<SummaryRow> = {}): SummaryRow => ({
  changeId: "c1",
  op: "created",
  kind: "request",
  label: "List users",
  open: { enabled: true, target: { kind: "request", id: "r1" } },
  ...overrides,
});

const model = (rows: SummaryRow[], groups: Model["groups"] = []): Model => ({
  rows,
  groups,
});

describe("ChangesSummary", () => {
  it("renders nothing without rows", () => {
    const { container } = render(<ChangesSummary summary={model([])} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the headline, rows and the turn action", () => {
    render(
      <ChangesSummary
        summary={model(
          [row(), row({ changeId: "c2", op: "updated", kind: "chain", label: "Flow" })],
          [
            { op: "created", kind: "request", count: 1 },
            { op: "updated", kind: "chain", count: 1 },
          ],
        )}
        onOpen={vi.fn()}
        action={<button type="button">Undo all</button>}
      />,
    );
    expect(screen.getByTestId("relay-changes-headline")).toHaveTextContent(
      "Created 1 request, updated 1 chain",
    );
    expect(screen.getByRole("region", { name: "Changes in this reply" })).toBeInTheDocument();
    const rows = screen.getAllByTestId("relay-changes-row");
    expect(rows.map((item) => item.getAttribute("data-op"))).toEqual(["created", "updated"]);
    expect(screen.getByRole("button", { name: "Undo all" })).toBeInTheDocument();
  });

  it("opens the row's target when Open is clicked", () => {
    const onOpen = vi.fn();
    render(<ChangesSummary summary={model([row()])} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith({ kind: "request", id: "r1" });
  });

  it("labels a settings row Open Settings and opens its section", () => {
    const onOpen = vi.fn();
    const target = { kind: "settings", id: "global" } as const;
    render(
      <ChangesSummary
        summary={model([row({ kind: "item", open: { enabled: true, target } })])}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(target);
  });

  it.each([
    ["deleted", "Deleted"],
    ["undone", "Undone"],
  ] as const)("disables Open with the %s reason", (reason, text) => {
    const onOpen = vi.fn();
    render(
      <ChangesSummary
        summary={model([row({ open: { enabled: false, reason } })])}
        onOpen={onOpen}
      />,
    );
    const button = screen.getByRole("button", { name: "Open" });
    expect(button).toBeDisabled();
    const reasonEl = screen.getByTestId("relay-changes-reason");
    expect(reasonEl).toHaveTextContent(text);
    expect(button).toHaveAttribute("aria-describedby", reasonEl.id);
    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("strikes through the label of an undone row only", () => {
    render(
      <ChangesSummary
        summary={model([
          row({ label: "Gone", open: { enabled: false, reason: "undone" } }),
          row({ changeId: "c2", label: "Kept" }),
        ])}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText("Gone")).toHaveClass("line-through");
    expect(screen.getByText("Kept")).not.toHaveClass("line-through");
  });

  it("omits the button and reason when a row cannot open", () => {
    render(<ChangesSummary summary={model([row({ open: null })])} onOpen={vi.fn()} />);
    const item = screen.getByTestId("relay-changes-row");
    expect(within(item).queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("relay-changes-reason")).toBeNull();
  });

  it("renders without a Show details control", () => {
    render(<ChangesSummary summary={model([row()])} onOpen={vi.fn()} />);
    expect(screen.queryByText(/show details/i)).toBeNull();
  });

  it.each(["request", "chain", "collection", "environment", "item"] as const)(
    "renders a %s row with an icon",
    (kind) => {
      const { container } = render(
        <ChangesSummary summary={model([row({ kind })])} onOpen={vi.fn()} />,
      );
      expect(container.querySelector("li svg")).not.toBeNull();
    },
  );
});
