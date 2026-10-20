import type { ContextChip } from "@/lib/relay/chips";
import type { SlashCommand, SlashTargetKind } from "@/lib/relay/slashCommands";

export type SlashTargetResolution =
  | { satisfied: true }
  | { satisfied: false; needKind: SlashTargetKind };

const hasTargetKind = (
  attached: readonly ContextChip[],
  kind: SlashTargetKind,
): boolean => {
  if (kind === "request") {
    return attached.some(
      (chip) => chip.kind === "request" || chip.kind === "tab",
    );
  }
  return attached.some((chip) => chip.kind === kind);
};

/** Whether the attached chips satisfy the slash command's target rules (RP-204). */
export function resolveSlashTarget(
  command: SlashCommand,
  attachedItems: readonly ContextChip[],
): SlashTargetResolution {
  if (command.id === "clear" || command.id === "import") {
    return { satisfied: true };
  }

  if (command.id === "run") {
    const satisfied =
      hasTargetKind(attachedItems, "request") ||
      hasTargetKind(attachedItems, "chain");
    return satisfied
      ? { satisfied: true }
      : { satisfied: false, needKind: "request" };
  }

  if (command.id === "summarize") {
    return attachedItems.length > 0
      ? { satisfied: true }
      : { satisfied: false, needKind: "request" };
  }

  if (command.requiresTarget === null) {
    return { satisfied: true };
  }

  if (hasTargetKind(attachedItems, command.requiresTarget)) {
    return { satisfied: true };
  }

  return { satisfied: false, needKind: command.requiresTarget };
}
