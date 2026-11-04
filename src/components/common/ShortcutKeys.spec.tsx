/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Shortcut } from "@/app/settings/constants";
import { ShortcutKeys } from "./ShortcutKeys";

afterEach(cleanup);

const base: Shortcut = { actionKey: "x", key: "K", shift: true };

function caps(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("kbd")).map(
    (k) => k.textContent ?? "",
  );
}

describe("ShortcutKeys", () => {
  it("renders the primary chord with the command symbol on Mac", () => {
    const { container } = render(<ShortcutKeys shortcut={base} onMac />);
    expect(caps(container)).toEqual(["⌘", "Shift", "K"]);
  });

  it("renders Ctrl off Mac, and Ctrl on Mac for ctrlOnly bindings", () => {
    const { container, rerender } = render(
      <ShortcutKeys shortcut={base} onMac={false} />,
    );
    expect(caps(container)).toEqual(["Ctrl", "Shift", "K"]);

    rerender(
      <ShortcutKeys shortcut={{ actionKey: "t", key: "T", ctrlOnly: true }} onMac />,
    );
    expect(caps(container)).toEqual(["Ctrl", "T"]);
  });

  it("renders no separator when there are no aliases", () => {
    const { container } = render(<ShortcutKeys shortcut={base} onMac={false} />);
    expect(container.textContent).not.toContain("/");
  });

  it("follows the primary chord with each alias after a slash separator", () => {
    const shortcut: Shortcut = {
      actionKey: "del",
      key: "Delete",
      noModifier: true,
      aliases: [{ key: "Backspace", noModifier: true }, { key: "D" }],
    };
    const { container } = render(<ShortcutKeys shortcut={shortcut} onMac />);

    expect(caps(container)).toEqual(["Delete", "Backspace", "⌘", "D"]);
    expect(container.textContent?.match(/\//g)).toHaveLength(2);
  });
});
