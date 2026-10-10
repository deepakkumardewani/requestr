/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartBlock } from "@/types/chain";
import { StartConfigPanel } from "./StartConfigPanel";

describe("StartConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when node is missing even if open", () => {
    const { container } = render(
      <StartConfigPanel
        open
        node={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders existing inputs", async () => {
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "abc", source: "literal" }],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/configure start/i)).toBeTruthy();
    });

    expect(screen.getByDisplayValue("token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
  });

  it("adds a new input row when Add input is clicked", async () => {
    const node: StartBlock = { id: "start-1", type: "start", inputs: [] };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add input/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /add input/i }));

    expect(screen.getByPlaceholderText("key (e.g. token)")).toBeInTheDocument();
  });

  it("renames an input's key", async () => {
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "old", defaultValue: "", source: "literal" }],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const keyInput = await screen.findByDisplayValue("old");
    fireEvent.change(keyInput, { target: { value: "renamed" } });

    expect(screen.getByDisplayValue("renamed")).toBeInTheDocument();
  });

  it("flags duplicate keys and disables Save", async () => {
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [
        { key: "token", defaultValue: "", source: "literal" },
        { key: "userId", defaultValue: "", source: "literal" },
      ],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const userIdInput = await screen.findByDisplayValue("userId");
    fireEvent.change(userIdInput, { target: { value: "token" } });

    expect(screen.getAllByText(/key must be unique/i).length).toBe(2);
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });

  it("sets a default value for a literal-source input", async () => {
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "", source: "literal" }],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const defaultValueInput = await screen.findByPlaceholderText(
      "Default value",
    );
    fireEvent.change(defaultValueInput, { target: { value: "hello" } });

    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("switches source to env and shows the env var key field", async () => {
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "", source: "literal" }],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /set source to env/i }),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /set source to env/i }));

    expect(
      screen.getByPlaceholderText("Environment variable key"),
    ).toBeInTheDocument();
  });

  it("calls onSave with edited inputs, stripped of the internal rowId, when Save is clicked", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "abc", source: "literal" }],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("token")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith({
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "abc", source: "literal" }],
    });
    // handleSave awaits onSave before closing, so onClose lands a tick later.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("calls onDelete and onClose when Delete node is clicked", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const node: StartBlock = { id: "start-1", type: "start", inputs: [] };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={onClose}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete node/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /delete node/i }));

    expect(onDelete).toHaveBeenCalledWith("start-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("deletes an input row", async () => {
    const node: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [{ key: "token", defaultValue: "", source: "literal" }],
    };

    render(
      <StartConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTitle("Delete input")).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle("Delete input"));

    expect(screen.queryByDisplayValue("token")).not.toBeInTheDocument();
  });
});
