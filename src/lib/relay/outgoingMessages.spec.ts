import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { ATTACHMENT_DETAIL_OPEN, type AttachmentMeta } from "./attachments";
import { latestUserAttachments, prepareOutgoingMessages } from "./outgoingMessages";
import { buildRedactContext } from "./redact";
import { createFakeStoreAccess } from "./storeAccess";

const REQUEST_URL = "https://api.test/r1";

function context() {
  const { access, state } = createFakeStoreAccess({
    requests: [
      {
        id: "r1",
        collectionId: "c1",
        name: "R1",
        method: "GET",
        url: REQUEST_URL,
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
        createdAt: 0,
        updatedAt: 0,
      },
    ] as never,
  });
  return { store: access, redact: buildRedactContext(state.environments) };
}

const attach: AttachmentMeta[] = [{ id: "r1", kind: "request", label: "R1", method: "GET" }];

const user = (id: string, attachments?: AttachmentMeta[], extra: UIMessage["parts"] = []): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text: `message ${id}` }, ...extra],
  ...(attachments ? { metadata: { attachments, turn: id } } : {}),
});

const assistant = (id: string): UIMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text: "reply" }],
  metadata: { attachments: attach },
});

const detailPart = { type: "text" as const, text: `${ATTACHMENT_DETAIL_OPEN}\nstale` };

describe("latestUserAttachments", () => {
  it("returns the latest user message's attachments only", () => {
    const other: AttachmentMeta[] = [{ id: "r2", kind: "request", label: "R2" }];
    expect(latestUserAttachments([user("u1", attach), assistant("a1"), user("u2", other)])).toEqual(other);
  });

  it("returns nothing when the latest user message has none, even if older ones did", () => {
    expect(latestUserAttachments([user("u1", attach), user("u2")])).toEqual([]);
  });

  it("returns nothing without a user message", () => {
    expect(latestUserAttachments([assistant("a1")])).toEqual([]);
    expect(latestUserAttachments([])).toEqual([]);
  });
});

describe("prepareOutgoingMessages", () => {
  it("returns an empty thread unchanged", async () => {
    expect(await prepareOutgoingMessages([], context())).toEqual([]);
  });

  it("passes a thread with no user message through, assistant metadata included", async () => {
    const messages = [assistant("a1")];
    expect(await prepareOutgoingMessages(messages, context())).toEqual(messages);
  });

  it("appends rebuilt detail to the latest user message", async () => {
    const out = await prepareOutgoingMessages([user("u1", attach)], context());
    const parts = out[0].parts;
    expect(parts[0]).toEqual({ type: "text", text: "message u1" });
    expect(parts).toHaveLength(2);
    expect(parts[1]).toMatchObject({ type: "text" });
    expect((parts[1] as { text: string }).text).toContain(REQUEST_URL);
  });

  it("replaces a stale detail part on the latest message instead of duplicating it", async () => {
    const out = await prepareOutgoingMessages([user("u1", attach, [detailPart])], context());
    const details = out[0].parts.filter(
      (p) => p.type === "text" && p.text.startsWith(ATTACHMENT_DETAIL_OPEN),
    );
    expect(details).toHaveLength(1);
    expect(JSON.stringify(details[0])).not.toContain("stale");
  });

  it("strips detail from older user messages and keeps only their attachment list", async () => {
    const out = await prepareOutgoingMessages(
      [user("u1", attach, [detailPart]), user("u2")],
      context(),
    );
    expect(out[0].parts).toEqual([{ type: "text", text: "message u1" }]);
    expect(out[0].metadata).toEqual({ attachments: attach });
  });

  it("drops metadata from an older user message that has no attachments", async () => {
    const withTurnOnly: UIMessage = { ...user("u1"), metadata: { turn: "u1", attachments: [] } };
    const out = await prepareOutgoingMessages([withTurnOnly, user("u2")], context());
    expect(out[0]).not.toHaveProperty("metadata");
  });

  it("leaves assistant messages untouched", async () => {
    const reply = assistant("a1");
    const out = await prepareOutgoingMessages([user("u1"), reply, user("u2")], context());
    expect(out[1]).toEqual(reply);
  });

  it("leaves the latest message as is when it has no attachments", async () => {
    const latest = user("u2");
    const out = await prepareOutgoingMessages([user("u1", attach), latest], context());
    expect(out[1]).toEqual(latest);
  });

  it("does not mutate the input", async () => {
    const messages = [user("u1", attach, [detailPart]), user("u2", attach)];
    const snapshot = structuredClone(messages);
    await prepareOutgoingMessages(messages, context());
    expect(messages).toEqual(snapshot);
  });
});
