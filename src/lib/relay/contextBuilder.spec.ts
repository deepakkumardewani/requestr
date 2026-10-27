import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  type AttachmentMeta,
  ATTACHMENT_DETAIL_CLOSE,
  ATTACHMENT_DETAIL_OPEN,
  ATTACHMENT_DETAIL_TRUNCATED_NOTE,
  buildAttachmentDetail,
  buildAttachmentMetadata,
  RELAY_ATTACHMENT_DETAIL_MAX_CHARS,
} from "./attachments";
import { buildChatPayload, buildRelayContext } from "./contextBuilder";
import { prepareOutgoingMessages } from "./outgoingMessages";
import { buildRedactContext } from "./redact";
import {
  BASIC_CREDENTIALS,
  ENV_SECRET_VALUE,
  JWT_SECRET,
  SESSION_COOKIE,
} from "./redact.corpus";
import type { ContextChip } from "./chips";
import { createFakeStoreAccess, type StoreSource } from "./storeAccess";
import {
  estimateTokens,
  RELAY_INPUT_TOKEN_BUDGET,
  RELAY_MAX_BODY_BYTES,
} from "./tokenBudget";

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

// Varied text: redaction of a long run of one character is pathologically slow.
const VARIED_BODY = Array.from({ length: 3000 }, (_, i) => `field${i}=value${i}`).join("&");

const tabChip: ContextChip = { kind: "tab", id: "t1", label: "Get thing" };
const collectionChip: ContextChip = { kind: "collection", id: "c1", label: "Payments" };
const envChip: ContextChip = { kind: "environment", id: "e1", label: "Prod" };
const requestChip: ContextChip = { kind: "request", id: "r1", label: "Request r1" };
const ALL_CHIPS = [tabChip, collectionChip, envChip, requestChip];

describe("buildRelayContext", () => {
  it("sends the workspace summary and never any chips or attached data", () => {
    const { store, redact } = seeded();
    const context = buildRelayContext({ store, redact });
    expect(context.chips).toEqual([]);
    expect(context.workspace).toBeDefined();
    for (const key of ["activeTab", "collection", "environment", "attached"]) {
      expect(context).not.toHaveProperty(key);
    }
  });

  it("never carries secret fixtures", () => {
    const { store, redact } = seeded();
    const text = JSON.stringify(buildRelayContext({ store, redact }));
    for (const secret of [JWT_SECRET, ENV_SECRET_VALUE, SESSION_COOKIE, BASIC_CREDENTIALS]) {
      expect(text).not.toContain(secret);
    }
  });
});

const detailOf = (
  chips: readonly ContextChip[],
  seed: ReturnType<typeof seeded>,
  redact = seed.redact,
) =>
  buildAttachmentDetail(buildAttachmentMetadata(chips, seed.store), {
    store: seed.store,
    redact,
  });

describe("attachment metadata", () => {
  it("keeps id, kind, label and the method of requests only", () => {
    const seed = seeded();
    expect(buildAttachmentMetadata(ALL_CHIPS, seed.store)).toEqual([
      { id: "t1", kind: "tab", label: "Get thing", method: "GET" },
      { id: "c1", kind: "collection", label: "Payments" },
      { id: "e1", kind: "environment", label: "Prod" },
      { id: "r1", kind: "request", label: "Request r1", method: "GET" },
    ]);
  });
});

describe("attachment detail", () => {
  it("resolves a request to id, name, method, url and its parts", async () => {
    const detail = await detailOf([requestChip], seeded());
    expect(detail).toContain(ATTACHMENT_DETAIL_OPEN);
    expect(detail).toContain(ATTACHMENT_DETAIL_CLOSE);
    for (const part of ['"id":"r1"', '"method":"GET"', "https://api.test/r1", '"headers"', '"params"', '"body"', '"auth"']) {
      expect(detail).toContain(part);
    }
  });

  it("resolves a collection to its name, id and request list", async () => {
    const detail = await detailOf([collectionChip], seeded());
    expect(detail).toContain('"id":"c1"');
    expect(detail).toContain("Payments");
    expect(detail).toContain("Request r1");
  });

  it("sends variable names and flags only while Share is off", async () => {
    const seed = seeded();
    const detail = await detailOf([envChip], seed, buildRedactContext(seed.state.environments, false));
    expect(detail).toContain("host");
    expect(detail).not.toContain('"value"');
    expect(detail).not.toContain(ENV_SECRET_VALUE);
  });

  it("sends non-secret values with Share on and never a secret's value", async () => {
    const seed = seeded();
    const detail = await detailOf([envChip], seed, buildRedactContext(seed.state.environments, true));
    expect(detail).toContain("api.test");
    expect(detail).not.toContain(ENV_SECRET_VALUE);
  });

  it("never carries secret fixtures from a request or tab", async () => {
    const seed = seeded({
      tabs: [tab("r1", `https://api.test/r1?token=${JWT_SECRET}`)] as never,
    });
    const detail = await detailOf(ALL_CHIPS, seed);
    for (const secret of [JWT_SECRET, ENV_SECRET_VALUE, SESSION_COOKIE, BASIC_CREDENTIALS]) {
      expect(detail).not.toContain(secret);
    }
  });

  it("describes a tab that is no longer active by identity only", async () => {
    const seed = seeded();
    seed.state.activeTabId = "other";
    const detail = await detailOf([tabChip], seed);
    expect(detail).toContain('{"tabId":"t1","name":"Get thing"}');
  });

  it("gives the active tab's saved request detail", async () => {
    const detail = await detailOf([tabChip], seeded());
    expect(detail).toContain('"tabId":"t1"');
    expect(detail).toContain('"request"');
  });

  it("reads a deleted item as '<label> no longer exists'", async () => {
    const seed = seeded({ environments: [], activeEnvironmentId: null });
    expect(await detailOf([envChip], seed)).toContain("Prod no longer exists");
  });

  it("caps a collection at the tool's own cap", async () => {
    const requests = Array.from({ length: 500 }, (_, i) => request(`r${i}`));
    const detail = await detailOf([collectionChip], seeded({ requests: requests as never }));
    expect(detail).not.toContain("Request r499");
  });

  it("degrades overflow to ids and names without dropping the turn", async () => {
    const big = Array.from({ length: 10 }, (_, i) =>
      request(`big${i}`, { name: `Big ${i}`, body: { type: "raw", content: VARIED_BODY } }),
    );
    const seed = seeded({ requests: big as never });
    const chips: ContextChip[] = big.map((r) => ({ kind: "request", id: r.id, label: r.name }));
    const detail = await detailOf(chips, seed);
    expect(detail).toContain(ATTACHMENT_DETAIL_TRUNCATED_NOTE);
    expect(detail).toContain("- request big9: Big 9");
    expect(detail.length).toBeLessThan(RELAY_ATTACHMENT_DETAIL_MAX_CHARS + 2_000);
  });
});

describe("prepareOutgoingMessages", () => {
  const user = (id: string, attachments?: AttachmentMeta[]): UIMessage => ({
    id,
    role: "user",
    parts: [{ type: "text", text: `message ${id}` }],
    ...(attachments ? { metadata: { attachments, turn: id } } : {}),
  });
  const attach: AttachmentMeta[] = [{ id: "r1", kind: "request", label: "Request r1", method: "GET" }];

  it("adds resolved detail to the latest user message only", async () => {
    const seed = seeded();
    const out = await prepareOutgoingMessages([user("u1", attach), user("u2", attach)], seed);
    expect(JSON.stringify(out[0].parts)).not.toContain(ATTACHMENT_DETAIL_OPEN);
    expect(JSON.stringify(out[1].parts)).toContain(ATTACHMENT_DETAIL_OPEN);
  });

  it("leaves older messages with only metadata.attachments", async () => {
    const out = await prepareOutgoingMessages([user("u1", attach), user("u2")], seeded());
    expect(out[0].metadata).toEqual({ attachments: attach });
  });

  it("adds nothing to a latest message without attachments", async () => {
    const messages = [user("u1", attach), user("u2")];
    const out = await prepareOutgoingMessages(messages, seeded());
    expect(out[1]).toEqual(messages[1]);
  });

  it("does not mutate the stored messages", async () => {
    const messages = [user("u1", attach)];
    await prepareOutgoingMessages(messages, seeded());
    expect(messages[0].parts).toHaveLength(1);
  });

  it("keeps 10 large attachments plus 50 prior turns under the body limit", async () => {
    const big = Array.from({ length: 10 }, (_, i) =>
      request(`big${i}`, { name: `Big ${i}`, body: { type: "raw", content: VARIED_BODY } }),
    );
    const seed = seeded({ requests: big as never });
    const metas = buildAttachmentMetadata(
      big.map((r) => ({ kind: "request" as const, id: r.id, label: r.name })),
      seed.store,
    );
    const history = Array.from({ length: 50 }, (_, i) => user(`old${i}`, metas));
    const outgoing = await prepareOutgoingMessages([...history, user("latest", metas)], seed);
    const { messages, context } = buildChatPayload({ ...seed, messages: outgoing });
    const bytes = new TextEncoder().encode(JSON.stringify({ messages, context })).byteLength;
    expect(bytes).toBeLessThan(RELAY_MAX_BODY_BYTES);
    expect(messages.at(-1)?.id).toBe("latest");
    expect(JSON.stringify(messages.at(-1)?.parts)).toContain(ATTACHMENT_DETAIL_OPEN);
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
    const { messages } = buildChatPayload({ store, redact, messages: [user, tool] });
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
    const { messages } = buildChatPayload({ store, redact, messages: [typed] });
    expect(messages).toEqual([typed]);
  });
});
