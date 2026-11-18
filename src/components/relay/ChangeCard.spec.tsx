/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeWriteContext } from "@/lib/relay/testing/changeLogTestKit";
import { createChain, createCollection, createEnvironment } from "@/lib/relay/testing/entityTestData";
import { useChainStore } from "@/stores/useChainStore";
import { useSidebarRevealStore } from "@/stores/useSidebarRevealStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { ChangeCard, readChangeOutput, useChangeViews } from "./ChangeCard";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  },
}));

const request = {
  id: "r1",
  collectionId: "c1",
  folderId: null,
  name: "List",
  method: "GET" as const,
  url: "https://api.test/a",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
};

function setup() {
  const fake = createFakeWriteContext({ requests: [request] } as never);
  useCollectionsStore.setState({ requests: [request] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  const edit = async (url: string) => {
    const result = await fake.log.apply(fake.write.origin, {
      entity: "request",
      entityId: "r1",
      summary: "Updated List",
      before: request,
      mutate: () => fake.writer.put("request", { ...request, url }),
    });
    return (result as { change: { id: string } }).change.id;
  };
  return { ...fake, edit };
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const output = (changeId: string, extra: object = {}) => ({
  changeId,
  summary: "Updated List",
  needsValue: [],
  ...extra,
});

describe("readChangeOutput", () => {
  const part = (over: object) => ({
    type: "tool-update_request",
    state: "output-available",
    output: { ok: true, data: { changeId: "c-1", summary: "S", needsValue: ["K", 3] } },
    ...over,
  });

  it("extracts the change from a finished write call", () => {
    expect(readChangeOutput(part({}))).toEqual({ changeId: "c-1", summary: "S", needsValue: ["K"] });
  });

  it("falls back to an empty summary and no missing values when the result omits them", () => {
    const bare = part({ output: { ok: true, data: { changeId: "c-2" } } });
    expect(readChangeOutput(bare)).toEqual({ changeId: "c-2", summary: "", needsValue: [] });
    const noData = part({ output: { ok: true } });
    expect(readChangeOutput(noData)).toBeNull();
  });

  it("ignores a success whose output is missing", () => {
    expect(readChangeOutput(part({ output: undefined }))).toBeNull();
  });

  it.each([
    ["a read tool", { type: "tool-get_request" }],
    ["an unknown tool", { type: "tool-nope" }],
    ["a pending call", { state: "input-available", output: undefined }],
    ["a failed outcome", { output: { ok: false, error: "x" } }],
    ["an outcome without a change id", { output: { ok: true, data: {} } }],
  ])("ignores %s", (_label, over) => {
    expect(readChangeOutput(part(over))).toBeNull();
  });
});

describe("ChangeCard", () => {
  it("shows the summary with Undo and Open actions", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    render(<ChangeCard change={output(id)} log={log} />);
    expect(screen.getByTestId("relay-change-card")).toHaveAttribute("data-status", "applied");
    expect(screen.getByText("Updated List")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("undoes the change and turns muted", async () => {
    const { log, edit, state } = setup();
    const id = await edit("https://api.test/b");
    render(<ChangeCard change={output(id)} log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(state.requests[0].url).toBe("https://api.test/a");
    expect(screen.getByTestId("relay-change-card")).toHaveAttribute("data-status", "undone");
    expect(screen.getByTestId("relay-change-undone")).toHaveTextContent("Undone");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("explains why an undo is blocked instead of failing silently", async () => {
    const { log, edit, writer } = setup();
    const id = await edit("https://api.test/b");
    writer.put("request", { ...request, url: "https://api.test/user-edit" });
    render(<ChangeCard change={output(id)} log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(screen.getByTestId("relay-change-blocked")).toHaveTextContent(
      en.changes.blocked.edited,
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("reports an undo for a change the log does not know", async () => {
    const { log } = setup();
    render(<ChangeCard change={output("missing")} log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(screen.getByTestId("relay-change-blocked")).toHaveTextContent(
      en.changes.blocked.not_found,
    );
  });

  it("has no Show details disclosure (CONV-06)", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    render(<ChangeCard change={output(id)} log={log} />);
    expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
    expect(screen.queryByTestId("relay-change-details")).toBeNull();
  });

  it("opens the request in a tab", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    render(<ChangeCard change={output(id)} log={log} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(useTabsStore.getState().tabs.map((t) => t.requestId)).toEqual(["r1"]);
  });

  it("navigates to the route when a non-request change is opened", async () => {
    const env = createEnvironment("e1", "Prod");
    const fake = createFakeWriteContext({ environments: [env] } as never);
    useEnvironmentsStore.setState({ environments: [env] } as never);
    const result = await fake.log.apply(fake.write.origin, {
      entity: "environment",
      entityId: "e1",
      summary: "Updated Prod",
      before: env,
      mutate: () => fake.writer.put("environment", { ...env, name: "Prod2" }),
    });
    const id = (result as { change: { id: string } }).change.id;
    render(<ChangeCard change={output(id)} log={fake.log} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/environments");
  });

  it("hides Open when the request no longer exists", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    useCollectionsStore.setState({ requests: [] });
    render(<ChangeCard change={output(id)} log={log} />);
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("tells the user which secret values they still need to add", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    render(<ChangeCard change={output(id, { needsValue: ["API_TOKEN", "DB_PASSWORD"] })} log={log} />);
    expect(screen.getByTestId("relay-change-needs-value")).toHaveTextContent("API_TOKEN, DB_PASSWORD");
  });

  it("loads a change it has not seen yet from storage", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    const fresh = { ...log, getView: vi.fn(() => null), load: vi.fn(log.load) };
    render(<ChangeCard change={output(id)} log={fresh} />);
    expect(fresh.load).toHaveBeenCalledWith(id);
  });

  it("renders on the server from the tool output alone", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    const html = renderToString(<ChangeCard change={output(id)} log={log} />);
    expect(html).toContain("Updated List");
    expect(html).toContain('data-status="applied"');
  });
});

describe("ChangeCard Open control per entity kind (AC3.2)", () => {
  const collection = createCollection("col1", "Payments");
  const folder = {
    id: "f1",
    collectionId: "col1",
    parentFolderId: null,
    name: "Nested",
    createdAt: 1,
    updatedAt: 1,
  };
  const chain = createChain("ch1", "Login flow");

  function seed() {
    const fake = createFakeWriteContext({
      collections: [collection],
      folders: [folder],
      chains: [chain],
    } as never);
    useCollectionsStore.setState({
      collections: [collection],
      folders: [folder],
      requests: [],
    } as never);
    useChainStore.setState({ chains: [chain] } as never);
    useSidebarRevealStore.getState().clear();
    return fake;
  }

  async function createdChange(
    fake: ReturnType<typeof seed>,
    entity: string,
    entityId: string,
    kind: "collection" | "folder" | "chain",
    value: object,
  ) {
    const result = await fake.log.apply(fake.write.origin, {
      entity,
      entityId,
      summary: `Created ${entityId}`,
      before: null,
      mutate: () => fake.writer.put(kind as never, value as never),
    } as never);
    return (result as { change: { id: string } }).change.id;
  }

  it("opens a chain at its route", async () => {
    const fake = seed();
    const id = await createdChange(fake, "chain", "ch1", "chain", chain);
    render(<ChangeCard change={output(id)} log={fake.log} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/chain/ch1");
  });

  it("reveals a collection in the sidebar and goes to the workspace", async () => {
    const fake = seed();
    const id = await createdChange(fake, "collection", "col1", "collection", collection);
    render(<ChangeCard change={output(id)} log={fake.log} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(useSidebarRevealStore.getState().revealed).toEqual({ id: "col1" });
    expect(push).toHaveBeenCalledExactlyOnceWith("/app");
  });

  it("reveals a folder in the sidebar and goes to the workspace", async () => {
    const fake = seed();
    const id = await createdChange(fake, "folder", "f1", "folder", folder);
    render(<ChangeCard change={output(id)} log={fake.log} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(useSidebarRevealStore.getState().revealed).toEqual({ id: "f1" });
    expect(push).toHaveBeenCalledExactlyOnceWith("/app");
  });

  it("renders no Open for a deleted collection", async () => {
    const fake = seed();
    const result = await fake.log.apply(fake.write.origin, {
      entity: "collection",
      entityId: "col1",
      summary: "Deleted Payments",
      before: collection,
      mutate: () => fake.writer.remove("collection", "col1"),
    } as never);
    useCollectionsStore.setState({ collections: [], folders: [] } as never);
    const id = (result as { change: { id: string } }).change.id;
    render(<ChangeCard change={output(id)} log={fake.log} />);
    expect(screen.queryByRole("button", { name: /open/i })).toBeNull();
  });

  it("renders no Open once a created chain is undone", async () => {
    const fake = seed();
    const id = await createdChange(fake, "chain", "ch1", "chain", chain);
    render(<ChangeCard change={output(id)} log={fake.log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(screen.getByTestId("relay-change-undone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open/i })).toBeNull();
  });

  it("renders no Open for a tab row", async () => {
    const fake = seed();
    const result = await fake.log.apply(fake.write.origin, {
      entity: "tab",
      entityId: "r1",
      summary: "Opened List",
      before: { openedForRequestId: "r1", activateTabId: null },
      mutate: () => {
        fake.writer.openRequest(request as never);
      },
    } as never);
    const id = (result as { change: { id: string } }).change.id;
    render(<ChangeCard change={output(id)} log={fake.log} />);
    expect(screen.getByTestId("relay-change-card")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open/i })).toBeNull();
  });
});

describe("ChangeCard compact row (AC4.1, AC4.2)", () => {
  async function renderCard() {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    render(<ChangeCard change={output(id)} log={log} />);
    return screen.getByTestId("relay-change-card");
  }

  it("uses a single h-7 row with no vertical margin or p-2 padding (AC4.1)", async () => {
    const card = await renderCard();
    const row = card.firstElementChild as HTMLElement;
    expect(row).toHaveClass("h-7");
    for (const el of [card, row]) {
      const classes = Array.from(el.classList);
      expect(classes.filter((c) => /^(-?m[ytb]?-\d|p-2$)/.test(c))).toEqual([]);
    }
  });

  it("renders Undo and Open as icon-only buttons named by aria-label (AC4.2)", async () => {
    await renderCard();
    for (const [name, label] of [
      ["Undo", en.changes.undo],
      ["Open", en.changes.open],
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-label", label);
      expect(button).toHaveTextContent("");
      expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("shows the Undo tooltip on hover and the Open tooltip on keyboard focus (AC4.2)", async () => {
    await renderCard();
    const tip = () =>
      document.querySelector<HTMLElement>('[data-slot="tooltip-content"]');
    await userEvent.hover(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(tip()).toHaveTextContent(en.changes.undo), { timeout: 2000 });
    await userEvent.unhover(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      screen.getByRole("button", { name: "Open" }).focus();
    });
    await waitFor(() => expect(tip()).toHaveTextContent(en.changes.open), { timeout: 2000 });
  });
});

describe("useChangeViews", () => {
  it("returns the cached views and re-renders when a status moves", async () => {
    const { log, edit } = setup();
    const first = await edit("https://api.test/b");
    const second = await edit("https://api.test/c");
    const { result } = renderHook(() => useChangeViews(log, [first, second]));
    expect(result.current.map((view) => view.status)).toEqual(["applied", "applied"]);
    await act(async () => {
      await log.undo(second);
    });
    expect(result.current.map((view) => view.status)).toEqual(["applied", "undone"]);
  });

  it("loads uncached changes from storage once and skips empty ids", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    const load = vi.fn(log.load);
    const getView = vi.fn(() => null);
    const stub = { ...log, getView, load } as typeof log;
    const { rerender } = renderHook(({ ids }) => useChangeViews(stub, ids), {
      initialProps: { ids: [id, ""] },
    });
    expect(load).toHaveBeenCalledExactlyOnceWith(id);
    rerender({ ids: [id, ""] });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("omits ids the log cannot resolve and does not reload cached ones", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    const load = vi.spyOn(log, "load");
    const { result } = renderHook(() => useChangeViews(log, [id, "ghost"]));
    expect(result.current.map((view) => view.id)).toEqual([id]);
    expect(load).toHaveBeenCalledExactlyOnceWith("ghost");
  });

  it("picks up a late load once it lands", async () => {
    const { log, edit } = setup();
    const id = await edit("https://api.test/b");
    const views = new Map<string, unknown>();
    const listeners = new Set<() => void>();
    const real = log.getView(id);
    const stub = {
      ...log,
      subscribe: (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn)),
      getView: (key: string) => views.get(key) ?? null,
      load: vi.fn(async (key: string) => {
        views.set(key, real);
        listeners.forEach((fn) => fn());
      }),
    } as unknown as typeof log;
    const { result } = renderHook(() => useChangeViews(stub, [id]));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].status).toBe("applied");
  });
});
