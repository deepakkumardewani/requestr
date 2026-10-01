/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConditionNodeConfig, ChainEdge } from "@/types/chain";
import { ConditionConfigPanel } from "./ConditionConfigPanel";

describe("ConditionConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns null when node is missing even if open", () => {
    const { container } = render(
      <ConditionConfigPanel
        open
        node={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("renders branch editor and variable field for a condition node", async () => {
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "{{role}}",
      branches: [
        { id: "b1", label: "admin", expression: "== 'admin'" },
        { id: "b2", label: "else", expression: "" },
      ],
    };

    render(
      <ConditionConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/configure condition/i)).toBeTruthy();
    });

    const variableInput = screen.getByDisplayValue("{{role}}");
    expect(variableInput).toBeTruthy();
    expect(screen.getByDisplayValue("admin")).toBeTruthy();
  });

  it("calls onSave with updated variable when Save is clicked", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "x",
      branches: [{ id: "b1", label: "a", expression: "== '1'" }],
    };

    render(
      <ConditionConfigPanel
        open
        node={node}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("x")).toBeTruthy();
    });

    fireEvent.change(screen.getByDisplayValue("x"), {
      target: { value: "{{newVar}}" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ variable: "{{newVar}}", id: "cond-1" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("adds a branch when Add branch is clicked", async () => {
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "",
      branches: [{ id: "b1", label: "only", expression: "== 'a'" }],
    };

    render(
      <ConditionConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add branch/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /add branch/i }));

    expect(screen.getAllByTitle("Delete branch").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("calls onDelete and onClose when Delete node is clicked", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "v",
      branches: [{ id: "b1", label: "a", expression: "" }],
    };

    render(
      <ConditionConfigPanel
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

    expect(onDelete).toHaveBeenCalledWith("cond-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("displays available variables from incoming edges", async () => {
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "",
      branches: [{ id: "b1", label: "a", expression: "" }],
    };

    const incomingEdges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "src1",
        targetRequestId: "tgt",
        injections: [
          {
            sourceJsonPath: "$.user.id",
            targetField: "header",
            targetKey: "userId",
          },
        ],
      },
      {
        id: "e2",
        sourceRequestId: "src2",
        targetRequestId: "tgt",
        injections: [
          {
            sourceJsonPath: "$.token",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
      },
    ];

    render(
      <ConditionConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        incomingEdges={incomingEdges}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/available variables/i)).toBeTruthy();
    });

    expect(screen.getByText("userId")).toBeTruthy();
    expect(screen.getByText("$.user.id")).toBeTruthy();
    expect(screen.getByText("Authorization")).toBeTruthy();
    expect(screen.getByText("$.token")).toBeTruthy();
  });

  it("detects and displays alias collisions", async () => {
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "",
      branches: [{ id: "b1", label: "a", expression: "" }],
    };

    const incomingEdges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "src1",
        targetRequestId: "tgt",
        injections: [
          {
            sourceJsonPath: "$.user.id",
            targetField: "header",
            targetKey: "Authorization",
          },
        ],
      },
      {
        id: "e2",
        sourceRequestId: "src2",
        targetRequestId: "tgt",
        injections: [
          {
            sourceJsonPath: "$.org.token",
            targetField: "header",
            targetKey: "Authorization", // Collision!
          },
        ],
      },
    ];

    render(
      <ConditionConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        incomingEdges={incomingEdges}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/alias collision detected/i)).toBeTruthy();
    });

    // Check for the collision warning - it should contain this text pattern
    const collisionWarning = screen.getByText((content) =>
      content.includes("written by 2 edges")
    );
    expect(collisionWarning).toBeTruthy();
  });

  it("allows clicking available variables to insert them", async () => {
    const node: ConditionNodeConfig = {
      id: "cond-1",
      type: "condition",
      variable: "",
      branches: [{ id: "b1", label: "a", expression: "" }],
    };

    const incomingEdges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "src1",
        targetRequestId: "tgt",
        injections: [
          {
            sourceJsonPath: "$.user.id",
            targetField: "header",
            targetKey: "userId",
          },
        ],
      },
    ];

    render(
      <ConditionConfigPanel
        open
        node={node}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        incomingEdges={incomingEdges}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("userId")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("userId"));

    const variableInput = screen.getByDisplayValue("{{e1:userId}}");
    expect(variableInput).toBeTruthy();
  });
});
