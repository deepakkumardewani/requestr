/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JsonPathExplorer } from "./JsonPathExplorer";

function createDataTransfer(jsonPath: string) {
  const store = new Map<string, string>();
  store.set("application/json", JSON.stringify({ jsonPath }));
  return {
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? "",
    dropEffect: "none",
    effectAllowed: "uninitialized",
  } as unknown as DataTransfer;
}

function DropZoneHarness({
  onDrop,
}: {
  onDrop: (path: string) => void;
}) {
  const dropZoneRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={dropZoneRef} aria-label="target-key" />
      <JsonPathExplorer
        data={{ user: { id: 99 }, data: { token: "abc" } }}
        onSelect={vi.fn()}
        onDrop={onDrop}
        dropZoneRef={dropZoneRef}
      />
    </div>
  );
}

describe("JsonPathExplorer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("calls onSelect with JSONPath when a primitive leaf is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <JsonPathExplorer
        data={{ user: { id: 99 }, token: "abc" }}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/token:/)).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/token:/));

    expect(onSelect).toHaveBeenCalledWith("$.token");
  });

  it("calls onSelect when the 'Use' button is clicked on a leaf", async () => {
    const onSelect = vi.fn();
    render(
      <JsonPathExplorer
        data={{ user: { id: 99 }, token: "abc" }}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/token:/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Use $.token" }));

    expect(onSelect).toHaveBeenCalledWith("$.token");
  });

  it("sets drag data with the JSONPath on drag start", async () => {
    render(
      <JsonPathExplorer
        data={{ user: { id: 99 }, token: "abc" }}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/token:/)).toBeTruthy();
    });

    const leaf = screen.getByText(/token:/).closest("div") as HTMLElement;
    const dataTransfer = createDataTransfer("");
    fireEvent.dragStart(leaf, { dataTransfer });

    expect(dataTransfer.getData("application/json")).toBe(
      JSON.stringify({ jsonPath: "$.token" }),
    );
  });

  it("emits onDrop with the dragged JSONPath when dropped on dropZoneRef", async () => {
    const onDrop = vi.fn();
    render(<DropZoneHarness onDrop={onDrop} />);

    await waitFor(() => {
      expect(screen.getByText(/token:/)).toBeTruthy();
    });

    const dropZone = screen.getByLabelText("target-key");
    const dataTransfer = createDataTransfer("$.data.token");
    fireEvent.drop(dropZone, { dataTransfer });

    expect(onDrop).toHaveBeenCalledWith("$.data.token");
  });

  it("shows empty message for an empty object", () => {
    const { container } = render(
      <JsonPathExplorer data={{}} onSelect={vi.fn()} />,
    );
    expect(container.textContent).toMatch(/empty/i);
  });
});
