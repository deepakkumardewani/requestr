import { describe, expect, it } from "vitest";
import type { ContextChip, ContextChipKind } from "@/lib/relay/chips";
import {
  SLASH_COMMANDS,
  type SlashCommand,
  type SlashCommandId,
} from "@/lib/relay/slashCommands";
import { resolveSlashTarget } from "./slashTarget";

const chip = (kind: ContextChipKind, id = "id-1"): ContextChip => ({
  kind,
  id,
  label: `Label ${id}`,
});

const byId = (id: SlashCommandId): SlashCommand => {
  const command = SLASH_COMMANDS.find((c) => c.id === id);
  if (!command) throw new Error(`missing ${id}`);
  return command;
};

type AttachmentPreset =
  | "empty"
  | "tab"
  | "request"
  | "chain"
  | "collection"
  | "environment";

const attachmentsFor = (preset: AttachmentPreset): readonly ContextChip[] => {
  switch (preset) {
    case "empty":
      return [];
    case "tab":
      return [chip("tab")];
    case "request":
      return [chip("request")];
    case "chain":
      return [chip("chain")];
    case "collection":
      return [chip("collection")];
    case "environment":
      return [chip("environment")];
  }
};

/** Expected resolution per command and attachment preset (RP-204). */
const RESOLUTION_MATRIX: Record<
  SlashCommandId,
  Record<
    AttachmentPreset,
    | { satisfied: true }
    | { satisfied: false; needKind: "request" | "collection" | "chain" | "tab" }
  >
> = {
  explain: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: false, needKind: "request" },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  summarize: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
  docs: {
    empty: { satisfied: false, needKind: "collection" },
    tab: { satisfied: false, needKind: "collection" },
    request: { satisfied: false, needKind: "collection" },
    chain: { satisfied: false, needKind: "collection" },
    collection: { satisfied: true },
    environment: { satisfied: false, needKind: "collection" },
  },
  new: {
    empty: { satisfied: true },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
  import: {
    empty: { satisfied: true },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
  chain: {
    empty: { satisfied: true },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
  env: {
    empty: { satisfied: true },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
  assert: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: false, needKind: "request" },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  tests: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: false, needKind: "request" },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  run: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  fix: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: false, needKind: "request" },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  diff: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: false, needKind: "request" },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  curl: {
    empty: { satisfied: false, needKind: "request" },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: false, needKind: "request" },
    collection: { satisfied: false, needKind: "request" },
    environment: { satisfied: false, needKind: "request" },
  },
  export: {
    empty: { satisfied: true },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
  clear: {
    empty: { satisfied: true },
    tab: { satisfied: true },
    request: { satisfied: true },
    chain: { satisfied: true },
    collection: { satisfied: true },
    environment: { satisfied: true },
  },
};

const PRESETS: AttachmentPreset[] = [
  "empty",
  "tab",
  "request",
  "chain",
  "collection",
  "environment",
];

describe("resolveSlashTarget", () => {
  for (const command of SLASH_COMMANDS) {
    describe(command.id, () => {
      for (const preset of PRESETS) {
        it(`[${preset}] matches RP-204 target rules`, () => {
          const expected = RESOLUTION_MATRIX[command.id][preset];
          const result = resolveSlashTarget(
            command,
            attachmentsFor(preset),
          );
          expect(result).toEqual(expected);
        });
      }
    });
  }

  it("[success] request-only attachment does not satisfy a chain-only need", () => {
    const docs = byId("docs");
    expect(resolveSlashTarget(docs, [chip("request")])).toEqual({
      satisfied: false,
      needKind: "collection",
    });
  });

  it("[success] chain attachment satisfies /run but not request-only commands", () => {
    expect(resolveSlashTarget(byId("run"), [chip("chain")])).toEqual({
      satisfied: true,
    });
    expect(resolveSlashTarget(byId("assert"), [chip("chain")])).toEqual({
      satisfied: false,
      needKind: "request",
    });
  });
});
