/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeWriteContext } from "@/lib/relay/testing/changeLogTestKit";
import { createEnvironment } from "@/lib/relay/testing/entityTestData";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { ChangeCard, readChangeOutput } from "./ChangeCard";
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
});
