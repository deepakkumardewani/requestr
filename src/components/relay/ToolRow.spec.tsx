/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl";
import {
  TOOL_INTERRUPTED_ERROR,
  TOOL_MAYBE_APPLIED_ERROR,
} from "@/lib/relay/errors";
import { relayMessages } from "./relayIntlMock";
import { isToolPart, ToolRow, type ToolRowPart } from "./ToolRow";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const en = relayMessages("en");
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { relay: en } as never,
      namespace: namespace as never,
    }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
  vi.restoreAllMocks();
});

const part = (overrides: Partial<ToolRowPart> & { type: string }): ToolRowPart => ({
  state: "output-available",
  ...overrides,
});

const row = () => screen.getByTestId("relay-tool-row");

describe("ToolRow phases and labels", () => {
  it("shows the running label while the call has no result", () => {
    render(<ToolRow part={part({ type: "tool-get_request", state: "input-available" })} />);
    expect(row()).toHaveAttribute("data-state", "running");
    expect(row()).toHaveTextContent("Reading request");
    expect(row()).not.toHaveAttribute("role");
  });

  it("shows the done label with the target taken from the result", () => {
    render(
      <ToolRow
        part={part({
          type: "tool-get_request",
          output: { ok: true, data: { method: "GET", url: "https://api.test/users" } },
        })}
      />,
    );
    expect(row()).toHaveAttribute("data-state", "done");
    expect(row()).toHaveTextContent("Read request: GET https://api.test/users");
  });

  it("names the search query from the input", () => {
    render(
      <ToolRow
        part={part({
          type: "tool-search_workspace",
          input: { query: "users" },
          output: { ok: true, data: {} },
        })}
      />,
    );
    expect(row()).toHaveTextContent("Searched for users");
  });

  it("names a collection and an environment from the result", () => {
    const { rerender } = render(
      <ToolRow part={part({ type: "tool-get_collection", output: { ok: true, data: { name: "API" } } })} />,
    );
    expect(row()).toHaveTextContent("Read collection: API");
    rerender(
      <ToolRow part={part({ type: "tool-get_environment", output: { ok: true, data: { name: "Prod" } } })} />,
    );
    expect(row()).toHaveTextContent("Read environment: Prod");
  });

  it("says there is no response yet when the last response is unavailable", () => {
    render(
      <ToolRow
        part={part({ type: "tool-get_last_response", output: { ok: true, data: { available: false } } })}
      />,
    );
    expect(row()).toHaveTextContent("Read last response: no response yet");
  });

  it("shows the status of the last response", () => {
    render(
      <ToolRow
        part={part({ type: "tool-get_last_response", output: { ok: true, data: { status: 404 } } })}
      />,
    );
    expect(row()).toHaveTextContent("Read last response: 404");
  });

  it("uses the generic label for a tool it does not know", () => {
    render(<ToolRow part={part({ type: "tool-mystery", output: { ok: true } })} />);
    expect(row()).toHaveTextContent("Finished a step");
  });

  it("treats a non-object result as no outcome", () => {
    render(<ToolRow part={part({ type: "tool-get_request", output: "plain text" })} />);
    expect(row()).toHaveAttribute("data-state", "done");
  });

  it("shows the step duration only when given", () => {
    const { rerender } = render(<ToolRow part={part({ type: "tool-get_request", output: { ok: true } })} />);
    expect(screen.queryByTestId("relay-step-duration")).toBeNull();
    rerender(<ToolRow part={part({ type: "tool-get_request", output: { ok: true } })} seconds={3} />);
    expect(screen.getByTestId("relay-step-duration")).toHaveTextContent("3s");
  });
});

describe("ToolRow failures", () => {
  it("shows a failed row as an alert with the readable error", () => {
    render(
      <ToolRow
        part={part({ type: "tool-get_request", output: { ok: false, error: "Request not found." } })}
      />,
    );
    expect(screen.getByRole("alert")).toBe(row());
    expect(row()).toHaveAttribute("data-state", "failed");
    expect(row()).toHaveTextContent("Step failed");
    expect(screen.getByTestId("relay-tool-error")).toHaveTextContent("Request not found.");
  });

  it("reads the error text of an errored part", () => {
    render(<ToolRow part={part({ type: "tool-get_request", state: "output-error", errorText: "Boom" })} />);
    expect(screen.getByTestId("relay-tool-error")).toHaveTextContent("Boom");
  });

  it("withholds error text that names an internal tool but still fails the row", () => {
    render(
      <ToolRow
        part={part({ type: "tool-get_request", output: { ok: false, error: "get_request exploded" } })}
      />,
    );
    expect(row()).toHaveAttribute("data-state", "failed");
    expect(screen.queryByTestId("relay-tool-error")).toBeNull();
  });
});

describe("ToolRow interruption (HH-M22, L-18)", () => {
  const interrupted = (error: string, type = "tool-update_request") =>
    part({ type, output: { ok: false, error } });

  it("an unknown-outcome call reads Interrupted, with no error text and no review link", () => {
    render(<ToolRow part={interrupted(TOOL_INTERRUPTED_ERROR)} changesAnchor="turn-changes" />);
    expect(row()).toHaveTextContent("Interrupted");
    expect(row()).not.toHaveTextContent("may have applied");
    expect(row()).not.toHaveTextContent("Step failed");
    expect(screen.queryByTestId("relay-tool-error")).toBeNull();
    expect(screen.queryByTestId("relay-tool-review-changes")).toBeNull();
  });

  it("an approved call the page closed on says it may have applied and never reads Declined", () => {
    render(<ToolRow part={interrupted(TOOL_MAYBE_APPLIED_ERROR, "tool-import_backup")} />);
    expect(row()).toHaveTextContent("Interrupted, may have applied");
    expect(row()).not.toHaveTextContent(/declined/i);
    expect(screen.queryByTestId("relay-tool-error")).toBeNull();
  });

  it("links to the change log when the turn logged changes", () => {
    const scrollIntoView = vi.fn();
    const anchor = document.createElement("div");
    anchor.id = "turn-changes";
    anchor.scrollIntoView = scrollIntoView;
    document.body.append(anchor);
    render(<ToolRow part={interrupted(TOOL_MAYBE_APPLIED_ERROR)} changesAnchor="turn-changes" />);
    fireEvent.click(screen.getByTestId("relay-tool-review-changes"));
    expect(screen.getByTestId("relay-tool-review-changes")).toHaveTextContent("Review changes");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    anchor.remove();
  });

  it("does not throw when the change log element is gone", () => {
    render(<ToolRow part={interrupted(TOOL_MAYBE_APPLIED_ERROR)} changesAnchor="missing" />);
    expect(() => fireEvent.click(screen.getByTestId("relay-tool-review-changes"))).not.toThrow();
  });

  it("offers no review link when the turn logged no changes", () => {
    render(<ToolRow part={interrupted(TOOL_MAYBE_APPLIED_ERROR)} />);
    expect(screen.queryByTestId("relay-tool-review-changes")).toBeNull();
  });
});

describe("ToolRow Open for created entities", () => {
  it("opens the entity a create tool made", () => {
    render(
      <ToolRow
        part={part({
          type: "tool-create_environment",
          output: { ok: true, data: { createdIds: ["env1"] } },
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/environments");
  });

  it("offers no Open for a failed create", () => {
    render(
      <ToolRow
        part={part({
          type: "tool-create_environment",
          output: { ok: false, error: "No." },
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });
});

describe("isToolPart", () => {
  it("accepts tool parts and rejects text and reasoning parts", () => {
    expect(isToolPart({ type: "tool-get_request" } as never)).toBe(true);
    expect(isToolPart({ type: "text", text: "hi" } as never)).toBe(false);
    expect(isToolPart({ type: "reasoning", text: "hm" } as never)).toBe(false);
  });
});
