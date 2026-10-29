/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { EmptyState } from "./EmptyState";
import { relayMessages } from "./relayIntlMock";

const en = relayMessages("en");
let mockPathname = "/app";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string, values?: Record<string, string>) => {
      const path = [...namespace.split(".").slice(1), ...key.split(".")];
      const found = path.reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        en,
      ) as string;
      return found.replace(/\{(\w+)\}/g, (_, name) => values?.[name] ?? "");
    };
    return t;
  },
}));

beforeEach(() => {
  mockPathname = "/app";
  useRelayStore.setState({
    pendingPrompt: null,
    composerDraft: null,
    mentionRequest: null,
    attachedItems: [],
    outgoing: null,
    capabilitiesOpen: false,
  });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [], folders: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useChainStore.setState({ chains: {} });
});

const shown = () =>
  screen.getAllByTestId("relay-suggestion").map((el) => el.textContent);

const click = (id: string) =>
  fireEvent.click(
    screen
      .getAllByTestId("relay-suggestion")
      .find((el) => el.getAttribute("data-suggestion") === id) as HTMLElement,
  );

const httpTab = (tabId: string, requestId: string | null, name: string) =>
  ({
    tabId,
    requestId,
    type: "http",
    name,
    url: "https://a.test",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
  }) as never;

const openTab = (requestId: string | null = "r1") =>
  useTabsStore.setState({
    tabs: [httpTab("t1", requestId, "Get Users")],
    activeTabId: "t1",
  });

describe("EmptyState", () => {
  it("leads with the Relay logo, the title and no tab strip or grid", () => {
    render(<EmptyState />);
    const empty = screen.getByTestId("relay-empty");
    expect(screen.getByTestId("relay-logo")).toHaveClass("size-16", "text-foreground");
    expect(empty).toHaveTextContent(en.capabilities.empty.title);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByTestId("relay-capabilities-panel")).toBeNull();
    expect(empty.querySelectorAll("svg.lucide-sparkles")).toHaveLength(0);
  });

  it("shows the generic starters when nothing is open", () => {
    render(<EmptyState />);
    expect(shown()).toEqual([
      en.suggestions.generic.createRequest,
      en.suggestions.generic.importCurl,
      en.suggestions.generic.exploreWorkspace,
      en.suggestions.generic.explainRequest,
    ]);
  });

  it("names the open request in its suggestions", () => {
    openTab();
    render(<EmptyState />);
    expect(shown()).toEqual([
      "Explain Get Users",
      "Run Get Users",
      "Write assertions for Get Users",
    ]);
  });

  it("shows chain-oriented suggestions on a chain page", () => {
    mockPathname = "/chain/ch1";
    useChainStore.setState({ chains: { ch1: { id: "ch1", scope: "standalone", name: "Login flow" } as never } });
    render(<EmptyState />);
    expect(shown()).toEqual([
      "Explain Login flow",
      "Run Login flow",
      "Add a step to Login flow",
    ]);
  });

  it("shows environment-oriented suggestions for the active environment", () => {
    useEnvironmentsStore.setState({ environments: [{ id: "e1", name: "Staging" } as never], activeEnvId: "e1" });
    render(<EmptyState />);
    expect(shown()).toEqual([
      "Explain Staging",
      "Summarize Staging",
      "Add or change variables in Staging",
    ]);
  });

  it("prefers the chain page over a request tab", () => {
    openTab();
    mockPathname = "/chain/ch1";
    useChainStore.setState({ chains: { ch1: { id: "ch1", scope: "standalone", name: "Login flow" } as never } });
    render(<EmptyState />);
    expect(shown()[0]).toBe("Explain Login flow");
  });

  it("falls back to the generic starters on a chain route that is not loaded", () => {
    mockPathname = "/chain/missing";
    render(<EmptyState />);
    expect(shown()[0]).toBe(en.suggestions.generic.createRequest);
  });

  it("follows the open tab as it changes", () => {
    render(<EmptyState />);
    act(() => openTab());
    expect(shown()[0]).toBe("Explain Get Users");
    act(() => useTabsStore.setState({ tabs: [], activeTabId: null }));
    expect(shown()[0]).toBe(en.suggestions.generic.createRequest);
  });

  it("sends a known-target suggestion with its command and request pill", () => {
    openTab();
    render(<EmptyState />);
    click("request-explain");
    const state = useRelayStore.getState();
    const chip = { kind: "request", id: "r1", label: "Get Users" };
    expect(state.outgoing?.attachments).toEqual([chip]);
    expect(state.outgoing?.segments[0]).toEqual({ type: "command", id: "explain", label: "/explain" });
    expect(state.pendingPrompt).toContain("@Get Users");
  });

  it("attaches an unsaved draft as the tab", () => {
    openTab(null);
    render(<EmptyState />);
    click("request-run");
    expect(useRelayStore.getState().outgoing?.attachments).toEqual([
      { kind: "tab", id: "t1", label: "Get Users" },
    ]);
  });

  it("sends a target-free starter through the store", () => {
    render(<EmptyState />);
    click("exploreWorkspace");
    expect(useRelayStore.getState().pendingPrompt).toBe(en.suggestions.generic.exploreWorkspace);
  });

  it("opens the picker when a starter needs a target", () => {
    render(<EmptyState />);
    click("explainRequest");
    const state = useRelayStore.getState();
    expect(state.pendingPrompt).toBeNull();
    expect(state.composerDraft).toEqual([{ type: "text", text: en.suggestions.generic.explainRequest }]);
    expect(state.mentionRequest).toEqual({ kind: "request", hintKey: "slash.hint.explainRequest" });
  });

  it("opens the capabilities popover from a quiet text link", () => {
    render(<EmptyState />);
    const link = screen.getByTestId("relay-see-everything");
    expect(link).toHaveTextContent(en.capabilities.seeEverything);
    fireEvent.click(link);
    expect(useRelayStore.getState().capabilitiesOpen).toBe(true);
  });
});
