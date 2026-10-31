/** @vitest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CAPABILITY_CATEGORY_BY_TOOL } from "../capabilities";
import { createRegistry, executeTool, previewConfirmation, relayToolRegistry } from "./registry";
import {
  IMPORT_CANCELLED_ERROR,
  RELAY_TOOL_SCHEMAS,
  USER_DECLINED_ERROR,
  approvalNeeded,
  declinedError,
  isJsonObjectText,
  isRelayToolName,
} from "./schemas";

const ROOT = path.resolve(__dirname, "../../../..");
const LOCALES = ["en", "fr", "ja"] as const;
const NAMESPACES = ["relayDock", "relay"] as const;
/** Operations that remove everything at once; none may exist as a tool. */
const WIPE_ALL = /wipe|purge|reset|clear_all|delete_all|erase|factory/i;
const PERMISSION_MODE = /permission|approval_mode/i;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function readMessages(locale: string, namespace: string): Json {
  const file = path.join(ROOT, "messages", locale, `${namespace}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Json;
}

function stringValues(node: Json): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(stringValues);
  if (node && typeof node === "object") return Object.values(node).flatMap(stringValues);
  return [];
}

const toolNames = [...relayToolRegistry.keys()];

describe("registry-wide guarantees", () => {
  it("[success] registers a non-empty set of tools that all have schemas", () => {
    expect(toolNames.length).toBeGreaterThan(0);
    expect(toolNames.filter((name) => !isRelayToolName(name))).toEqual([]);
  });

  describe("labels", () => {
    it.each(LOCALES)("[success] every tool has running and done labels in %s", (locale) => {
      const tools = (readMessages(locale, "relayDock") as { tools: Record<string, { running?: unknown; done?: unknown }> })
        .tools;
      const missing = toolNames.filter((name) => {
        const entry = tools[name];
        return typeof entry?.running !== "string" || typeof entry?.done !== "string" || !entry.running || !entry.done;
      });
      expect(missing).toEqual([]);
    });
  });

  describe("deny-list", () => {
    it("[invalid] no tool name or schema key targets the permission mode", () => {
      const offenders = toolNames.filter(
        (name) =>
          PERMISSION_MODE.test(name) ||
          Object.keys(
            (RELAY_TOOL_SCHEMAS[name as keyof typeof RELAY_TOOL_SCHEMAS].inputSchema as unknown as { shape: object }).shape,
          ).some((key) => PERMISSION_MODE.test(key)),
      );
      expect(offenders).toEqual([]);
    });

    it("[invalid] no tool name is a wipe-all operation", () => {
      expect(toolNames.filter((name) => WIPE_ALL.test(name))).toEqual([]);
    });

    it("[invalid] set_relay_preferences rejects permissionMode", () => {
      const schema = RELAY_TOOL_SCHEMAS.set_relay_preferences.inputSchema;
      const result = schema.safeParse({
        shareValues: null,
        speechEngine: null,
        enabled: null,
        permissionMode: "auto",
      });
      expect(result.success).toBe(false);
    });

    it("[success] set_relay_preferences accepts its own preferences", () => {
      const schema = RELAY_TOOL_SCHEMAS.set_relay_preferences.inputSchema;
      expect(schema.safeParse({ shareValues: true, speechEngine: null, enabled: null }).success).toBe(true);
    });

    it("[invalid] import_backup takes no input, so it cannot select Replace", () => {
      const schema = RELAY_TOOL_SCHEMAS.import_backup.inputSchema;
      expect(schema.safeParse({}).success).toBe(true);
      expect(schema.safeParse({ mode: "replace" }).success).toBe(false);
      expect(schema.safeParse({ strategy: "replace" }).success).toBe(false);
    });
  });

  describe("capability areas", () => {
    it("[success] every registered tool maps to a capability area", () => {
      const unmapped = toolNames.filter((name) => name !== "ask_user" && !(name in CAPABILITY_CATEGORY_BY_TOOL));
      expect(unmapped).toEqual([]);
    });
  });

  describe("brand and tool-name leakage", () => {
    it.each(LOCALES)("[invalid] no registered tool name appears in a relay i18n value (%s)", (locale) => {
      const values = NAMESPACES.flatMap((ns) => stringValues(readMessages(locale, ns)));
      const leaks = toolNames.filter((name) => {
        const pattern = new RegExp(`\\b${name}\\b`);
        return values.some((value) => pattern.test(value));
      });
      expect(leaks).toEqual([]);
    });
  });

  describe("gates and edge outcomes", () => {
    it("[success] a declined import answers cancelled and any other tool answers user declined", () => {
      expect(declinedError("import_backup")).toBe(IMPORT_CANCELLED_ERROR);
      expect(declinedError("delete_folder")).toBe(USER_DECLINED_ERROR);
    });

    it("[invalid] turning Relay off asks first unless the mode is skip", () => {
      expect(approvalNeeded("set_relay_preferences", { enabled: false }, "review")).toBe(true);
      expect(approvalNeeded("set_relay_preferences", { enabled: false }, "skip")).toBe(false);
      expect(approvalNeeded("set_relay_preferences", { enabled: true }, "review")).toBe(false);
    });

    it("[success] blank variables text counts as a JSON object", () => {
      expect(isJsonObjectText("   ")).toBe(true);
      expect(isJsonObjectText('{"id": 1}')).toBe(true);
      expect(isJsonObjectText("[1]")).toBe(false);
    });

    it("[invalid] a non-object input is reported against the input as a whole", async () => {
      const registry = createRegistry([{ name: "import_backup", run: () => ({ ok: true, data: null }) }]);
      const result = await executeTool(registry, "import_backup", "not an object", {
        store: { exists: () => true },
        redact: { secrets: [], variables: [], shareValues: false },
      } as never);
      expect(result).toEqual({ ok: false, error: expect.stringContaining("invalid input: input:") });
    });

    it("[success] a confirm tool without a describe function gets no generic preview", () => {
      const registry = createRegistry([{ name: "export_backup", run: () => ({ ok: true, data: null }) }]);
      const input = { sections: ["collections"], collectionIds: null, environmentIds: null, chainIds: null, includeSecrets: null };
      expect(previewConfirmation(registry, "export_backup", input, {} as never)).toBeNull();
    });
  });
});
