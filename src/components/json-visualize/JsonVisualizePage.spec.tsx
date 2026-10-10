/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJsonVisualizeStore } from "@/stores/useJsonVisualizeStore";
import { JsonVisualizePage } from "./JsonVisualizePage";

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicMock(props: { value?: string; onChange?: (v: string) => void }) {
      if (props.value !== undefined) {
        return (
          <textarea
            data-testid="mock-json-editor"
            value={props.value}
            onChange={(e) => props.onChange?.(e.target.value)}
          />
        );
      }
      return <div data-testid="mock-jsoncrack">graph</div>;
    },
}));

vi.mock("jsoncrack-react/style.css", () => ({}));

afterEach(() => {
  cleanup();
  useJsonVisualizeStore.setState({ inputBody: "", format: "json" });
});

describe("JsonVisualizePage", () => {
  beforeEach(() => {
    useJsonVisualizeStore.setState({ inputBody: "", format: "json" });
  });

  it("renders the page title", () => {
    render(<JsonVisualizePage />);
    expect(screen.getByText("JSON Visualize")).toBeInTheDocument();
  });

  it("shows the empty-state hint before any visualization runs", () => {
    render(<JsonVisualizePage />);

    expect(
      screen.getByText(/Paste data on the left and click Visualize/),
    ).toBeInTheDocument();
  });

  it("loads the graph viewer after valid JSON is auto-visualized", async () => {
    useJsonVisualizeStore.setState({
      inputBody: '{"name":"Ada"}',
      format: "json",
    });
    render(<JsonVisualizePage />);

    await waitFor(() =>
      expect(screen.getByTestId("mock-jsoncrack")).toBeInTheDocument(),
    );
  });
});
