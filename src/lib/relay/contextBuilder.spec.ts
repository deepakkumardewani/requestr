import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  buildChatPayload,
  buildRelayContext,
  chainIdFromPathname,
  chipKey,
  computeContextChips,
} from "./contextBuilder";
import { RELAY_COLLECTION_ITEM_CAP } from "./constants";
import { buildRedactContext } from "./redact";
import {
  BASIC_CREDENTIALS,
  ENV_SECRET_VALUE,
  JWT_SECRET,
  SESSION_COOKIE,
} from "./redact.corpus";
import { createFakeStoreAccess, type StoreSource } from "./storeAccess";
import { RELAY_INPUT_TOKEN_BUDGET, estimateTokens } from "./tokenBudget";

const request = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  collectionId: "c1",
  name: `Request ${id}`,
  method: "GET" as const,
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const tab = (requestId: string | null, url = "https://api.test/r1") => ({
  tabId: "t1",
  requestId,
  name: "Get thing",
  isDirty: false,
  type: "http" as const,
  url,
  method: "GET" as const,
  headers: [{ id: "h", key: "Authorization", value: `Bearer ${JWT_SECRET}`, enabled: true }],
  params: [],
  auth: { type: "bearer" as const, token: JWT_SECRET },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
});

const env = {
  id: "e1",
  name: "Prod",
  variables: [
    { id: "v1", key: "host", initialValue: "api.test", currentValue: "api.test", isSecret: false },
    { id: "v2", key: "apiKey", initialValue: ENV_SECRET_VALUE, currentValue: ENV_SECRET_VALUE, isSecret: true },
  ],
  createdAt: 0,
  updatedAt: 0,
};

function seeded(over: Partial<StoreSource> = {}) {
  const { access, state } = createFakeStoreAccess({
    collections: [{ id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 }],
    requests: [request("r1", { headers: [{ id: "h", key: "Cookie", value: SESSION_COOKIE, enabled: true }] })],
    environments: [env],
    activeEnvironmentId: "e1",
    tabs: [tab("r1")] as never,
    activeTabId: "t1",
    ...over,
  });
  return { store: access, state, redact: buildRedactContext(state.environments) };
}

describe("computeContextChips", () => {
  it("offers request, collection and environment chips", () => {
    const { store } = seeded();
    expect(computeContextChips(store).map(chipKey)).toEqual([
      "request:r1",
      "collection:c1",
      "environment:e1",
    ]);
  });

  it("prefers the chain over a tab when on a chain page", () => {
    const { store } = seeded({
      chains: [{ id: "ch1", name: "Checkout" }] as never,
    });
    const chips = computeContextChips(store, "ch1");
    expect(chips[0]).toEqual({ kind: "chain", id: "ch1", label: "Checkout" });
    expect(chips.some((c) => c.kind === "request")).toBe(false);
  });

  it("has no chips for an empty workspace", () => {
    expect(computeContextChips(createFakeStoreAccess().access)).toEqual([]);
  });

  it("ignores unsaved tabs", () => {
    const { store } = seeded({ tabs: [tab(null)] as never });
    expect(computeContextChips(store).map((c) => c.kind)).toEqual(["environment"]);
  });

  it("derives auto chip from the active tab and follows a tab switch", () => {
    const { access, state } = createFakeStoreAccess({
      collections: [{ id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 }],
      requests: [
        request("r1", { name: "Request 1" }),
        request("r2", { name: "Request 2" }),
      ],
      environments: [env],
      activeEnvironmentId: "e1",
      tabs: [
        tab("r1") as never,
        { ...tab("r2"), tabId: "t2", requestId: "r2", name: "Request 2" } as never,
      ],
      activeTabId: "t1",
      responses: {},
      history: [],
      chainRunState: {},
    });
    const store = access;

    const chipsForR1 = computeContextChips(store);
    expect(chipsForR1[0]).toEqual({ kind: "request", id: "r1", label: "Get thing" });

    // Switch to tab 2
    state.activeTabId = "t2";
    const chipsForR2 = computeContextChips(store);
    expect(chipsForR2[0]).toEqual({ kind: "request", id: "r2", label: "Request 2" });
  });

  it("attaches the chain and omits request on chain pages", () => {
    const { store } = seeded({
      chains: [{ id: "ch1", name: "Checkout" }] as never,
    });
    const chipsWithChain = computeContextChips(store, "ch1");
    const chipsWithoutChain = computeContextChips(store, null);

    expect(chipsWithChain[0]?.kind).toBe("chain");
    expect(chipsWithChain.some((c) => c.kind === "request")).toBe(false);

    expect(chipsWithoutChain[0]?.kind).toBe("request");
    expect(chipsWithoutChain.some((c) => c.kind === "chain")).toBe(false);
  });

  it("omits auto chip when tab has no saved request", () => {
    const { store } = seeded({
      tabs: [tab(null) as never],
      activeTabId: "t1",
    });
    const chips = computeContextChips(store);
    expect(chips).not.toContainEqual(
      expect.objectContaining({ kind: "request" }),
    );
  });
});

describe("buildRelayContext", () => {
  it("lists exactly the chips whose data is present", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({ store, redact });
    expect(context.chips).toHaveLength(3);
    expect(context.activeTab?.requestId).toBe("r1");
    expect(context.collection?.name).toBe("Payments");
    expect(context.environment?.name).toBe("Prod");
  });

  it("removing a chip removes its data from the payload", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({
      store,
      redact,
      removedChipKeys: ["request:r1", "environment:e1"],
    });
    expect(context.chips.map(chipKey)).toEqual(["collection:c1"]);
    expect(context.activeTab).toBeUndefined();
    expect(context.environment).toBeUndefined();
    expect(context.collection).toBeDefined();
    expect(JSON.stringify(context)).not.toContain('"active"');
  });

  it("never carries secret fixtures", () => {
    const { store, redact } = seeded({
      tabs: [tab("r1", `https://api.test/r1?token=${JWT_SECRET}`)] as never,
    });
    const text = JSON.stringify(buildRelayContext({ store, redact }));
    for (const secret of [JWT_SECRET, ENV_SECRET_VALUE, SESSION_COOKIE, BASIC_CREDENTIALS]) {
      expect(text).not.toContain(secret);
    }
  });

  it("keeps env values out by default and lets only non-secret ones in with shareValues", () => {
    const { store, state } = seeded();
    const off = JSON.stringify(buildRelayContext({ store, redact: buildRedactContext(state.environments, false) }));
    expect(off).not.toContain('"value"');
    const on = JSON.stringify(buildRelayContext({ store, redact: buildRedactContext(state.environments, true) }));
    expect(on).toContain("api.test");
    expect(on).not.toContain(ENV_SECRET_VALUE);
  });

  it("sends names and has-value flags only while Share is off", () => {
    const { store, state } = seeded();
    const context = buildRelayContext({ store, redact: buildRedactContext(state.environments, false) });
    expect(context.environment?.variables).toEqual([
      { key: "host", isSecret: false, hasValue: true },
      { key: "apiKey", isSecret: true, hasValue: true },
    ]);
  });

  it("sends non-secret values and [redacted] for secrets while Share is on", () => {
    const { store, state } = seeded();
    const context = buildRelayContext({ store, redact: buildRedactContext(state.environments, true) });
    expect(context.environment?.variables).toEqual([
      { key: "host", isSecret: false, hasValue: true, value: "api.test" },
      { key: "apiKey", isSecret: true, hasValue: true, value: "[redacted]" },
    ]);
  });

  it("caps an attached collection at 50 requests plus a tail for the rest", () => {
    const requests = Array.from({ length: 500 }, (_, i) => request(`r${i}`));
    const { store, redact } = seeded({ requests: requests as never });
    const { collection } = buildRelayContext({ store, redact });
    expect(collection?.items).toHaveLength(RELAY_COLLECTION_ITEM_CAP);
    expect(collection?.total).toBe(500);
    expect(collection?.more).toBe("…and 450 more — use search");
  });

  it("skips the environment section when the active env is gone", () => {
    const { store, redact } = seeded({ environments: [], activeEnvironmentId: "e1" });
    expect(buildRelayContext({ store, redact }).environment).toBeUndefined();
  });
});

describe("buildChatPayload", () => {
  const message = (id: string, role: "user" | "assistant", text: string): UIMessage => ({
    id,
    role,
    parts: [{ type: "text", text }],
  });

  it("stays under the input budget for a large workspace", () => {
    const requests = Array.from({ length: 2000 }, (_, i) => request(`r${i}`, { name: `Request number ${i}` }));
    const collections = Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, name: `Collection ${i}`, createdAt: 0, updatedAt: 0 }));
    const { store, redact } = seeded({ requests, collections });
    const long = "w".repeat(30_000);
    const messages = [
      message("u1", "user", long),
      message("a1", "assistant", long),
      message("u2", "user", long),
      message("a2", "assistant", long),
      message("u3", "user", "latest"),
    ];
    const payload = buildChatPayload({ store, redact, messages });
    const total = estimateTokens(JSON.stringify(payload));
    expect(total).toBeLessThan(RELAY_INPUT_TOKEN_BUDGET);
    expect(payload.messages.at(-1)?.id).toBe("u3");
    expect(payload.messages.length).toBeLessThan(messages.length);
  });

  it("keeps all history when it fits", () => {
    const { store, redact } = seeded();
    const messages = [message("u1", "user", "hi")];
    expect(buildChatPayload({ store, redact, messages }).messages).toEqual(messages);
  });

  it("excludes environment values when shareValues is false", () => {
    const { store, state } = seeded();
    const payload = buildChatPayload({
      store,
      redact: buildRedactContext(state.environments, false),
      messages: [],
    });
    const envVars = payload.context.environment?.variables ?? [];
    for (const variable of envVars) {
      expect(variable).not.toHaveProperty("value");
    }
  });

  it("includes non-secret environment values when shareValues is true", () => {
    const { store, state } = seeded();
    const payload = JSON.stringify(
      buildChatPayload({
        store,
        redact: buildRedactContext(state.environments, true),
        messages: [],
      }),
    );
    expect(payload).toContain("api.test");
  });

  it("never includes secret values even when shareValues is true", () => {
    const { store, state } = seeded();
    const payload = JSON.stringify(
      buildChatPayload({
        store,
        redact: buildRedactContext(state.environments, true),
        messages: [],
      }),
    );
    expect(payload).not.toContain(ENV_SECRET_VALUE);
  });

  it("redacts corpus secret values from the entire payload", () => {
    const secrets = [JWT_SECRET, ENV_SECRET_VALUE, SESSION_COOKIE, BASIC_CREDENTIALS];
    const { store, redact } = seeded();
    const payload = JSON.stringify(buildChatPayload({ store, redact, messages: [] }));
    for (const secret of secrets) {
      expect(payload).not.toContain(secret);
    }
  });

  it("caps a large collection at the default cap", () => {
    const requests = Array.from({ length: 500 }, (_, i) => request(`r${i}`));
    const { store, redact } = seeded({ requests });
    const payload = buildChatPayload({ store, redact, messages: [] });
    expect(payload.context.collection?.items).toHaveLength(RELAY_COLLECTION_ITEM_CAP);
    expect(payload.context.collection?.total).toBe(500);
    expect(payload.context.collection?.more).toBe("…and 450 more — use search");
  });

  it("includes the [redacted] marker for secret variables", () => {
    const { store, state } = seeded();
    const payload = JSON.stringify(
      buildChatPayload({
        store,
        redact: buildRedactContext(state.environments, true),
        messages: [],
      }),
    );
    expect(payload).toContain("[redacted]");
  });
});

describe("chainIdFromPathname", () => {
  it("reads the chain id from a chain route", () => {
    expect(chainIdFromPathname("/chain/abc-1")).toBe("abc-1");
    expect(chainIdFromPathname("/chain/a%20b/edit")).toBe("a b");
  });

  it("returns null elsewhere", () => {
    expect(chainIdFromPathname("/settings")).toBeNull();
    expect(chainIdFromPathname("/")).toBeNull();
    expect(chainIdFromPathname(null)).toBeNull();
  });
});
