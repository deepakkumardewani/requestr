/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { RequestModel } from "@/types";
import type { ChainBlock, ChainEdge } from "@/types/chain";
import { ArrowConfigPanel } from "./ArrowConfigPanel";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const COL = "c1";

function makeRequest(
  id: string,
  name: string,
  method: RequestModel["method"] = "GET",
): RequestModel {
  return {
    id,
    collectionId: COL,
    name,
    method,
    url: `https://api.test/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("ArrowConfigPanel", () => {
  beforeEach(() => {
    vi.mocked(getDB).mockReturnValue(null);
    useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders dependency labels for source and target when open", async () => {
    render(
      <ArrowConfigPanel
        open
        onClose={vi.fn()}
        sourceRequest={makeRequest("s1", "Source A")}
        targetRequest={makeRequest("t1", "Target B")}
        existingEdge={null}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Configure Dependency")).toBeTruthy();
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Source A");
    expect(dialog.textContent).toContain("Target B");
  });

  it("calls onSave with edge payload when Save is clicked and fields are valid", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const existingEdge: ChainEdge = {
      id: "edge-1",
      sourceRequestId: "s1",
      targetRequestId: "t1",
      injections: [
        {
          sourceJsonPath: "$.token",
          targetField: "header",
          targetKey: "Authorization",
        },
      ],
    };

    render(
      <ArrowConfigPanel
        open
        onClose={onClose}
        sourceRequest={makeRequest("s1", "Source")}
        targetRequest={makeRequest("t1", "Target")}
        existingEdge={existingEdge}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as ChainEdge;
    expect(saved.id).toBe("edge-1");
    expect(saved.injections[0]?.sourceJsonPath).toBe("$.token");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it.each(["else", "success", "fail"])(
    "preserves branchId '%s' when saving an edge",
    async (branchId) => {
      const onSave = vi.fn();
      const existingEdge: ChainEdge = {
        id: "edge-1",
        sourceRequestId: "s1",
        targetRequestId: "t1",
        branchId,
        injections: [
          {
            sourceJsonPath: "$.token",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
      };
      render(
        <ArrowConfigPanel
          open
          onClose={vi.fn()}
          sourceRequest={makeRequest("s1", "Source")}
          targetRequest={makeRequest("t1", "Target")}
          existingEdge={existingEdge}
          onSave={onSave}
          onDelete={vi.fn()}
        />,
      );
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
      });
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      expect((onSave.mock.calls[0][0] as ChainEdge).branchId).toBe(branchId);
    },
  );

  it("keeps Save disabled when a target key is blank", async () => {
    render(
      <ArrowConfigPanel
        open
        onClose={vi.fn()}
        sourceRequest={makeRequest("s1", "Source")}
        targetRequest={makeRequest("t1", "Target")}
        existingEdge={{
          id: "e1",
          sourceRequestId: "s1",
          targetRequestId: "t1",
          injections: [
            { sourceJsonPath: "$.a", targetField: "header", targetKey: "" },
          ],
        }}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      const save = screen.getByRole("button", { name: /^save$/i });
      expect(
        save.hasAttribute("disabled") || (save as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  it("calls onRunSource when Run Source API is clicked without a response body", async () => {
    const onRunSource = vi.fn();
    render(
      <ArrowConfigPanel
        open
        onClose={vi.fn()}
        sourceRequest={makeRequest("s1", "Source")}
        targetRequest={makeRequest("t1", "Target")}
        existingEdge={null}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onRunSource={onRunSource}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /run source api/i }).length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /run source api/i })[0],
    );
    expect(onRunSource).toHaveBeenCalledWith("s1");
  });

  it("calls onSaveDisplayNode in display-node mode", async () => {
    const onSaveDisplayNode = vi.fn();
    const onClose = vi.fn();

    render(
      <ArrowConfigPanel
        open
        onClose={onClose}
        sourceRequest={makeRequest("s1", "Source")}
        targetRequest={makeRequest("t1", "Target")}
        existingEdge={null}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        displayNodeId="disp-1"
        existingDisplayNode={{
          id: "disp-1",
          type: "display",
          sourceJsonPath: "$.x",
          targetField: "header",
          targetKey: "X-Token",
        }}
        onSaveDisplayNode={onSaveDisplayNode}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSaveDisplayNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "disp-1",
        type: "display",
        sourceJsonPath: "$.x",
        targetKey: "X-Token",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  describe("alias collisions for a new, unsaved edge", () => {
    function renderNewEdge(extra: {
      chainEdges?: ChainEdge[];
      chainBlocks?: ChainBlock[];
    }) {
      render(
        <ArrowConfigPanel
          open
          onClose={vi.fn()}
          sourceRequest={makeRequest("s1", "Source A")}
          targetRequest={makeRequest("t1", "Target B")}
          existingEdge={null}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          {...extra}
        />,
      );
    }

    // A new edge starts with the default `Authorization` injection.
    it("warns when it reuses an alias from an existing edge", async () => {
      renderNewEdge({
        chainEdges: [
          {
            id: "e-old",
            sourceRequestId: "a",
            targetRequestId: "b",
            injections: [
              {
                sourceJsonPath: "$.x",
                targetField: "header",
                targetKey: "Authorization",
              },
            ],
          },
        ],
      });
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Authorization");
      expect(alert.textContent).toMatch(/2 edges/);
    });

    it("warns when it reuses an Evaluate block's outputAlias", async () => {
      renderNewEdge({
        chainBlocks: [
          { id: "ev", type: "evaluate", code: "", outputAlias: "Authorization" },
        ],
      });
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/1 Evaluate block, 1 edge/);
    });

    it("does not warn when nothing collides", async () => {
      renderNewEdge({ chainEdges: [], chainBlocks: [] });
      await screen.findByText("Configure Dependency");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});

describe("ArrowConfigPanel reset on reopen", () => {
  const edge: ChainEdge = {
    id: "edge-1",
    sourceRequestId: "s1",
    targetRequestId: "t1",
    injections: [
      { sourceJsonPath: "$.token", targetField: "header", targetKey: "Auth" },
    ],
  };

  function renderPanel(open: boolean, existingEdge: ChainEdge = edge) {
    return (
      <ArrowConfigPanel
        open={open}
        onClose={vi.fn()}
        sourceRequest={makeRequest("s1", "Source")}
        targetRequest={makeRequest("t1", "Target")}
        existingEdge={existingEdge}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
  }

  afterEach(cleanup);

  it("discards unsaved edits when the panel is closed and reopened", async () => {
    const { rerender } = render(renderPanel(true));
    const input = (await screen.findByLabelText("Header name")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Edited" } });
    expect(input.value).toBe("Edited");

    rerender(renderPanel(false));
    rerender(renderPanel(true));

    const reopened = (await screen.findByLabelText("Header name")) as HTMLInputElement;
    expect(reopened.value).toBe("Auth");
  });

  it("re-seeds the draft when switched to a different edge while open", async () => {
    const { rerender } = render(renderPanel(true));
    const input = (await screen.findByLabelText("Header name")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Edited" } });

    const other: ChainEdge = {
      ...edge,
      id: "edge-2",
      injections: [
        { sourceJsonPath: "$.id", targetField: "header", targetKey: "Other" },
      ],
    };
    rerender(renderPanel(true, other));

    const next = (await screen.findByLabelText("Header name")) as HTMLInputElement;
    expect(next.value).toBe("Other");
  });
});
