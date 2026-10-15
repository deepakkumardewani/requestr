"use client";

import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useState,
} from "react";
import type { SlashCommand } from "@/lib/relay/slashCommands";
import { cn } from "@/lib/utils";

export type SlashMenuHandle = {
  /** Handles a key typed in the composer; true when the menu used it. */
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
};

type SlashMenuProps = {
  commands: readonly SlashCommand[];
  /** Text typed after the slash; a change puts the highlight back on the first row. */
  query: string;
  onSelect: (command: SlashCommand) => void;
  onDismiss: () => void;
  ref?: Ref<SlashMenuHandle>;
};

/**
 * Focus stays in the textarea, so the highlighted row is announced through
 * `aria-activedescendant` and the composer forwards its keys here (NFR-8).
 * The highlight is local to this menu (NFR-10).
 */
export function SlashMenu({
  commands,
  query,
  onSelect,
  onDismiss,
  ref,
}: SlashMenuProps) {
  const t = useTranslations("relay");
  const listId = useId();
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, commands.length - 1);

  // Restart from the top whenever the query changes.
  useEffect(() => setActive(0), [query]);

  const optionId = (command: SlashCommand) => `${listId}-${command.id}`;

  useImperativeHandle(ref, () => ({
    handleKeyDown(event) {
      const last = commands.length - 1;
      switch (event.key) {
        case "ArrowDown":
          setActive(activeIndex >= last ? 0 : activeIndex + 1);
          break;
        case "ArrowUp":
          setActive(activeIndex <= 0 ? last : activeIndex - 1);
          break;
        case "Enter":
        case "Tab":
          onSelect(commands[activeIndex]);
          break;
        case "Escape":
          onDismiss();
          break;
        default:
          return false;
      }
      event.preventDefault();
      return true;
    },
  }));

  return (
    <div
      role="listbox"
      tabIndex={-1}
      id={listId}
      aria-label={t("slash.label")}
      aria-activedescendant={
        commands[activeIndex] ? optionId(commands[activeIndex]) : undefined
      }
      data-testid="relay-slash-menu"
      className="flex flex-col gap-0.5 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md"
    >
      {commands.map((command, index) => (
        <div
          key={command.id}
          id={optionId(command)}
          role="option"
          tabIndex={-1}
          aria-selected={index === activeIndex}
          aria-label={`${command.name}: ${t(command.descriptionKey)}`}
          data-testid="relay-slash-option"
          data-command={command.id}
          className={cn(
            "flex cursor-default items-baseline gap-2 rounded-md px-2 py-1.5",
            index === activeIndex && "bg-muted",
          )}
          // Keeps the caret in the textarea while a row is clicked.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => onSelect(command)}
          onKeyDown={() => undefined}
        >
          <span className="font-medium">{command.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {t(command.descriptionKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
