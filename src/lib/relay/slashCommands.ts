/**
 * Slash commands for the composer (FR-193). Each one expands to a plain prompt
 * about the tab the user has open, so it works before dedicated tools exist.
 */

export type SlashCommandId = "explain" | "assert" | "curl" | "docs" | "clear";

export type SlashCommand = {
  id: SlashCommandId;
  /** What the user types, including the slash. */
  name: `/${SlashCommandId}`;
  /** Message key under `relay` for the one-line description. */
  descriptionKey: `slash.${SlashCommandId}.description`;
  /** Message key under `relay` for the prompt it fills; absent when it runs an action. */
  promptKey?: `slash.${SlashCommandId}.prompt`;
  /** The tool the prompt steers the model toward, when there is one. */
  tool?: "generate_tests" | "export_curl" | "generate_docs";
  /** Asks the user to confirm first when the conversation already has messages. */
  confirmWhenThreadNotEmpty?: boolean;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: "explain",
    name: "/explain",
    descriptionKey: "slash.explain.description",
    promptKey: "slash.explain.prompt",
  },
  {
    id: "assert",
    name: "/assert",
    descriptionKey: "slash.assert.description",
    promptKey: "slash.assert.prompt",
    tool: "generate_tests",
  },
  {
    id: "curl",
    name: "/curl",
    descriptionKey: "slash.curl.description",
    promptKey: "slash.curl.prompt",
    tool: "export_curl",
  },
  {
    id: "docs",
    name: "/docs",
    descriptionKey: "slash.docs.description",
    promptKey: "slash.docs.prompt",
    tool: "generate_docs",
  },
  {
    id: "clear",
    name: "/clear",
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

export function filterSlashCommands(query: string): SlashCommand[] {
  return SLASH_COMMANDS.filter((command) => command.id.startsWith(query));
}

export function needsClearConfirm(
  command: SlashCommand,
  threadHasMessages: boolean,
): boolean {
  return Boolean(command.confirmWhenThreadNotEmpty) && threadHasMessages;
}
