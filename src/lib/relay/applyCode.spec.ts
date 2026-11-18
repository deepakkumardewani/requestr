import { describe, expect, it } from "vitest";
import type { TabState } from "@/types";
import {
  buildApplyBefore,
  buildApplyPatch,
  isValidJson,
  resolveApplyAction,
} from "./applyCode";

const httpTab = (body: object = { type: "text", content: "old" }) =>
  ({ tabId: "t1", type: "http", body }) as unknown as TabState;
const graphqlTab = {
  tabId: "t2",
  type: "graphql",
  name: "G",
  url: "https://api.test/graphql",
  headers: [],
  query: "{ a }",
  variables: "{}",
  operationName: "",
  auth: { type: "none" },
} as unknown as TabState;
const wsTab = {
  tabId: "t3",
  type: "websocket",
  name: "W",
  url: "wss://x",
  headers: [],
  draft: "hi",
} as unknown as TabState;
const ioTab = { ...wsTab, tabId: "t4", type: "socketio", eventName: "e" } as unknown as TabState;

describe("isValidJson", () => {
  it("accepts valid JSON and rejects invalid text", () => {
    expect(isValidJson('{"a":1}')).toBe(true);
    expect(isValidJson("{a:1}")).toBe(false);
    expect(isValidJson("")).toBe(false);
  });
});

describe("resolveApplyAction", () => {
  it("disables with a reason when there is no tab", () => {
    const expected = { label: "applyBody", field: null, disabledReason: "needsRequestTab" };
    expect(resolveApplyAction(null, "x")).toEqual(expected);
    expect(resolveApplyAction(undefined, "x")).toEqual(expected);
  });

  it("maps an HTTP tab to the body", () => {
    expect(resolveApplyAction(httpTab(), "anything")).toEqual({ label: "applyBody", field: "body" });
  });

  it("maps a GraphQL tab with valid JSON to variables", () => {
    expect(resolveApplyAction(graphqlTab, '{"id":1}')).toEqual({
      label: "applyVariables",
      field: "variables",
    });
  });

  it("disables a GraphQL tab for invalid JSON", () => {
    expect(resolveApplyAction(graphqlTab, "{nope")).toEqual({
      label: "applyVariables",
      field: "variables",
      disabledReason: "invalidJson",
    });
  });

  it("maps WebSocket and Socket.IO tabs to the message draft", () => {
    const expected = { label: "applyMessage", field: "draft" };
    expect(resolveApplyAction(wsTab, "hello")).toEqual(expected);
    expect(resolveApplyAction(ioTab, "hello")).toEqual(expected);
  });
});

describe("buildApplyPatch", () => {
  it("keeps a text-capable body type and replaces only the content", () => {
    const tab = httpTab({ type: "xml", content: "<a/>", extra: 1 });
    expect(buildApplyPatch(tab, "body", "<b/>")).toEqual({
      body: { type: "xml", content: "<b/>", extra: 1 },
    });
  });

  it.each(["none", "form-data", "urlencoded"])(
    "switches a %s body to json for JSON code",
    (type) => {
      expect(buildApplyPatch(httpTab({ type, content: "" }), "body", '{"a":1}')).toEqual({
        body: { type: "json", content: '{"a":1}' },
      });
    },
  );

  it("switches a non-text body to text for non-JSON code", () => {
    expect(buildApplyPatch(httpTab({ type: "none", content: "" }), "body", "plain")).toEqual({
      body: { type: "text", content: "plain" },
    });
  });

  it("writes only the named field for variables and draft", () => {
    expect(buildApplyPatch(graphqlTab, "variables", '{"a":1}')).toEqual({ variables: '{"a":1}' });
    expect(buildApplyPatch(wsTab, "draft", "msg")).toEqual({ draft: "msg" });
  });
});

describe("buildApplyBefore", () => {
  it("keeps only the body for an HTTP tab", () => {
    const body = { type: "text", content: "old" };
    expect(buildApplyBefore(httpTab(body))).toEqual({ body });
  });

  it("snapshots the editable fields of a GraphQL tab", () => {
    expect(buildApplyBefore(graphqlTab)).toEqual({
      name: "G",
      url: "https://api.test/graphql",
      headers: [],
      query: "{ a }",
      variables: "{}",
      operationName: "",
      auth: { type: "none" },
    });
  });

  it("snapshots a WebSocket tab", () => {
    expect(buildApplyBefore(wsTab)).toEqual({
      name: "W",
      url: "wss://x",
      headers: [],
      draft: "hi",
    });
  });
});
