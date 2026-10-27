/** @vitest-environment happy-dom */

import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettingsSections } from "@/app/settings/constants";
import { RelayRoot } from "@/components/relay/RelayRoot";
import { RelayToggleButton } from "@/components/relay/RelayToggleButton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isToolAwaiting, useRelayChat } from "@/hooks/useRelayChat";
import {
  buildAttachmentDetail,
  buildAttachmentMetadata,
} from "@/lib/relay/attachments";
import * as platform from "@/lib/platform";
import { RELAY_WORKSPACE_ID } from "@/lib/relay/constants";
import { buildRedactContext } from "@/lib/relay/redact";
import { createFakeStoreAccess } from "@/lib/relay/storeAccess";
import * as permission from "@/lib/relay/permission";
import * as threadDb from "@/lib/relay/threadDb";
import {
  clearAll,
  createThread,
  flushThreadWrites,
  listThreads,
} from "@/lib/relay/threadDb";
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
vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));
// next/dynamic needs the Next runtime; model it with React.lazy.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<React.ComponentType<object>>) => {
    const Lazy = lazy(async () => ({ default: await loader() }));
    return (props: object) => (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  },
}));
vi.mock("@/components/relay/RelayDockWithMessages", () => ({
  RelayDockWithMessages: () => <div data-testid="relay-dock" />,
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  useRelayStore.setState({
    open: false,
    enabled: true,
    shareValues: false,
    activeThreadId: null,
  });
  useRelayPermissionStore.setState({ mode: "review" });
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.restoreAllMocks();
});

describe("RelaySection", () => {
  it("offers exactly the Relay controls and no model, vendor or key field", () => {
    render(<RelaySection />);

    expect(screen.getByTestId("relay-enabled-switch")).toBeInTheDocument();
    expect(screen.queryByText(/panel position/i)).toBeNull();
    expect(screen.getByTestId("relay-share-values-switch")).toBeInTheDocument();
    expect(screen.getByTestId("relay-clear-history-btn")).toBeInTheDocument();
    expect(screen.getByTestId("relay-explainer")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
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

function SurfacesHarness() {
  // RelayRoot mounts the shortcut itself, as in the app.
  return (
    <TooltipProvider>
      <RelaySection />
      <RelayToggleButton />
      <RelayRoot />
    </TooltipProvider>
  );
}

const ENV_FIXTURE = {
  id: "e1",
  name: "Prod",
  variables: [
    { id: "v1", key: "host", initialValue: "api.test", currentValue: "api.test", isSecret: false },
    { id: "v2", key: "apiKey", initialValue: "s3cret-value-123", currentValue: "s3cret-value-123", isSecret: true },
  ],
  createdAt: 0,
  updatedAt: 0,
};

/** The attachment detail is what the transport puts in the outgoing request body. */
async function outgoingEnvironmentDetail() {
  const { access, state } = createFakeStoreAccess({ environments: [ENV_FIXTURE] });
  const chip = { kind: "environment", id: "e1", label: "Prod" } as const;
  return buildAttachmentDetail(buildAttachmentMetadata([chip], access), {
    store: access,
    redact: buildRedactContext(state.environments, useRelayStore.getState().shareValues),
  });
}

function pressToggleChord() {
  fireEvent.keyDown(window, { key: "L", ctrlKey: true, shiftKey: true });
}

/** Mounts the real chat hook only while Relay is enabled, as the dock does. */
function ChatProbe() {
  const enabled = useRelayStore((s) => s.enabled);
  return enabled ? <ChatProbeBody /> : null;
}

function ChatProbeBody() {
  const { messages, send } = useRelayChat();
  return (
    <div>
      <button type="button" data-testid="probe-send" onClick={() => send("hi")} />
      <p data-testid="probe-text">
        {messages
          .flatMap((m) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])))
          .join("|")}
      </p>
    </div>
  );
}

const encoder = new TextEncoder();
const sseFrame = (chunk: object) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);

/** A reply that stays open mid-turn; aborting the request errors its body like a real fetch. */
function openStream(init: RequestInit) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  for (const chunk of [
    { type: "start" },
    { type: "start-step" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: "partial answer" },
  ]) {
    controller.enqueue(sseFrame(chunk));
  }
  init.signal?.addEventListener("abort", () =>
    controller.error(new DOMException("aborted", "AbortError")),
  );
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}

describe("disabling Relay mid-turn (BUG-05)", () => {
  it("aborts the running turn, and re-enabling restores the thread", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      requestSignal = init.signal ?? undefined;
      return openStream(init);
    });
    vi.stubGlobal("fetch", fetchMock);
    useRelayStore.setState({ hydrated: true });
    render(
      <>
        <RelaySection />
        <ChatProbe />
      </>,
    );

    fireEvent.click(screen.getByTestId("probe-send"));
    await waitFor(() =>
      expect(screen.getByTestId("probe-text")).toHaveTextContent("partial answer"),
    );
    expect(requestSignal?.aborted).toBe(false);

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    expect(screen.queryByTestId("probe-text")).toBeNull();
    expect(requestSignal?.aborted).toBe(true);
    await flushThreadWrites();

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    await waitFor(() =>
      expect(screen.getByTestId("probe-text")).toHaveTextContent("hi|partial answer"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("RelaySection settings take effect", () => {
  it("Enable off removes the dock, the toggle and the shortcut; on restores them", async () => {
    vi.spyOn(platform, "isMac").mockReturnValue(false);
    useRelayStore.setState({ open: true });
    render(<SurfacesHarness />);
    expect(await screen.findByTestId("relay-dock")).toBeInTheDocument();
    expect(screen.getByTestId("relay-toggle")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    expect(screen.queryByTestId("relay-dock")).toBeNull();
    expect(screen.queryByTestId("relay-toggle")).toBeNull();
    useRelayStore.setState({ open: false });
    pressToggleChord();
    expect(useRelayStore.getState().open).toBe(false);

    fireEvent.click(screen.getByTestId("relay-enabled-switch"));

    expect(screen.getByTestId("relay-toggle")).toBeInTheDocument();
    pressToggleChord();
    expect(useRelayStore.getState().open).toBe(true);
    expect(await screen.findByTestId("relay-dock")).toBeInTheDocument();
  });

  it("Share values off keeps environment values out of the outgoing body; on sends non-secrets only", async () => {
    render(<RelaySection />);
    const before = await outgoingEnvironmentDetail();
    expect(before).toContain("host");
    expect(before).not.toContain("api.test");

    fireEvent.click(screen.getByTestId("relay-share-values-switch"));

    const after = await outgoingEnvironmentDetail();
    expect(after).toContain("api.test");
    expect(after).not.toContain("s3cret-value-123");
  });

  it("the approval mode picked in Settings changes which calls wait for the user", async () => {
    const writeCall = {
      name: "create_request",
      input: {
        collectionId: "c1",
        folderId: null,
        name: "Ping",
        method: "GET",
        url: "https://api.test/ping",
        headers: null,
        params: null,
        body: null,
        auth: null,
      },
    };
    const awaiting = () =>
      isToolAwaiting("call-1", writeCall.name, writeCall.input);
    const user = userEvent.setup();
    render(<RelaySection />);
    expect(awaiting()).toBe(false);

    await user.click(screen.getByTestId("relay-permission-select"));
    await user.click(await screen.findByRole("option", { name: "Always ask" }));
    expect(awaiting()).toBe(true);

    await user.click(screen.getByTestId("relay-permission-select"));
    await user.click(await screen.findByRole("option", { name: "Skip all approvals" }));
    expect(awaiting()).toBe(false);
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
