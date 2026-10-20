/** @vitest-environment happy-dom */

import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettingsSections } from "@/app/settings/constants";
import { RELAY_WORKSPACE_ID } from "@/lib/relay/constants";
import * as permission from "@/lib/relay/permission";
import * as threadDb from "@/lib/relay/threadDb";
import { clearAll, createThread, listThreads } from "@/lib/relay/threadDb";
import { toast } from "sonner";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { relayMessages } from "@/components/relay/relayIntlMock";
import { RelaySection } from "./RelaySection";

// The global mock only knows the dock namespace; Settings reads the shell one.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      relayMessages("en"),
    );
    return typeof template === "string"
      ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""))
      : key;
  },
}));
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({
    enabled: true,
    position: "right",
    shareValues: false,
    activeThreadId: null,
  });
  useRelayPermissionStore.setState({ mode: "review" });
});

afterEach(async () => {
  cleanup();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.restoreAllMocks();
});

describe("RelaySection", () => {
  it("offers exactly the Relay controls and no model, vendor or key field", () => {
    render(<RelaySection />);

    expect(screen.getByTestId("relay-enabled-switch")).toBeInTheDocument();
    expect(screen.getByTestId("relay-position-select")).toBeInTheDocument();
    expect(screen.getByTestId("relay-share-values-switch")).toBeInTheDocument();
    expect(screen.getByTestId("relay-clear-history-btn")).toBeInTheDocument();
    expect(screen.getByTestId("relay-explainer")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("starts with sharing off and only flips the shareValues field", () => {
    render(<RelaySection />);
    const toggle = screen.getByTestId("relay-share-values-switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    expect(useRelayStore.getState().shareValues).toBe(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("shows the stored approval mode with its description", () => {
    useRelayPermissionStore.setState({ mode: "skip" });
    render(<RelaySection />);

    const select = screen.getByTestId("relay-permission-select");
    expect(select).toHaveTextContent("Skip all approvals");
    expect(screen.getByTestId("relay-settings")).toHaveTextContent("Use with caution");
  });

  it("changes the approval mode in the shared store", async () => {
    render(<RelaySection />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("relay-permission-select"));
    await user.click(await screen.findByRole("option", { name: "Always ask" }));

    expect(useRelayPermissionStore.getState().mode).toBe("always-ask");
  });

  it("ignores permission values that fail the mode guard", async () => {
    const isMode = vi
      .spyOn(permission, "isRelayPermissionMode")
      .mockReturnValue(false);
    render(<RelaySection />);
    const user = userEvent.setup();
    const initialMode = useRelayPermissionStore.getState().mode;

    await user.click(screen.getByTestId("relay-permission-select"));
    await user.click(await screen.findByRole("option", { name: "Always ask" }));

    expect(useRelayPermissionStore.getState().mode).toBe(initialMode);
    isMode.mockRestore();
  });

  it("flips the enabled preference", () => {
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    expect(useRelayStore.getState().enabled).toBe(false);
  });

  it("changes the panel position in the shared store", async () => {
    render(<RelaySection />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("relay-position-select"));
    await user.click(await screen.findByRole("option", { name: "Left" }));

    expect(useRelayStore.getState().position).toBe("left");
  });

  it("shows an error toast when clearing history fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(threadDb, "clearAll").mockRejectedValueOnce(new Error("idb unavailable"));

    render(<RelaySection />);
    fireEvent.click(screen.getByTestId("relay-clear-history-btn"));
    fireEvent.click(await screen.findByTestId("relay-clear-history-confirm"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't clear Relay history. Try again.");
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[relay] clearing history failed",
      expect.objectContaining({ error: expect.any(Error) }),
    );
    consoleError.mockRestore();
  });

  it("clears every thread and the active thread after confirm", async () => {
    const { thread } = await createThread({ workspaceId: RELAY_WORKSPACE_ID });
    useRelayStore.setState({ activeThreadId: thread.id });
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-clear-history-btn"));
    expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(1);
    fireEvent.click(await screen.findByTestId("relay-clear-history-confirm"));

    await waitFor(async () =>
      expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(0),
    );
    expect(useRelayStore.getState().activeThreadId).toBeNull();
  });

  it("keeps history when the confirmation is cancelled", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID });
    render(<RelaySection />);

    fireEvent.click(screen.getByTestId("relay-clear-history-btn"));
    fireEvent.click(await screen.findByText("Cancel"));

    expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(1);
  });
});

describe("settings navigation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists the Relay section last when the flag is on", () => {
    const ids = getSettingsSections().map(([id]) => id);
    expect(ids.at(-1)).toBe("relay");
  });

  it("omits the Relay section when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    expect(getSettingsSections().map(([id]) => id)).not.toContain("relay");
  });
});
