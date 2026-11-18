/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Braces } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigPanelShell } from "./ConfigPanelShell";

function renderShell(
  props: Partial<Parameters<typeof ConfigPanelShell>[0]> = {},
) {
  const handlers = {
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <ConfigPanelShell
      open
      title="Configure Thing"
      icon={Braces}
      {...handlers}
      {...props}
    >
      <p>panel body</p>
    </ConfigPanelShell>,
  );
  return { ...handlers, ...props };
}

describe("ConfigPanelShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title and children", () => {
    renderShell();
    expect(screen.getByText("Configure Thing")).toBeInTheDocument();
    expect(screen.getByText("panel body")).toBeInTheDocument();
  });

  it("saves then closes", async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderShell();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Save when canSave is false", async () => {
    const user = userEvent.setup();
    const { onSave } = renderShell({ canSave: false });
    const save = screen.getByRole("button", { name: "Save" });

    expect(save).toBeDisabled();
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels without saving", async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderShell();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("deletes then closes", async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = renderShell();

    await user.click(screen.getByRole("button", { name: /Delete node/ }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    renderShell({ open: false });
    expect(screen.queryByText("panel body")).not.toBeInTheDocument();
  });
});
