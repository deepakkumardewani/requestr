"use client";

import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { RELAY_SLASH_MENU_MAX_HEIGHT_PX } from "@/lib/relay/constants";
import {
  SLASH_COMMAND_ICONS,
  SLASH_GROUP_ORDER,
  type SlashCommand,
  type SlashGroup,
} from "@/lib/relay/slashCommands";
import { cn } from "@/lib/utils";

export type SlashMenuHandle = {
  /** Handles a key typed in the composer; true when the menu used it. */
  handleKeyDown: (
    event: Pick<KeyboardEvent, "key" | "preventDefault">,
  ) => boolean;
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
 * Focus stays in the editor, so the highlighted row is announced through
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

  const sections = useMemo(() => {
    const byGroup = new Map<SlashGroup, SlashCommand[]>();
    for (const command of commands) {
      const list = byGroup.get(command.group) ?? [];
      list.push(command);
      byGroup.set(command.group, list);
    }
    return SLASH_GROUP_ORDER.flatMap((group) => {
      const items = byGroup.get(group);
      return items?.length ? [{ group, items }] : [];
    });
  }, [commands]);

  const flatCommands = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );

  const activeIndex = Math.min(active, Math.max(flatCommands.length - 1, 0));

  useEffect(() => setActive(0), [query]);

  const optionId = (command: SlashCommand) => `${listId}-${command.id}`;

  useImperativeHandle(ref, () => ({
    handleKeyDown(event) {
      const last = flatCommands.length - 1;
      if (last < 0) return false;
      switch (event.key) {
        case "ArrowDown":
          setActive(activeIndex >= last ? 0 : activeIndex + 1);
          break;
        case "ArrowUp":
          setActive(activeIndex <= 0 ? last : activeIndex - 1);
          break;
        case "Enter":
        case "Tab":
          onSelect(flatCommands[activeIndex]);
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
        flatCommands[activeIndex]
          ? optionId(flatCommands[activeIndex])
          : undefined
      }
      data-testid="relay-slash-menu"
      className="flex max-h-[var(--relay-slash-menu-max-height)] max-w-full flex-col overflow-x-hidden overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      style={
        {
          "--relay-slash-menu-max-height": `${RELAY_SLASH_MENU_MAX_HEIGHT_PX}px`,
        } as CSSProperties
      }
    >
      {sections.map(({ group, items }) => (
        <div
          key={group}
          role="group"
          aria-label={t(`slash.group.${group}`)}
          data-testid="relay-slash-group"
          data-group={group}
          className="flex flex-col gap-0.5"
        >
          <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t(`slash.group.${group}`)}
          </div>
          {items.map((command) => {
            const index = flatCommands.indexOf(command);
            const Icon = SLASH_COMMAND_ICONS[command.icon];
            return (
              <div
                key={command.id}
                id={optionId(command)}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                data-testid="relay-slash-option"
                data-command={command.id}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 min-w-0",
                  index === activeIndex && "bg-muted",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={() => onSelect(command)}
                onKeyDown={() => undefined}
              >
                <Icon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="shrink-0 font-medium">{command.name}</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {t(command.descriptionKey)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
