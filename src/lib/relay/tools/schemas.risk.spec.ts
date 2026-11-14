import { afterEach, describe, expect, it } from "vitest";
import {
  approvalNeeded,
  awaitsUser,
  BULK_CONFIRM_THRESHOLD,
  declinedError,
  IMPORT_CANCELLED_ERROR,
  isJsonObjectText,
  isUserPrompt,
  RELAY_TOOL_SCHEMAS,
  type RiskContext,
  registerRiskContext,
  requiresBulkApproval,
  requiresDisableApproval,
  risk,
  USER_DECLINED_ERROR,
} from "./schemas";

/**
 * HH-RISK: one decision site (`risk`) lets Review hold an `auto` call for a
 * card, while Skip and Always-ask behave exactly as before.
 */

const MODES = ["review", "skip", "always-ask"] as const;

const EMPTY: RiskContext = { globalBaseUrl: "", globalHeaders: [] };
const withGlobals = (over: Partial<RiskContext>): RiskContext => ({
  ...EMPTY,
  ...over,
});

const header = (key: string, value: string, enabled: boolean | null = true) => ({
  key,
  value,
  enabled,
});
const globals = (baseUrl: string | null, headers: unknown[] | null) => ({
  baseUrl,
  headers,
});

describe("risk(): table rows", () => {
  it("escalates set_request_scripts every time, even for an unchanged script", () => {
    expect(risk("set_request_scripts", { requestId: "r1", pre: "", post: null }, EMPTY)).toBe("escalate");
    expect(risk("set_request_scripts", { requestId: "r1", pre: null, post: "x" }, EMPTY)).toBe("escalate");
  });

  it.each([
    [{ sslVerify: false, followRedirects: null }, "escalate"],
    [{ sslVerify: true, followRedirects: null }, "low"],
    [{ sslVerify: null, followRedirects: false }, "low"],
  ] as const)("update_proxy_settings %j is %s", (input, level) => {
    expect(risk("update_proxy_settings", input, EMPTY)).toBe(level);
  });

  it.each([
    ["export_history", { format: "json" }],
    ["export_postman", { collectionId: "c1" }],
  ])("%s writes a file to disk, so it escalates", (name, input) => {
    expect(risk(name, input, EMPTY)).toBe("escalate");
  });

  it.each([
    [{ shareValues: true, enabled: null }, "escalate"],
    [{ shareValues: false, enabled: null }, "low"],
    [{ shareValues: null, enabled: false }, "low"],
    [{ shareValues: null, enabled: true }, "low"],
  ] as const)("set_relay_preferences %j is %s", (input, level) => {
    expect(risk("set_relay_preferences", input, EMPTY)).toBe(level);
  });

  it("is low for a tool with no row and for an unknown tool name", () => {
    expect(risk("list_environments", {}, EMPTY)).toBe("low");
    expect(risk("rename_the_universe", {}, EMPTY)).toBe("low");
  });
});

describe("risk(): set_global_variables diffs against current settings", () => {
  const current = withGlobals({
    globalBaseUrl: "https://old.test",
    globalHeaders: [
      { key: "X-Trace", value: "1", enabled: true },
      { key: "X-Off", value: "2", enabled: false },
    ],
  });

  it("escalates a changed base URL and ignores surrounding whitespace", () => {
    expect(risk("set_global_variables", globals("https://new.test", null), current)).toBe("escalate");
    expect(risk("set_global_variables", globals("  https://old.test ", null), current)).toBe("low");
  });

  it("escalates a base URL set where none was set, and clearing it too", () => {
    expect(risk("set_global_variables", globals("https://a.test", null), EMPTY)).toBe("escalate");
    expect(risk("set_global_variables", globals("", null), current)).toBe("escalate");
  });

  it("treats null base URL and null headers as no change", () => {
    expect(risk("set_global_variables", globals(null, null), current)).toBe("low");
  });

  it("escalates an added header and a changed header value (key match ignores case)", () => {
    expect(risk("set_global_variables", globals(null, [header("X-New", "1")]), current)).toBe("escalate");
    expect(risk("set_global_variables", globals(null, [header("x-trace", "9")]), current)).toBe("escalate");
  });

  it("escalates re-enabling a disabled header, including when enabled is null", () => {
    expect(risk("set_global_variables", globals(null, [header("X-Off", "2", true)]), current)).toBe("escalate");
    expect(risk("set_global_variables", globals(null, [header("X-Off", "2", null)]), current)).toBe("escalate");
  });

  it("is low for an unchanged list, a disabled header kept disabled, and a removal", () => {
    expect(risk("set_global_variables", globals(null, [header("X-Trace", "1"), header("X-Off", "2", false)]), current)).toBe("low");
    expect(risk("set_global_variables", globals(null, [header("X-Trace", "1")]), current)).toBe("low");
    expect(risk("set_global_variables", globals(null, []), current)).toBe("low");
  });

  it("escalates header addition regardless of an unchanged base URL", () => {
    expect(risk("set_global_variables", globals("https://old.test", [header("X-New", "1")]), current)).toBe("escalate");
  });
});

describe("registerRiskContext", () => {
  afterEach(() => {
    registerRiskContext(() => EMPTY);
  });

  it("feeds the registered provider to risk() when no context is passed", () => {
    registerRiskContext(() => withGlobals({ globalBaseUrl: "https://live.test" }));
    expect(risk("set_global_variables", globals("https://live.test", null))).toBe("low");
    expect(risk("set_global_variables", globals("https://other.test", null))).toBe("escalate");
  });

  it("starts from an empty context, so any header is an addition", () => {
    registerRiskContext(() => EMPTY);
    expect(risk("set_global_variables", globals(null, [header("A", "1")]))).toBe("escalate");
  });
});

describe("approvalNeeded: the risk x mode matrix", () => {
  const ESCALATING = [
    ["set_request_scripts", { requestId: "r1", pre: "a", post: null }],
    ["update_proxy_settings", { sslVerify: false, followRedirects: null }],
    ["export_history", { format: "har" }],
    ["export_postman", { collectionId: "c1" }],
    ["set_relay_preferences", { shareValues: true, enabled: null }],
  ] as const;
  const NON_ESCALATING = [
    ["update_proxy_settings", { sslVerify: true, followRedirects: null }],
    ["set_relay_preferences", { shareValues: false, enabled: null }],
    ["set_theme", { theme: "dark" }],
  ] as const;

  it.each(ESCALATING)("%s escalating input: card in Review and Always-ask, none in Skip", (name, input) => {
    expect(approvalNeeded(name, input, "review")).toBe(true);
    expect(approvalNeeded(name, input, "always-ask")).toBe(true);
    expect(approvalNeeded(name, input, "skip")).toBe(false);
  });

  it.each(NON_ESCALATING)("%s non-escalating input: no card in Review or Skip", (name, input) => {
    expect(approvalNeeded(name, input, "review")).toBe(false);
    expect(approvalNeeded(name, input, "skip")).toBe(false);
  });

  it("Always-ask still asks for non-escalating auto tools (unchanged behaviour)", () => {
    expect(approvalNeeded("set_theme", { theme: "dark" }, "always-ask")).toBe(true);
  });

  it("defaults to Review when no mode is given", () => {
    expect(approvalNeeded("export_history", { format: "json" })).toBe(true);
  });

  it("a confirm tool is asked once, in every mode but Skip", () => {
    expect(approvalNeeded("clear_history", {}, "review")).toBe(true);
    expect(approvalNeeded("clear_history", {}, "skip")).toBe(false);
  });

  it("read and ui tools never need approval", () => {
    for (const mode of MODES) {
      expect(approvalNeeded("list_environments", {}, mode)).toBe(false);
    }
  });
});

describe("awaitsUser agrees with approvalNeeded for escalating tools", () => {
  const CASES = [
    ["set_request_scripts", { requestId: "r1", pre: "a", post: null }],
    ["update_proxy_settings", { sslVerify: false, followRedirects: null }],
    ["export_history", { format: "json" }],
    ["export_postman", { collectionId: "c1" }],
    ["set_relay_preferences", { shareValues: true, enabled: null }],
  ] as const;

  it.each(CASES)("%s", (name, input) => {
    for (const mode of MODES) {
      expect(awaitsUser(name, input, mode), mode).toBe(approvalNeeded(name, input, mode));
    }
  });

  it("does not hold a malformed escalating call: the model gets the validation error", () => {
    expect(awaitsUser("export_history", { format: "xml" }, "review")).toBe(false);
    expect(awaitsUser("set_request_scripts", { requestId: "r1" }, "review")).toBe(false);
  });
});

describe("gate helpers around the risk table", () => {
  it("never asks for an unknown tool, and awaitsUser ignores it too", () => {
    expect(approvalNeeded("rename_the_universe", {}, "review")).toBe(false);
    expect(awaitsUser("rename_the_universe", {}, "review")).toBe(false);
  });

  it("ask_user always awaits the user, in every mode, without being an approval", () => {
    expect(isUserPrompt("ask_user")).toBe(true);
    expect(isUserPrompt("set_theme")).toBe(false);
    for (const mode of MODES) {
      expect(approvalNeeded("ask_user", {}, mode)).toBe(false);
    }
  });

  it("turning Relay off is an approval in Review and Always-ask only", () => {
    const off = { shareValues: null, enabled: false };
    expect(requiresDisableApproval("set_relay_preferences", off)).toBe(true);
    expect(requiresDisableApproval("set_relay_preferences", { shareValues: null, enabled: true })).toBe(false);
    expect(requiresDisableApproval("set_theme", off)).toBe(false);
    expect(approvalNeeded("set_relay_preferences", off, "review")).toBe(true);
    expect(approvalNeeded("set_relay_preferences", off, "skip")).toBe(false);
  });

  it("a bulk update over the threshold counts distinct ids only", () => {
    const op = { method: null, urlReplace: null, upsertHeaders: null, removeHeaders: null };
    const many = Array.from({ length: BULK_CONFIRM_THRESHOLD + 1 }, (_, i) => `r${i}`);
    expect(requiresBulkApproval("bulk_update_requests", { ids: many, op })).toBe(true);
    expect(requiresBulkApproval("bulk_update_requests", { ids: [...many.slice(0, 2), ...many.slice(0, 2)], op })).toBe(false);
    expect(requiresBulkApproval("bulk_update_requests", { ids: "nope" })).toBe(false);
    expect(requiresBulkApproval("set_theme", { ids: many })).toBe(false);
    expect(approvalNeeded("bulk_update_requests", { ids: many, op }, "review")).toBe(true);
    expect(approvalNeeded("bulk_update_requests", { ids: many, op }, "skip")).toBe(false);
  });

  it("a declined card answers 'user declined', except a backup import which answers 'cancelled'", () => {
    expect(declinedError("delete_request")).toBe(USER_DECLINED_ERROR);
    expect(declinedError("import_backup")).toBe(IMPORT_CANCELLED_ERROR);
  });
});

describe("update_tab_request input rules", () => {
  const base = {
    tabId: "t1",
    kind: "graphql",
    name: null,
    url: null,
    headers: null,
    query: null,
    variables: null,
    operationName: null,
    auth: null,
    draft: null,
    eventName: null,
  };
  const parse = (over: Record<string, unknown>) =>
    RELAY_TOOL_SCHEMAS.update_tab_request.inputSchema.safeParse({ ...base, ...over });
  const messages = (over: Record<string, unknown>) => {
    const result = parse(over);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it("accepts the fields a tab kind owns", () => {
    expect(parse({ query: "{ a }", variables: '{"id": 1}' }).success).toBe(true);
    expect(parse({ kind: "websocket", draft: "hi", url: "wss://a.test" }).success).toBe(true);
    expect(parse({ kind: "socketio", draft: "hi", eventName: "msg", url: "https://a.test" }).success).toBe(true);
    expect(parse({ kind: "websocket", url: "{{wsUrl}}" }).success).toBe(true);
  });

  it("rejects a field the kind does not own, naming the field and the kind", () => {
    expect(messages({ kind: "websocket", query: "{ a }" })).toEqual([
      "query does not apply to a websocket tab; set it to null",
    ]);
    expect(messages({ kind: "graphql", eventName: "x" })[0]).toMatch(/eventName does not apply to a graphql tab/);
  });

  it("rejects a url with the wrong scheme for the kind", () => {
    expect(messages({ url: "ftp://a.test" })[0]).toMatch(/must start with http:\/\/ or https:\/\//);
    expect(messages({ kind: "websocket", url: "https://a.test" })[0]).toMatch(/ws:\/\/ or wss:\/\//);
    expect(messages({ kind: "socketio", url: "ftp://a.test" })[0]).toMatch(/http:\/\/, https:\/\/, ws:\/\/ or wss:\/\//);
  });

  it("rejects variables that are not a JSON object", () => {
    expect(messages({ variables: "[1]" })[0]).toMatch(/JSON object/);
    expect(messages({ variables: "not json" })[0]).toMatch(/JSON object/);
  });

  it("isJsonObjectText: blank and objects pass; arrays, scalars, null and broken text do not", () => {
    expect(isJsonObjectText("   ")).toBe(true);
    expect(isJsonObjectText('{"a":1}')).toBe(true);
    for (const text of ["[]", "1", "null", "{oops"]) {
      expect(isJsonObjectText(text), text).toBe(false);
    }
  });
});
