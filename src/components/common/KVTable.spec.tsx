/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KVPair } from "@/types";
import { KVTable } from "./KVTable";

const row = (id: string, key: string, value: string): KVPair => ({
  id,
  key,
  value,
  enabled: true,
});

afterEach(() => {
  cleanup();
});

describe("KVTable", () => {
  it("updates row key and notifies onChange", () => {
    const onChange = vi.fn();
    const rows = [row("r1", "a", "1")];

    render(<KVTable rows={rows} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("row-key-r1"), {
      target: { value: "Authorization" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { id: "r1", key: "Authorization", value: "1", enabled: true },
    ]);
  });

  it("deletes row when trash clicked", () => {
    const onChange = vi.fn();
    render(
      <KVTable
        rows={[row("a", "k", "v"), row("b", "k2", "v2")]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId("row-delete-a"));

    expect(onChange).toHaveBeenCalledWith([row("b", "k2", "v2")]);
  });

  it("adds row from draft inputs on value blur", () => {
    const onChange = vi.fn();

    render(<KVTable rows={[]} onChange={onChange} />);

    fireEvent.change(screen.getByTestId("draft-row-key"), {
      target: { value: "q" },
    });
    fireEvent.change(screen.getByTestId("draft-row-value"), {
      target: { value: "search" },
    });
    fireEvent.blur(screen.getByTestId("draft-row-value"));

    expect(onChange).toHaveBeenCalled();
    const added = onChange.mock.calls[0]![0]![0]!;
    expect(added).toMatchObject({ key: "q", value: "search", enabled: true });
  });

  it("scopes test ids with testIdPrefix, leaving unprefixed ids absent", () => {
    const onChange = vi.fn();

    render(
      <KVTable
        rows={[row("r1", "a", "1")]}
        onChange={onChange}
        testIdPrefix="headers"
      />,
    );

    expect(screen.getByTestId("headers-row-key-r1")).toBeInTheDocument();
    expect(screen.getByTestId("headers-draft-row-key")).toBeInTheDocument();
    expect(screen.getByTestId("headers-draft-row-value")).toBeInTheDocument();
    expect(screen.queryByTestId("row-key-r1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("draft-row-key")).not.toBeInTheDocument();
  });
});
