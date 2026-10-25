/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SLASH_COMMANDS,
  SLASH_GROUP_ORDER,
} from "@/lib/relay/slashCommands";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";

afterEach(cleanup);

function setup(commands = SLASH_COMMANDS, query = "") {
  const onSelect = vi.fn();
  const onDismiss = vi.fn();
  const ref = createRef<SlashMenuHandle>();
  const view = render(
    <SlashMenu
      ref={ref}
      commands={commands}
      query={query}
      onSelect={onSelect}
      onDismiss={onDismiss}
    />,
  );
  const press = (key: string) => {
    const event = { key, preventDefault: vi.fn() };
    let handled = false;
    // The handle updates state, so it must run inside act().
    act(() => {
      handled = ref.current?.handleKeyDown(
        event as unknown as KeyboardEvent<HTMLElement>,
      ) as boolean;
    });
    return { handled, event };
  };
  return { onSelect, onDismiss, press, ...view };
}

const options = () => screen.getAllByTestId("relay-slash-option");
const menu = () => screen.getByTestId("relay-slash-menu");
const activeId = () => menu().getAttribute("aria-activedescendant");

describe("SlashMenu", () => {
  it("renders a labelled listbox with one option per command", () => {
    setup();
    expect(menu()).toHaveAttribute("role", "listbox");
    expect(menu()).toHaveAccessibleName("slash.label");
    expect(options()).toHaveLength(15);
    expect(screen.getAllByTestId("relay-slash-group")).toHaveLength(6);
    expect(options()[0]).toHaveTextContent("/explain");
    expect(options()[0]).toHaveTextContent("slash.explain.description");
    expect(options()[0]).toHaveAccessibleName("/explain slash.explain.description");
  });

  it("points aria-activedescendant at the first option and marks it selected", () => {
    setup();
    expect(activeId()).toBe(options()[0].id);
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
    expect(
      options().filter((o) => o.getAttribute("aria-selected") === "true").length,
    ).toBe(1);
  });

  it("gives every option a distinct id", () => {
    setup();
    expect(new Set(options().map((o) => o.id)).size).toBe(15);
  });

  it("ArrowDown moves down and wraps to the top", () => {
    const { press } = setup();
    const down = press("ArrowDown");
    expect(down.handled).toBe(true);
    expect(down.event.preventDefault).toHaveBeenCalled();
    expect(activeId()).toBe(options()[1].id);
    for (let i = 0; i < options().length - 1; i++) press("ArrowDown");
    expect(activeId()).toBe(options()[0].id);
  });

  it("ArrowUp wraps from the top to the last option and moves up", () => {
    const { press } = setup();
    press("ArrowUp");
    expect(activeId()).toBe(options().at(-1)?.id);
    press("ArrowUp");
    expect(activeId()).toBe(options().at(-2)?.id);
  });

  it("Enter selects the highlighted command", () => {
    const { press, onSelect } = setup();
    press("ArrowDown");
    const result = press("Enter");
    expect(result.handled).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(SLASH_COMMANDS[1]); // summarize
  });

  it("Tab also selects the highlighted command", () => {
    const { press, onSelect } = setup();
    press("Tab");
    expect(onSelect).toHaveBeenCalledWith(SLASH_COMMANDS[0]);
  });

  it("Escape dismisses without selecting", () => {
    const { press, onSelect, onDismiss } = setup();
    const result = press("Escape");
    expect(result.handled).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("leaves other keys alone", () => {
    const { press, onSelect, onDismiss } = setup();
    const result = press("a");
    expect(result.handled).toBe(false);
    expect(result.event.preventDefault).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("moving the pointer over an option highlights it", () => {
    setup();
    fireEvent.pointerMove(options()[3]);
    expect(activeId()).toBe(options()[3].id);
    expect(options()[3]).toHaveAttribute("aria-selected", "true");
  });

  it("clicking an option selects it", () => {
    const { onSelect } = setup();
    fireEvent.click(
      options().find((o) => o.getAttribute("data-command") === "curl")!,
    );
    expect(onSelect).toHaveBeenCalledWith(
      SLASH_COMMANDS.find((c) => c.id === "curl"),
    );
  });

  it("keeps the caret in the textarea by cancelling mousedown", () => {
    setup();
    const notCancelled = fireEvent.mouseDown(options()[0]);
    expect(notCancelled).toBe(false);
  });

  it("returns to the first row when the query changes", () => {
    const { press, rerender, onSelect, onDismiss } = setup();
    press("ArrowDown");
    press("ArrowDown");
    expect(activeId()).toBe(options()[2].id);
    rerender(
      <SlashMenu
        commands={SLASH_COMMANDS}
        query="c"
        onSelect={onSelect}
        onDismiss={onDismiss}
      />,
    );
    expect(activeId()).toBe(options()[0].id);
  });

  it("clamps the highlight when the list shrinks", () => {
    const { press, rerender, onSelect, onDismiss } = setup();
    press("ArrowUp");
    expect(activeId()).toBe(options().at(-1)?.id);
    rerender(
      <SlashMenu
        commands={SLASH_COMMANDS.slice(0, 2)}
        query="e"
        onSelect={onSelect}
        onDismiss={onDismiss}
      />,
    );
    expect(options()).toHaveLength(2);
    expect(activeId()).toBe(options()[0].id);
  });

  it("has no active descendant when there are no commands", () => {
    setup([]);
    expect(menu()).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryAllByTestId("relay-slash-option")).toHaveLength(0);
  });

  it("does not handle keyboard input when the command list is empty", () => {
    const { press } = setup([]);
    const result = press("ArrowDown");
    expect(result.handled).toBe(false);
    expect(result.event.preventDefault).not.toHaveBeenCalled();
  });

  it("swallows keydown on an option without side effects", () => {
    const { onSelect } = setup();
    fireEvent.keyDown(options()[0], { key: "Enter" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("wraps from the last option back to the first on ArrowDown", () => {
    const { press } = setup();
    const count = options().length;
    for (let i = 0; i < count; i++) press("ArrowDown");
    expect(activeId()).toBe(options()[0].id);
  });

  it("renders groups in SLASH_GROUP_ORDER with stable command order inside each group", () => {
    setup();
    const groups = screen.getAllByTestId("relay-slash-group");
    expect(groups.map((g) => g.getAttribute("data-group"))).toEqual([
      ...SLASH_GROUP_ORDER,
    ]);
    const flatFromDom = options().map((o) => o.getAttribute("data-command"));
    const flatFromCatalog = SLASH_COMMANDS.map((c) => c.id);
    expect(flatFromDom).toEqual(flatFromCatalog);
  });

  it("omits groups that have no commands after filtering", () => {
    const onlyRun = SLASH_COMMANDS.filter((c) => c.id === "run");
    setup(onlyRun);
    const groups = screen.getAllByTestId("relay-slash-group");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute("data-group", "run");
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveAttribute("data-command", "run");
  });

  it("renders a group header label for each visible group", () => {
    setup();
    for (const group of SLASH_GROUP_ORDER) {
      expect(
        screen.getByRole("group", { name: `slash.group.${group}` }),
      ).toBeInTheDocument();
    }
  });
});
