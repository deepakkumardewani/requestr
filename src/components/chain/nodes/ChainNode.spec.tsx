/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainNode } from "./ChainNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("ChainNode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders method, name, and triggers onClickNode when activated", async () => {
    const user = userEvent.setup();
    const onClickNode = vi.fn();

    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get users",
          method: "GET",
          url: "https://api.example.com/users",
          state: "idle",
          onClickNode,
        }}
      />
    );

    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("Get users")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /GET request Get users, run state idle/,
      })
    );
    expect(onClickNode).toHaveBeenCalledWith("req-1");
  });

  it("shows 'Extract failed' label for extraction errors", () => {
    const fullErrorMsg = "Could not extract value from source response";

    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get data",
          method: "GET",
          url: "https://api.example.com/data",
          state: "skipped",
          error: fullErrorMsg,
          errorKind: "extraction",
        }}
      />
    );

    // Badge shows short label
    expect(screen.getByText("Extract failed")).toBeInTheDocument();

    // Full message is in title attribute (tooltip)
    const badge = screen.getByText("Extract failed");
    expect(badge).toHaveAttribute("title", fullErrorMsg);
  });

  it("shows generic 'Error' label for network errors", () => {
    const networkErrorMsg = "HTTP 500 Internal Server Error";

    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get data",
          method: "GET",
          url: "https://api.example.com/data",
          state: "failed",
          error: networkErrorMsg,
          errorKind: "network",
        }}
      />
    );

    // Badge shows generic label
    expect(screen.getByText("Error")).toBeInTheDocument();

    // Full message is in title attribute (tooltip)
    const badge = screen.getByText("Error");
    expect(badge).toHaveAttribute("title", networkErrorMsg);
  });

  it("shows generic 'Error' label for assertion errors", () => {
    const assertionErrorMsg = "One or more assertions failed";

    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get data",
          method: "GET",
          url: "https://api.example.com/data",
          state: "failed",
          error: assertionErrorMsg,
          errorKind: "assertion",
        }}
      />
    );

    // Badge shows generic label
    expect(screen.getByText("Error")).toBeInTheDocument();

    // Full message is in title attribute (tooltip)
    const badge = screen.getByText("Error");
    expect(badge).toHaveAttribute("title", assertionErrorMsg);
  });

  it("renders an inline error strip below the URL when failed, matching other node types", () => {
    const networkErrorMsg = "HTTP 500 Internal Server Error";

    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get data",
          method: "GET",
          url: "https://api.example.com/data",
          state: "failed",
          error: networkErrorMsg,
          errorKind: "network",
        }}
      />
    );

    const strip = screen.getByText(networkErrorMsg);
    expect(strip.tagName).toBe("P");
    expect(strip).toHaveClass("text-red-400");
  });

  it("truncates the inline error line and exposes the full message via title", () => {
    const longError = "HTTP 500 ".repeat(40).trim();

    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get data",
          method: "GET",
          url: "https://api.example.com/data",
          state: "failed",
          error: longError,
          errorKind: "network",
        }}
      />
    );

    const strip = screen.getByText(longError, { selector: "p" });
    expect(strip).toHaveClass("truncate");
    expect(strip).toHaveAttribute("title", longError);
  });

  it("does not render the inline error strip when there is no error", () => {
    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get data",
          method: "GET",
          url: "https://api.example.com/data",
          state: "idle",
        }}
      />
    );

    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("renders the variables footer with the correct reference and unresolved counts", () => {
    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get user",
          method: "GET",
          url: "https://api.example.com/{{userId}}",
          state: "idle",
          variableFooterTexts: [
            "https://api.example.com/{{userId}}",
            "Bearer {{token}}",
          ],
          variableFooterResolvedNames: ["userId"],
        }}
      />
    );

    expect(screen.getByTestId("node-variables-footer")).toHaveTextContent(
      "Variables (2)"
    );
    expect(
      screen.getByTestId("node-variables-footer-unresolved")
    ).toHaveTextContent("1 unresolved");
  });

  it("does not render the variables footer when the node references no variables", () => {
    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get users",
          method: "GET",
          url: "https://api.example.com/users",
          state: "idle",
          variableFooterTexts: [],
          variableFooterResolvedNames: [],
        }}
      />
    );

    expect(
      screen.queryByTestId("node-variables-footer")
    ).not.toBeInTheDocument();
  });

  it("hosts the toolbar in a NodeHoverFrame so it persists across the hover bridge", () => {
    const { container } = render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get users",
          method: "GET",
          url: "https://api.example.com/users",
          state: "idle",
          onRunNode: vi.fn(),
        }}
      />
    );
    const frame = container.firstElementChild as HTMLElement;

    expect(frame).toHaveClass("group/node", "-mt-9", "pt-9");
    expect(frame.querySelector(".rounded-full.border")).toHaveClass("top-0");
    expect(screen.getByTestId("chain-node-req-1")).toBeInTheDocument();
    expect(container.querySelectorAll(".pt-9")).toHaveLength(1);
  });
  describe.each([
    ["mac", "MacIntel", { run: "⌘Enter", duplicate: "⌘D", remove: "Delete" }],
    [
      "non-mac",
      "Win32",
      { run: "Ctrl+Enter", duplicate: "Ctrl+D", remove: "Delete" },
    ],
  ])("toolbar tooltips on %s", (_name, platform, keys) => {
    it.each([
      ["Run independently", "run"],
      ["Duplicate", "duplicate"],
      ["Remove from chain", "remove"],
    ] as const)("shows the registry shortcut for %s", async (label, key) => {
      vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
      const user = userEvent.setup();
      render(
        <ChainNode
          data={{
            requestId: "req-1",
            name: "Get users",
            method: "GET",
            url: "https://api.example.com/users",
            state: "idle",
            onRunNode: vi.fn(),
            onDuplicateNode: vi.fn(),
            onDeleteNode: vi.fn(),
          }}
        />
      );

      await user.hover(screen.getByRole("button", { name: label }));

      expect(
        await screen.findByText(
          `${label} (${keys[key]})`,
          {},
          { timeout: 2000 }
        )
      ).toBeInTheDocument();
    });
  });

  it("shows the label only for actions without a shortcut", async () => {
    const user = userEvent.setup();
    render(
      <ChainNode
        data={{
          requestId: "req-1",
          name: "Get users",
          method: "GET",
          url: "https://api.example.com/users",
          state: "idle",
          onClickNode: vi.fn(),
        }}
      />
    );

    await user.hover(screen.getByRole("button", { name: "View details" }));

    expect(
      await screen.findByText("View details", {}, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  describe("live request node details", () => {
    const base = {
      requestId: "req-1",
      name: "Get users",
      method: "GET" as const,
      url: "https://api.example.com/users",
      state: "idle" as const,
    };

    it("activates the node with Enter and Space and ignores other keys", async () => {
      const user = userEvent.setup();
      const onClickNode = vi.fn();
      render(<ChainNode data={{ ...base, onClickNode }} />);
      const node = screen.getByTestId("chain-node-req-1");

      node.focus();
      await user.keyboard("a");
      expect(onClickNode).not.toHaveBeenCalled();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");

      expect(onClickNode).toHaveBeenCalledTimes(2);
      expect(onClickNode).toHaveBeenCalledWith("req-1");
    });

    it("shows the unresolved-variable badge with its count", () => {
      render(<ChainNode data={{ ...base, unresolvedVars: ["a", "b"] }} />);

      expect(screen.getByText("2 unresolved")).toBeInTheDocument();
    });

    it("truncates long URLs to 100 characters plus an ellipsis", () => {
      const url = `https://api.example.com/${"x".repeat(150)}`;
      render(<ChainNode data={{ ...base, url }} />);

      expect(screen.getByText(`${url.slice(0, 100)}\u2026`)).toBeInTheDocument();
      expect(screen.queryByText(url)).not.toBeInTheDocument();
    });

    it("reveals the full URL in a tooltip for long URLs", async () => {
      const user = userEvent.setup();
      const url = `https://api.example.com/${"y".repeat(150)}`;
      render(<ChainNode data={{ ...base, url }} />);

      await user.hover(screen.getByText(`${url.slice(0, 100)}\u2026`));

      expect(
        await screen.findByText(url, {}, { timeout: 2000 })
      ).toBeInTheDocument();
    });

    it("edits the request from the pencil without activating the node", async () => {
      const user = userEvent.setup();
      const onEditRequest = vi.fn();
      const onClickNode = vi.fn();
      const { container } = render(
        <ChainNode data={{ ...base, onEditRequest, onClickNode }} />
      );
      const pencil = container.querySelector(
        "button.shrink-0.opacity-0"
      ) as HTMLElement;

      await user.click(pencil);

      expect(onEditRequest).toHaveBeenCalledWith("req-1");
      expect(onClickNode).not.toHaveBeenCalled();
    });
  });

  describe("missing request placeholder", () => {
    const missingData = (handlers: Record<string, unknown> = {}) => ({
      requestId: "ghost",
      name: "",
      method: "GET" as const,
      url: "",
      state: "idle" as const,
      missing: true,
      ...handlers,
    });

    it("renders the broken state with title and hint instead of the request", () => {
      render(<ChainNode data={missingData()} />);

      expect(screen.getByTestId("chain-node-ghost")).toBeInTheDocument();
      expect(screen.getByText("Missing request")).toBeInTheDocument();
      expect(
        screen.getByText(
          "This request was deleted or not restored. Remove the block from the chain."
        )
      ).toBeInTheDocument();
      expect(screen.queryByText("GET")).not.toBeInTheDocument();
    });

    it("offers delete only: no run, details or duplicate actions", async () => {
      const user = userEvent.setup();
      const onDeleteNode = vi.fn();
      render(
        <ChainNode
          data={missingData({
            onDeleteNode,
            onRunNode: vi.fn(),
            onClickNode: vi.fn(),
            onDuplicateNode: vi.fn(),
            onEditRequest: vi.fn(),
          })}
        />
      );

      expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Duplicate" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "View details" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove from chain" }));
      expect(onDeleteNode).toHaveBeenCalledWith("ghost");
    });
  });
});
