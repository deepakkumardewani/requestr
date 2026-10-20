import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  buildChatPayload,
  buildRelayContext,
  chipKey,
} from "./contextBuilder";
import { RELAY_COLLECTION_ITEM_CAP } from "./constants";
import { buildRedactContext } from "./redact";
import {
  BASIC_CREDENTIALS,
  ENV_SECRET_VALUE,
  JWT_SECRET,
  SESSION_COOKIE,
} from "./redact.corpus";
import type { ContextChip } from "./chips";
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

const tabChip: ContextChip = { kind: "tab", id: "t1", label: "Get thing" };
const collectionChip: ContextChip = { kind: "collection", id: "c1", label: "Payments" };
const envChip: ContextChip = { kind: "environment", id: "e1", label: "Prod" };
const requestChip: ContextChip = { kind: "request", id: "r1", label: "Request r1" };
const ALL_CHIPS = [tabChip, collectionChip, envChip];

describe("buildRelayContext", () => {
  it("sends no tab, collection or environment when nothing is attached", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({ store, redact, attachedItems: [] });
    expect(context.chips).toEqual([]);
    expect(context).not.toHaveProperty("activeTab");
    expect(context).not.toHaveProperty("collection");
    expect(context).not.toHaveProperty("environment");
    expect(context).not.toHaveProperty("attached");
    expect(context.workspace).toBeDefined();
  });

  it("lists exactly the attached chips whose data is present", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({ store, redact, attachedItems: ALL_CHIPS });
    expect(context.chips).toHaveLength(3);
    expect(context.activeTab).toMatchObject({ tabId: "t1", requestId: "r1" });
    expect(context.collection?.name).toBe("Payments");
    expect(context.environment?.name).toBe("Prod");
    expect(context.attached).toBeUndefined();
  });

  it("describes an attached tab that is no longer active by identity only", () => {
    const { store, redact, state } = seeded();
    state.activeTabId = "other";
    const context = buildRelayContext({ store, redact, attachedItems: [tabChip] });
    expect(context.activeTab).toEqual({ tabId: "t1", name: "Get thing" });
  });

  it("puts a second tab in attached instead of overwriting the first", () => {
    const { store, redact } = seeded();
    const second: ContextChip = { kind: "tab", id: "t2", label: "Other" };
    const context = buildRelayContext({ store, redact, attachedItems: [tabChip, second] });
    expect(context.activeTab).toMatchObject({ tabId: "t1" });
    expect(context.attached).toEqual([{ kind: "tab", tabId: "t2", name: "Other" }]);
  });

  it("never carries secret fixtures", () => {
    const { store, redact } = seeded({
      tabs: [tab("r1", `https://api.test/r1?token=${JWT_SECRET}`)] as never,
    });
    const text = JSON.stringify(buildRelayContext({ store, redact, attachedItems: ALL_CHIPS }));
    for (const secret of [JWT_SECRET, ENV_SECRET_VALUE, SESSION_COOKIE, BASIC_CREDENTIALS]) {
      expect(text).not.toContain(secret);
    }
  });

  it("keeps env values out by default and lets only non-secret ones in with shareValues", () => {
    const { store, state } = seeded();
    const off = JSON.stringify(buildRelayContext({ store, redact: buildRedactContext(state.environments, false), attachedItems: ALL_CHIPS }));
    expect(off).not.toContain('"value"');
    const on = JSON.stringify(buildRelayContext({ store, redact: buildRedactContext(state.environments, true), attachedItems: ALL_CHIPS }));
    expect(on).toContain("api.test");
    expect(on).not.toContain(ENV_SECRET_VALUE);
  });

  it("sends names and has-value flags only while Share is off", () => {
    const { store, state } = seeded();
    const context = buildRelayContext({ store, redact: buildRedactContext(state.environments, false), attachedItems: ALL_CHIPS });
    expect(context.environment?.variables).toEqual([
      { key: "host", isSecret: false, hasValue: true },
      { key: "apiKey", isSecret: true, hasValue: true },
    ]);
  });

  it("sends non-secret values and [redacted] for secrets while Share is on", () => {
    const { store, state } = seeded();
    const context = buildRelayContext({ store, redact: buildRedactContext(state.environments, true), attachedItems: ALL_CHIPS });
    expect(context.environment?.variables).toEqual([
      { key: "host", isSecret: false, hasValue: true, value: "api.test" },
      { key: "apiKey", isSecret: true, hasValue: true, value: "[redacted]" },
    ]);
  });

  it("caps an attached collection at 50 requests plus a tail for the rest", () => {
    const requests = Array.from({ length: 500 }, (_, i) => request(`r${i}`));
    const { store, redact } = seeded({ requests: requests as never });
    const { collection } = buildRelayContext({ store, redact, attachedItems: ALL_CHIPS });
    expect(collection?.items).toHaveLength(RELAY_COLLECTION_ITEM_CAP);
    expect(collection?.total).toBe(500);
    expect(collection?.more).toBe("…and 450 more — use search");
  });

  it("skips the environment section when the attached env is gone", () => {
    const { store, redact } = seeded({ environments: [], activeEnvironmentId: "e1" });
    const context = buildRelayContext({ store, redact, attachedItems: ALL_CHIPS });
    expect(context.environment).toBeUndefined();
    expect(context.chips.map(chipKey)).not.toContain("environment:e1");
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
    const payload = buildChatPayload({ store, redact, messages, attachedItems: ALL_CHIPS });
    const total = estimateTokens(JSON.stringify(payload));
    expect(total).toBeLessThan(RELAY_INPUT_TOKEN_BUDGET);
    expect(payload.messages.at(-1)?.id).toBe("u3");
    expect(payload.messages.length).toBeLessThan(messages.length);
  });

  it("keeps all history when it fits", () => {
    const { store, redact } = seeded();
    const messages = [message("u1", "user", "hi")];
    expect(buildChatPayload({ store, redact, messages, attachedItems: ALL_CHIPS }).messages).toEqual(messages);
  });

  it("redacts secrets held in replayed history, including old tool output (RP-203)", () => {
    const { store, redact } = seeded();
    const legacyTool = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_active_context",
          toolCallId: "old1",
          state: "output-available",
          input: {},
          output: { ok: true, data: { url: `https://a.test/?t=${JWT_SECRET}`, auth: { token: JWT_SECRET } } },
        },
      ],
    } as unknown as UIMessage;
    const payload = buildChatPayload({
      store,
      redact,
      messages: [message("u1", "user", "hi"), legacyTool],
      attachedItems: [],
    });
    const body = JSON.stringify(payload.messages);
    expect(body).not.toContain(JWT_SECRET);
    expect(body).toContain("[redacted]");
    expect(body).toContain("old1");
  });

  it("leaves message structure intact when a short secret equals a structural word", () => {
    const { store, state } = seeded();
    const shortSecrets = ["text", "available", "get_request", "assistant"].map(
      (value, i) => ({
        id: `s${i}`,
        name: `S${i}`,
        variables: [{ id: `v${i}`, key: `k${i}`, initialValue: value, currentValue: value, isSecret: true }],
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    const redact = buildRedactContext([...state.environments, ...shortSecrets]);
    const tool = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-get_request",
          toolCallId: "call-text",
          state: "output-available",
          input: { id: "r1" },
          output: { ok: true, data: { note: "available text" } },
        },
      ],
    } as unknown as UIMessage;
    const user = message("u1", "user", "hello");
    const { messages } = buildChatPayload({ store, redact, messages: [user, tool], attachedItems: [] });
    expect(messages[0]).toEqual(user);
    expect(messages[1]).toMatchObject({ id: "a1", role: "assistant" });
    expect(messages[1].parts[0]).toMatchObject({
      type: "tool-get_request",
      toolCallId: "call-text",
      state: "output-available",
    });
    expect(JSON.stringify(messages[1].parts[0])).not.toContain("available text");
  });

  it("does not redact user-typed or assistant text (FR-60 covers tool results and chips)", () => {
    const { store, redact } = seeded();
    const typed = message("u1", "user", `decode ${JWT_SECRET}`);
    const { messages } = buildChatPayload({ store, redact, messages: [typed], attachedItems: [] });
    expect(messages).toEqual([typed]);
  });

  it("excludes environment values when shareValues is false", () => {
    const { store, state } = seeded();
    const payload = buildChatPayload({
      store,
      redact: buildRedactContext(state.environments, false),
      messages: [],
      attachedItems: ALL_CHIPS,
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
        attachedItems: ALL_CHIPS,
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
        attachedItems: ALL_CHIPS,
      }),
    );
    expect(payload).not.toContain(ENV_SECRET_VALUE);
  });

  it("redacts corpus secret values from the entire payload", () => {
    const secrets = [JWT_SECRET, ENV_SECRET_VALUE, SESSION_COOKIE, BASIC_CREDENTIALS];
    const { store, redact } = seeded();
    const payload = JSON.stringify(buildChatPayload({ store, redact, messages: [], attachedItems: ALL_CHIPS }));
    for (const secret of secrets) {
      expect(payload).not.toContain(secret);
    }
  });

  it("caps a large collection at the default cap", () => {
    const requests = Array.from({ length: 500 }, (_, i) => request(`r${i}`));
    const { store, redact } = seeded({ requests });
    const payload = buildChatPayload({ store, redact, messages: [], attachedItems: ALL_CHIPS });
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
        attachedItems: ALL_CHIPS,
      }),
    );
    expect(payload).toContain("[redacted]");
  });
});

describe("attached items", () => {
  const attachedRequest = { kind: "request" as const, id: "r2", label: "Request r2" };

  it("skips attached items that no longer exist", () => {
    const { store, redact } = seeded({ requests: [request("r1"), request("r2")] });
    const gone = { kind: "chain" as const, id: "nope", label: "Gone" };
    const context = buildRelayContext({ store, redact, attachedItems: [attachedRequest, gone] });
    expect(context.chips.map(chipKey)).toEqual(["request:r2"]);
  });

  it("sends exactly the attached request, with its URL redacted", () => {
    const { store, redact } = seeded({
      requests: [request("r1"), request("r2", { url: `https://api.test/x?token=${JWT_SECRET}` })],
    });
    const context = buildRelayContext({ store, redact, attachedItems: [attachedRequest] });
    expect(context.attached).toEqual([
      expect.objectContaining({ kind: "request", id: "r2", method: "GET" }),
    ]);
    expect(context).not.toHaveProperty("activeTab");
    expect(JSON.stringify(context)).not.toContain(JWT_SECRET);
  });

  it("describes an attached request chip", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({ store, redact, attachedItems: [requestChip] });
    expect(context.attached).toHaveLength(1);
  });

  it("puts a second environment in attached, by names only unless values are shared", () => {
    const other = { ...env, id: "e2", name: "Staging" };
    const { store, redact } = seeded({ environments: [env, other] });
    const context = buildRelayContext({
      store,
      redact,
      attachedItems: [envChip, { kind: "environment", id: "e2", label: "Staging" }],
    });
    const attached = context.attached?.[0] as { variables: { key: string; value?: string }[] };
    expect(attached.variables.map((v) => v.key)).toEqual(["host", "apiKey"]);
    expect(attached.variables.every((v) => v.value === undefined)).toBe(true);
    expect(JSON.stringify(context)).not.toContain(ENV_SECRET_VALUE);
  });

  it("describes attached collections and chains", () => {
    const { store, redact } = seeded({
      tabs: [] as never,
      activeTabId: null,
      collections: [
        { id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 },
        { id: "c2", name: "Other", createdAt: 0, updatedAt: 0 },
      ],
      chains: [{ id: "ch1", name: "Checkout" }] as never,
    });
    const context = buildRelayContext({
      store,
      redact,
      attachedItems: [
        { kind: "collection", id: "c2", label: "Other" },
        { kind: "chain", id: "ch1", label: "Checkout" },
      ],
    });
    expect(context.collection?.id).toBe("c2");
    expect(context.attached?.map((a) => a.kind)).toEqual(["chain"]);
  });
});

describe("payload per attached chip kind", () => {
  it("describes an attached request under attached, with its secrets redacted", () => {
    const { store, redact } = seeded({
      requests: [request("r1", { auth: { type: "bearer", token: JWT_SECRET } })] as never,
    });
    const context = buildRelayContext({ store, redact, attachedItems: [requestChip] });
    expect(context.chips).toEqual([requestChip]);
    expect(context.attached).toHaveLength(1);
    expect(context.attached?.[0]).toMatchObject({ kind: "request", id: "r1" });
    expect(context).not.toHaveProperty("activeTab");
    expect(context).not.toHaveProperty("collection");
    expect(context).not.toHaveProperty("environment");
    expect(JSON.stringify(context)).not.toContain(JWT_SECRET);
  });

  it("describes an attached chain by id and name only", () => {
    const chainChip: ContextChip = { kind: "chain", id: "ch1", label: "Login flow" };
    const { store, redact } = seeded({ chains: [{ id: "ch1", name: "Login flow" }] as never });
    const context = buildRelayContext({ store, redact, attachedItems: [chainChip] });
    expect(context.attached).toEqual([{ kind: "chain", id: "ch1", name: "Login flow" }]);
    expect(context.chips).toEqual([chainChip]);
  });

  it("does not turn the active environment into an implicit key", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({ store, redact, attachedItems: [tabChip] });
    expect(context).not.toHaveProperty("environment");
    for (const e of context.workspace.environments) expect(e).not.toHaveProperty("active");
  });

  it("redacts a secret that only appears inside an attached tab's url and headers", () => {
    const { store, redact } = seeded({
      tabs: [tab("r1", `https://api.test/r1?token=${JWT_SECRET}`)] as never,
    });
    const context = buildRelayContext({ store, redact, attachedItems: [tabChip] });
    expect(JSON.stringify(context)).not.toContain(JWT_SECRET);
  });

  it("drops an attached request that no longer exists from both chips and attached", () => {
    const { store, redact } = seeded({ requests: [] });
    const context = buildRelayContext({ store, redact, attachedItems: [requestChip] });
    expect(context.chips).toEqual([]);
    expect(context).not.toHaveProperty("attached");
  });
});
