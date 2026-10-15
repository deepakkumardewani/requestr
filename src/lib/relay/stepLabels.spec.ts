import { describe, expect, it } from "vitest";
import en from "../../../messages/en/relay.json";
import fr from "../../../messages/fr/relay.json";
import ja from "../../../messages/ja/relay.json";
import { RELAY_TOOL_SCHEMAS } from "./tools/schemas";
import {
  ACTIVITY_GENERIC_KEY,
  ACTIVITY_THINKING_KEY,
  stepLabelFor,
} from "./stepLabels";

const TOOL_NAMES = Object.keys(RELAY_TOOL_SCHEMAS);
const NAMED_INPUT = { name: "Orders", query: "Orders" };

const SPEC_NAMED_TOOLS = [
  "close_tab",
  "close_all_tabs",
  "delete_requests",
  "delete_requests_in_collection",
  "create_graphql_request",
  "create_websocket_request",
  "create_socketio_request",
  "update_tab_request",
  "get_tab_request",
  "clear_history",
  "export_history",
  "generate_tests",
  "generate_docs",
  "import_curl",
  "export_curl",
  "diff_responses",
  "rename_environment",
  "rename_chain",
];

describe("stepLabelFor", () => {
  it("exposes the stable i18n keys", () => {
    expect(ACTIVITY_THINKING_KEY).toBe("activity.thinking");
    expect(ACTIVITY_GENERIC_KEY).toBe("activity.generic");
  });

  it("falls back to the generic key for a tool that is not registered", () => {
    expect(stepLabelFor("not_a_tool", NAMED_INPUT)).toEqual({
      key: "activity.generic",
      params: {},
    });
  });

  it("does not treat inherited object keys as registered tools", () => {
    expect(stepLabelFor("toString", {}).key).toBe("activity.generic");
  });

  it.each(TOOL_NAMES)("gives %s its own label that exists in English", (tool) => {
    const label = stepLabelFor(tool, NAMED_INPUT);
    expect(label.key).toBe(`activity.tools.${tool}`);
    expect(Object.keys(en.activity.tools)).toContain(tool);
  });

  // Later phases register these tools; their strings ship now so no label work remains.
  it.each(SPEC_NAMED_TOOLS)("ships a non-empty %s label in every locale", (tool) => {
    for (const locale of [en, fr, ja]) {
      const labels = locale.activity.tools as Record<string, string>;
      expect(labels[tool]?.length).toBeGreaterThan(0);
    }
  });

  it("gives every tool label a counterpart in every locale", () => {
    const keys = Object.keys(en.activity.tools).sort();
    expect(Object.keys(fr.activity.tools).sort()).toEqual(keys);
    expect(Object.keys(ja.activity.tools).sort()).toEqual(keys);
  });

  it("takes the target from query for search_workspace", () => {
    expect(stepLabelFor("search_workspace", { query: "  login  " })).toEqual({
      key: "activity.tools.search_workspace",
      params: { name: "login" },
    });
  });

  it("takes the target from name for a create tool", () => {
    expect(stepLabelFor("create_collection", { name: "Orders" })).toEqual({
      key: "activity.tools.create_collection",
      params: { name: "Orders" },
    });
  });

  it("uses no params for a tool without a target name", () => {
    expect(stepLabelFor("get_request", { id: "r1" })).toEqual({
      key: "activity.tools.get_request",
      params: {},
    });
  });

  it.each([
    ["undefined input", undefined],
    ["null input", null],
    ["a string input", "Orders"],
    ["missing field", {}],
    ["a non-string field", { name: 5 }],
    ["a blank field", { name: "   " }],
  ])("falls back to generic for a named tool with %s", (_label, input) => {
    expect(stepLabelFor("create_request", input)).toEqual({
      key: "activity.generic",
      params: {},
    });
  });
});
