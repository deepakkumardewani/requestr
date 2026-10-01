/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS } from "@/app/settings/constants";
import { ShortcutRow } from "./ShortcutRow";

afterEach(cleanup);

const shortcut = SHORTCUT_GROUPS[0].shortcuts[0];

describe("ShortcutRow", () => {
  it("renders the provided label, not the shortcut's raw action", () => {
    render(<ShortcutRow shortcut={shortcut} onMac={false} label="Custom label" />);
    expect(screen.getByText("Custom label")).toBeInTheDocument();
  });

  it("renders the key caps for the shortcut", () => {
    const { container } = render(
      <ShortcutRow shortcut={shortcut} onMac={false} label="x" />,
    );
    expect(container.querySelectorAll("kbd").length).toBeGreaterThan(0);
  });
});
