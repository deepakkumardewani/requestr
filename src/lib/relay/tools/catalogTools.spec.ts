// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getImportedSlugs } from "@/lib/hub";
import { downloadPostmanCollection } from "@/lib/postmanExporter";
import { createChangeLog } from "../changeLog";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { catalogTools } from "./catalogTools";
import { createRegistry, executeTool, grantApproval, previewConfirmation } from "./registry";

vi.mock("@/lib/postmanExporter", () => ({ downloadPostmanCollection: vi.fn() }));

const registry = createRegistry(catalogTools);

const request = (id: string, collectionId: string, folderId: string | null) => ({
  id,
  collectionId,
  folderId,
  name: `Req ${id}`,
  method: "GET" as const,
  url: "https://api.test/x",
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

const HUB_FILES = {
  collection: {
    description: "Payments API",
    requests: [
      { name: "Charge", method: "POST", url: "https://pay.test/charge", params: [], headers: [], body: { type: "json", content: "{}" } },
      { name: "Refund", method: "POST", url: "https://pay.test/refund", params: [], headers: [], body: { type: "none", content: "" } },
    ],
  },
  environment: { variables: [{ key: "base", value: "https://pay.test", secret: false }] },
  meta: { name: "Pay" },
};

function setup() {
  const fake = createFakeWriteContext({
    collections: [
      { id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 },
      { id: "c2", name: "Other", createdAt: 1, updatedAt: 1 },
    ],
    folders: [
      { id: "f1", collectionId: "c1", name: "Admin", parentFolderId: null, order: 0 },
      { id: "f9", collectionId: "c2", name: "Elsewhere", parentFolderId: null, order: 0 },
    ],
    requests: [request("r1", "c1", null), request("r2", "c1", "f1"), request("r3", "c2", null)],
  });
  const run = (name: string, input: unknown, withApproval = true) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
      approval: withApproval ? grantApproval() : undefined,
    });
  return { ...fake, run };
}

function stubHub(files: Record<string, unknown> | null) {
  const fetchMock = vi.fn(async (url: string) => {
    const file = url.split("/").pop()?.replace(".json", "") ?? "";
    return files
      ? ({ ok: true, json: async () => files[file] } as Response)
      : ({ ok: false } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.mocked(downloadPostmanCollection).mockClear();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("export_postman", () => {
  it("[success] exports only the requests and folders of that collection", async () => {
    const { run } = setup();
    const out = await run("export_postman", { collectionId: "c1" });
    expect(out).toEqual({
      ok: true,
      data: { summary: 'Exported "Orders" for Postman', requestCount: 2 },
    });
    const [collection, requests, folders] = vi.mocked(downloadPostmanCollection).mock.calls[0];
    expect(collection.id).toBe("c1");
    expect(requests.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(folders?.map((f) => f.id)).toEqual(["f1"]);
  });

  it("[invalid] rejects an unknown collection without downloading", async () => {
    const { run } = setup();
    expect(await run("export_postman", { collectionId: "nope" })).toEqual({
      ok: false,
      error: "collection not found: nope",
    });
    expect(downloadPostmanCollection).not.toHaveBeenCalled();
  });

  it("[invalid] fails by itself when the collection vanished after the registry check", async () => {
    const { store, write } = setup();
    const [exportPostman] = catalogTools;
    const out = await exportPostman.run(
      { collectionId: "gone" },
      { store, redact: DEFAULT_REDACT_CONTEXT, write },
    );
    expect(out).toEqual({ ok: false, error: "collection not found: gone" });
    expect(downloadPostmanCollection).not.toHaveBeenCalled();
  });

  it("[invalid] rejects missing input", async () => {
    const { run } = setup();
    expect((await run("export_postman", {})).ok).toBe(false);
  });
});

describe("import_api_catalog", () => {
  it("[success][undo] adds the collection and environment, marks the slug, and undo removes both", async () => {
    stubHub(HUB_FILES);
    const { run, state, log } = setup();
    const out = await run("import_api_catalog", { slug: "pay-api" });
    expect(out.ok).toBe(true);
    const data = (out as { data: Record<string, unknown> }).data;
    expect(data.requestCount).toBe(2);
    expect(state.collections.map((c) => c.name)).toEqual(["Orders", "Other", "Pay"]);
    expect(state.requests.filter((r) => r.collectionId === data.collectionId)).toHaveLength(2);
    expect(state.environments.map((e) => e.name)).toEqual(["Pay"]);
    expect(data.environmentId).toBe(state.environments[0].id);
    expect(data.changeIds).toHaveLength(2);
    expect(getImportedSlugs().has("pay-api")).toBe(true);

    const onStorage = vi.fn();
    window.addEventListener("storage", onStorage);
    for (const changeId of data.changeIds as string[]) await log.undo(changeId);
    window.removeEventListener("storage", onStorage);
    expect(state.collections.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(state.environments).toEqual([]);
    expect(getImportedSlugs().has("pay-api")).toBe(false);
    expect(onStorage).toHaveBeenCalledTimes(1);
  });

  it("[undo] a change rehydrated after a reload still unmarks the slug", async () => {
    stubHub(HUB_FILES);
    const { run, store, writer, storage } = setup();
    const out = await run("import_api_catalog", { slug: "pay-api" });
    const changeId = (out as { data: { changeId: string } }).data.changeId;
    expect(getImportedSlugs().has("pay-api")).toBe(true);

    const reloadedLog = createChangeLog({ store, writer, storage });
    await reloadedLog.load(changeId);
    const onStorage = vi.fn();
    window.addEventListener("storage", onStorage);
    const undone = await reloadedLog.undo(changeId);
    window.removeEventListener("storage", onStorage);
    expect(undone.ok).toBe(true);
    expect(getImportedSlugs().has("pay-api")).toBe(false);
    expect(onStorage).toHaveBeenCalledTimes(1);
  });

  it("[success] the card names the provider being imported", () => {
    const { store } = setup();
    expect(
      previewConfirmation(registry, "import_api_catalog", { slug: "pay-api" }, store),
    ).toMatchObject({ action: "change", severity: "caution", targets: ["pay-api"], count: 1 });
  });

  it("[invalid] rejects a slug that could escape the hub directory, without fetching", async () => {
    const fetchMock = stubHub(HUB_FILES);
    const { run } = setup();
    expect(await run("import_api_catalog", { slug: "../etc" })).toEqual({
      ok: false,
      error: "not a catalog provider: ../etc",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("[invalid] reports an unknown provider and leaves the workspace alone", async () => {
    stubHub(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { run, state } = setup();
    expect(await run("import_api_catalog", { slug: "ghost" })).toEqual({
      ok: false,
      error: "not a catalog provider: ghost",
    });
    expect(state.collections).toHaveLength(2);
    expect(getImportedSlugs().size).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("[invalid] asks first: no approval, no fetch, no change", async () => {
    const fetchMock = stubHub(HUB_FILES);
    const { run, state } = setup();
    expect(await run("import_api_catalog", { slug: "pay-api" }, false)).toEqual({
      ok: false,
      error: "approval required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.collections).toHaveLength(2);
  });

  it("[invalid] does not mark the slug when the environment write fails", async () => {
    stubHub(HUB_FILES);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, write, writer } = setup();
    const put = writer.put.bind(writer);
    writer.put = (kind, entity) => {
      if (kind === "environment") throw new Error("disk full");
      put(kind, entity);
    };
    const out = await executeTool(
      registry,
      "import_api_catalog",
      { slug: "pay-api" },
      { store, redact: DEFAULT_REDACT_CONTEXT, write, approval: grantApproval() },
    );
    expect(out.ok).toBe(false);
    expect(getImportedSlugs().size).toBe(0);
  });

  it("[invalid] fails without a change log", async () => {
    stubHub(HUB_FILES);
    const { store } = setup();
    const out = await executeTool(
      registry,
      "import_api_catalog",
      { slug: "pay-api" },
      { store, redact: DEFAULT_REDACT_CONTEXT, approval: grantApproval() },
    );
    expect(out.ok).toBe(false);
    expect(getImportedSlugs().size).toBe(0);
  });
});
