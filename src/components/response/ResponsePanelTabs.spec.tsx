/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab } from "@/types";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => null,
}));
vi.mock("@/hooks/useAI", () => ({
  useAI: vi.fn(() => ({ run: vi.fn(), loading: false, error: null, reset: vi.fn() })),
}));

import React from "react";
import { ResponsePanel } from "./ResponsePanel";

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useResponseStore.setState({
    responses: {},
    loading: {},
    errors: {},
    scriptLogs: {},
    assertionResults: {},
    unresolvedVars: {},
  });
}

function seedTab(): string {
  useTabsStore.getState().openTab({ type: "http" } as Partial<HttpTab>);
  return (useTabsStore.getState().tabs[0] as HttpTab).tabId;
}

function seedResponse(tabId: string, overrides: Record<string, unknown> = {}) {
  useResponseStore.setState({
    responses: {
      [tabId]: {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        body: '{"ok":true}',
        duration: 100,
        size: 20,
        url: "https://example.com",
        method: "GET",
        timestamp: Date.now(),
        timing: undefined,
        ...overrides,
      },
    },
  });
}

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

// ── 3.1 Restructured tabs ────────────────────────────────────────────────────

describe("ResponsePanel — tab restructure (Epic 3.1)", () => {
  it("shows Response, Headers, Timing as primary tabs", () => {
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    expect(screen.getByTestId("response-tab-response")).toBeInTheDocument();
    expect(screen.getByTestId("response-tab-headers")).toBeInTheDocument();
    expect(screen.getByTestId("response-tab-timing")).toBeInTheDocument();
  });

  it("shows More button in tab bar", () => {
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    expect(screen.getByTestId("response-tab-more")).toBeInTheDocument();
  });

  it("does NOT show separate pretty/raw/preview/console tabs in primary bar", () => {
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    expect(screen.queryByTestId("response-tab-pretty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("response-tab-raw")).not.toBeInTheDocument();
    expect(screen.queryByTestId("response-tab-console")).not.toBeInTheDocument();
  });

  it("shows Console option inside More dropdown", async () => {
    const user = userEvent.setup();
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    await user.click(screen.getByTestId("response-tab-more"));
    expect(screen.getByTestId("response-more-console")).toBeInTheDocument();
  });

  it("shows dot indicator on More button when console has logs", () => {
    const tabId = seedTab();
    seedResponse(tabId);
    useResponseStore.setState((s) => ({
      scriptLogs: { [tabId]: ["hello"] },
    }));

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    // dot indicator is a span inside More button
    const moreBtn = screen.getByTestId("response-tab-more");
    expect(moreBtn.querySelector(".bg-theme-accent")).toBeInTheDocument();
  });

  it("shows dot indicator on More button when assertions have failures", () => {
    const tabId = seedTab();
    seedResponse(tabId);
    useResponseStore.setState(() => ({
      assertionResults: { [tabId]: [{ passed: false, name: "status is 200", actual: "500", assertionId: "test1" }] },
    }));

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    const moreBtn = screen.getByTestId("response-tab-more");
    expect(moreBtn.querySelector(".bg-theme-accent")).toBeInTheDocument();
  });

  it("switches to Console panel when Console is selected from More", async () => {
    const user = userEvent.setup();
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    await user.click(screen.getByTestId("response-tab-more"));
    await user.click(screen.getByTestId("response-more-console"));

    // The More trigger should now reflect active state
    await waitFor(() => {
      const moreBtn = screen.getByTestId("response-tab-more");
      expect(moreBtn.className).toContain("text-theme-accent");
    });
  });
});

// ── 3.2 View mode toggle ─────────────────────────────────────────────────────

describe("ResponsePanel — view mode toggle (Epic 3.2)", () => {
  it("renders pretty/raw/preview toggle buttons in the Response tab", () => {
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    expect(screen.getByTestId("view-mode-pretty")).toBeInTheDocument();
    expect(screen.getByTestId("view-mode-raw")).toBeInTheDocument();
    expect(screen.getByTestId("view-mode-preview")).toBeInTheDocument();
  });

  it("defaults to pretty mode for JSON content-type", () => {
    const tabId = seedTab();
    seedResponse(tabId, { headers: { "content-type": "application/json" } });

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    expect(screen.getByTestId("view-mode-pretty")).toHaveClass("bg-accent");
  });

  it("auto-detects preview mode for text/html content-type", async () => {
    const tabId = seedTab();
    seedResponse(tabId, { headers: { "content-type": "text/html" } });

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("view-mode-preview")).toHaveClass("bg-accent");
    });
  });

  it("auto-detects raw mode for text/plain content-type", async () => {
    const tabId = seedTab();
    seedResponse(tabId, { headers: { "content-type": "text/plain" } });

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("view-mode-raw")).toHaveClass("bg-accent");
    });
  });

  it("switches view mode when toggle button is clicked", async () => {
    const user = userEvent.setup();
    const tabId = seedTab();
    seedResponse(tabId);

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    await user.click(screen.getByTestId("view-mode-raw"));

    expect(screen.getByTestId("view-mode-raw")).toHaveClass("bg-accent");
    expect(screen.getByTestId("view-mode-pretty")).not.toHaveClass("bg-accent");
  });
});

// ── header count in tab label ────────────────────────────────────────────────

describe("ResponsePanel — Headers tab label", () => {
  it("shows header count in the Headers tab label", () => {
    const tabId = seedTab();
    seedResponse(tabId, {
      headers: {
        "content-type": "application/json",
        "x-request-id": "abc",
        "cache-control": "no-cache",
      },
    });

    render(<ResponsePanel tabId={tabId} onSendForce={vi.fn()} />);

    expect(screen.getByTestId("response-tab-headers")).toHaveTextContent("(3)");
  });
});
