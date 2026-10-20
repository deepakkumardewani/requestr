/**
 * Slash commands for the composer (FR-193). Each one expands to a plain prompt
 * that steers the model toward existing tools.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileDiff,
  FileDown,
  FileUp,
  FlaskConical,
  GitBranch,
  Globe,
  Lightbulb,
  ListChecks,
  ListTree,
  Play,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
} from "lucide-react";

export type SlashGroup =
  | "understand"
  | "build"
  | "test"
  | "run"
  | "share"
  | "chat";

export const SLASH_GROUP_ORDER: readonly SlashGroup[] = [
  "understand",
  "build",
  "test",
  "run",
  "share",
  "chat",
] as const;

export type SlashTargetKind = "request" | "collection" | "chain" | "tab";

export type SlashCommandId =
  | "explain"
  | "summarize"
  | "docs"
  | "new"
  | "import"
  | "chain"
  | "env"
  | "assert"
  | "tests"
  | "run"
  | "fix"
  | "diff"
  | "curl"
  | "export"
  | "clear";

export const SLASH_COMMAND_ICONS = {
  explain: Lightbulb,
  summarize: ListTree,
  docs: BookOpen,
  new: Sparkles,
  import: FileUp,
  chain: GitBranch,
  env: Globe,
  assert: ListChecks,
  tests: FlaskConical,
  run: Play,
  fix: Wrench,
  diff: FileDiff,
  curl: Terminal,
  export: FileDown,
  clear: Trash2,
} as const satisfies Record<SlashCommandId, LucideIcon>;

export type SlashIconName = keyof typeof SLASH_COMMAND_ICONS;

export type SlashCommand = {
  id: SlashCommandId;
  /** What the user types, including the slash. */
  name: `/${SlashCommandId}`;
  group: SlashGroup;
  icon: SlashIconName;
  requiresTarget: SlashTargetKind | null;
  /** Message key under `relay` for the one-line description. */
  descriptionKey: `slash.${SlashCommandId}.description`;
  /** Message key under `relay` for the prompt it fills; absent when it runs an action. */
  promptKey?: `slash.${SlashCommandId}.prompt`;
  /** The tool the prompt steers the model toward, when there is one. */
  tool?:
    | "generate_tests"
    | "export_curl"
    | "generate_docs"
    | "import_curl"
    | "send_request"
    | "run_chain"
    | "diff_responses"
    | "export_history";
  /** Asks the user to confirm first when the conversation already has messages. */
  confirmWhenThreadNotEmpty?: boolean;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: "explain",
    name: "/explain",
    group: "understand",
    icon: "explain",
    requiresTarget: "request",
    descriptionKey: "slash.explain.description",
    promptKey: "slash.explain.prompt",
  },
  {
    id: "summarize",
    name: "/summarize",
    group: "understand",
    icon: "summarize",
    requiresTarget: null,
    descriptionKey: "slash.summarize.description",
    promptKey: "slash.summarize.prompt",
  },
  {
    id: "docs",
    name: "/docs",
    group: "understand",
    icon: "docs",
    requiresTarget: "collection",
    descriptionKey: "slash.docs.description",
    promptKey: "slash.docs.prompt",
    tool: "generate_docs",
  },
  {
    id: "new",
    name: "/new",
    group: "build",
    icon: "new",
    requiresTarget: null,
    descriptionKey: "slash.new.description",
    promptKey: "slash.new.prompt",
  },
  {
    id: "import",
    name: "/import",
    group: "build",
    icon: "import",
    requiresTarget: null,
    descriptionKey: "slash.import.description",
    promptKey: "slash.import.prompt",
    tool: "import_curl",
  },
  {
    id: "chain",
    name: "/chain",
    group: "build",
    icon: "chain",
    requiresTarget: null,
    descriptionKey: "slash.chain.description",
    promptKey: "slash.chain.prompt",
  },
  {
    id: "env",
    name: "/env",
    group: "build",
    icon: "env",
    requiresTarget: null,
    descriptionKey: "slash.env.description",
    promptKey: "slash.env.prompt",
  },
  {
    id: "assert",
    name: "/assert",
    group: "test",
    icon: "assert",
    requiresTarget: "request",
    descriptionKey: "slash.assert.description",
    promptKey: "slash.assert.prompt",
    tool: "generate_tests",
  },
  {
    id: "tests",
    name: "/tests",
    group: "test",
    icon: "tests",
    requiresTarget: "request",
    descriptionKey: "slash.tests.description",
    promptKey: "slash.tests.prompt",
  },
  {
    id: "run",
    name: "/run",
    group: "run",
    icon: "run",
    requiresTarget: "request",
    descriptionKey: "slash.run.description",
    promptKey: "slash.run.prompt",
    tool: "send_request",
  },
  {
    id: "fix",
    name: "/fix",
    group: "run",
    icon: "fix",
    requiresTarget: "request",
    descriptionKey: "slash.fix.description",
    promptKey: "slash.fix.prompt",
  },
  {
    id: "diff",
    name: "/diff",
    group: "run",
    icon: "diff",
    requiresTarget: "request",
    descriptionKey: "slash.diff.description",
    promptKey: "slash.diff.prompt",
    tool: "diff_responses",
  },
  {
    id: "curl",
    name: "/curl",
    group: "share",
    icon: "curl",
    requiresTarget: "request",
    descriptionKey: "slash.curl.description",
    promptKey: "slash.curl.prompt",
    tool: "export_curl",
  },
  {
    id: "export",
    name: "/export",
    group: "share",
    icon: "export",
    requiresTarget: null,
    descriptionKey: "slash.export.description",
    promptKey: "slash.export.prompt",
    tool: "export_curl",
  },
  {
    id: "clear",
    name: "/clear",
    group: "chat",
    icon: "clear",
    requiresTarget: null,
    descriptionKey: "slash.clear.description",
    confirmWhenThreadNotEmpty: true,
  },
];

/**
 * The command name typed so far, or null when the menu should stay closed.
 * The slash only counts at the very start and while no space has been typed.
 */
export function findSlashQuery(text: string): string | null {
  if (!text.startsWith("/") || /\s/.test(text)) return null;
  return text.slice(1).toLowerCase();
}

export function filterSlashCommands(
  query: string,
  describe?: (descriptionKey: SlashCommand["descriptionKey"]) => string,
): SlashCommand[] {
  const q = query.toLowerCase();
  if (!q) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter((command) => {
    if (command.id.startsWith(q)) return true;
    if (!describe) return false;
    return describe(command.descriptionKey).toLowerCase().includes(q);
  });
}

export function needsClearConfirm(
  command: SlashCommand,
  threadHasMessages: boolean,
): boolean {
  return Boolean(command.confirmWhenThreadNotEmpty) && threadHasMessages;
}

/** Stable menu order: groups in SLASH_GROUP_ORDER, commands in SLASH_COMMANDS order. */
export function orderSlashCommands(
  commands: readonly SlashCommand[],
): SlashCommand[] {
  const ids = new Set(commands.map((c) => c.id));
  return SLASH_COMMANDS.filter((c) => ids.has(c.id));
}
