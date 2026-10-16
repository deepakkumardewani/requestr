// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRelayChangeLog } from "@/lib/relay/changeLog";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { TabState } from "@/types";
import { ApplyCodeAction } from "./ApplyCodeAction";

vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const httpTab = {
  tabId: "tab-http",
  type: "http",
  requestId: null,
  name: "H",
  method: "GET",
  url: "https://api.test/a",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
} as unknown as TabState;
const graphqlTab = {
  tabId: "tab-gql",
  type: "graphql",
  requestId: null,
  name: "G",
  url: "https://api.test/graphql",
  headers: [],
  query: "{ a }",
  variables: "{}",
  operationName: "",
  auth: { type: "none" },
} as unknown as TabState;
const wsTab = {
  tabId: "tab-ws",
  type: "websocket",
  requestId: null,
  name: "W",
  url: "wss://x",
  headers: [],
  draft: "old",
} as unknown as TabState;

function activate(tab: TabState | null) {
  useTabsStore.setState({ tabs: tab ? [tab] : [], activeTabId: tab?.tabId ?? null });
}
const tabNow = (id: string) =>
  useTabsStore.getState().tabs.find((t) => t.tabId === id) as unknown as Record<string, unknown>;

beforeEach(() => {
  useRelayStore.setState({ activeThreadId: "thread-1" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ApplyCodeAction", () => {
  it("is disabled with a reason when no request tab is open", () => {
    activate(null);
    render(<ApplyCodeAction code="x" />);
    const button = screen.getByTestId("relay-apply-code");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby");
    expect(screen.getByText("Open a request tab to apply this")).toHaveClass("sr-only");
    expect(button.parentElement).toHaveAttribute("title", "Open a request tab to apply this");
  });

  it("disables a GraphQL tab for invalid JSON", () => {
    activate(graphqlTab);
    render(<ApplyCodeAction code="{oops" />);
    expect(screen.getByTestId("relay-apply-code")).toBeDisabled();
    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
  });

  it("asks to confirm and cancels without touching the tab", () => {
    activate(httpTab);
    render(<ApplyCodeAction code='{"a":1}' />);
    fireEvent.click(screen.getByRole("button", { name: "Apply as body" }));
    expect(screen.getByRole("alertdialog", { name: "Replace the body of this request?" })).toBeInTheDocument();
    expect(screen.getByText("Only this field changes. Nothing is sent.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-apply-cancel"));
    expect(screen.getByTestId("relay-apply-code")).toBeEnabled();
    expect(tabNow("tab-http").body).toEqual({ type: "none", content: "" });
  });

  it("applies an HTTP body only, then shows Undo that restores it", async () => {
    activate(httpTab);
    render(<ApplyCodeAction code='{"a":1}' />);
    fireEvent.click(screen.getByTestId("relay-apply-code"));
    fireEvent.click(screen.getByTestId("relay-apply-confirm-button"));
    await waitFor(() => expect(screen.getByText("Apply as body")).toBeInTheDocument());
    expect(tabNow("tab-http").body).toEqual({ type: "json", content: '{"a":1}' });
    expect(tabNow("tab-http").url).toBe("https://api.test/a");
    expect(screen.queryByTestId("relay-apply-confirm")).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: /undo/i }));
    await waitFor(() =>
      expect(tabNow("tab-http").body).toEqual({ type: "none", content: "" }),
    );
  });

  it("applies GraphQL variables only", async () => {
    activate(graphqlTab);
    render(<ApplyCodeAction code='{"id":2}' />);
    fireEvent.click(screen.getByRole("button", { name: "Apply as variables" }));
    expect(screen.getByRole("alertdialog", { name: "Replace the variables of this query?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-apply-confirm-button"));
    await waitFor(() => expect(tabNow("tab-gql").variables).toBe('{"id":2}'));
    expect(tabNow("tab-gql").query).toBe("{ a }");
  });

  it("applies a WebSocket draft without sending or connecting", async () => {
    activate(wsTab);
    render(<ApplyCodeAction code="hello" />);
    fireEvent.click(screen.getByRole("button", { name: "Apply as message" }));
    expect(screen.getByRole("alertdialog", { name: "Replace the message draft?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-apply-confirm-button"));
    await waitFor(() => expect(tabNow("tab-ws").draft).toBe("hello"));
    expect(tabNow("tab-ws").name).toBe("W");
    expect(tabNow("tab-ws").headers).toEqual([]);
    expect(tabNow("tab-ws").url).toBe("wss://x");
  });

  it("uses an empty thread id when no thread is active", async () => {
    useRelayStore.setState({ activeThreadId: null });
    const apply = vi.spyOn(getRelayChangeLog(), "apply");
    activate(wsTab);
    render(<ApplyCodeAction code="m" />);
    fireEvent.click(screen.getByTestId("relay-apply-code"));
    fireEvent.click(screen.getByTestId("relay-apply-confirm-button"));
    await waitFor(() => expect(apply).toHaveBeenCalled());
    expect(apply.mock.calls[0][0]).toMatchObject({ threadId: "", toolCallId: "code-apply" });
  });

  it("shows a failure message and stays retryable when the write fails", async () => {
    vi.spyOn(getRelayChangeLog(), "apply").mockResolvedValue({
      ok: false,
      error: "nope",
    } as never);
    activate(wsTab);
    render(<ApplyCodeAction code="m" />);
    fireEvent.click(screen.getByTestId("relay-apply-code"));
    fireEvent.click(screen.getByTestId("relay-apply-confirm-button"));
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't apply this code.");
    expect(screen.getByTestId("relay-apply-code")).toBeEnabled();
    expect(tabNow("tab-ws").draft).toBe("old");
  });

  it("does nothing on confirm if the tab disappeared", async () => {
    activate(wsTab);
    const apply = vi.spyOn(getRelayChangeLog(), "apply");
    render(<ApplyCodeAction code="m" />);
    fireEvent.click(screen.getByTestId("relay-apply-code"));
    activate(null);
    // With no tab the confirm step is replaced by the disabled button.
    await waitFor(() => expect(screen.getByTestId("relay-apply-code")).toBeDisabled());
    expect(apply).not.toHaveBeenCalled();
  });
});
