/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainBlock, ChainEdge, EvaluateBlock } from "@/types/chain";

const runInWorkerMock = vi.fn();
vi.mock("@/lib/chainEvalHost", () => ({
  runInWorker: (...args: unknown[]) => runInWorkerMock(...args),
}));

vi.mock("@/components/request/CodeEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (v: string) => void;
  }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

import { isReservedAlias } from "@/lib/chainValueNamespace";
import { EvaluateConfigPanel } from "./EvaluateConfigPanel";

function buildNode(overrides: Partial<EvaluateBlock> = {}): EvaluateBlock {
  return {
    id: "eval-1",
    type: "evaluate",
    code: "return data.response.token",
    outputAlias: "token",
    ...overrides,
  };
}

describe("isReservedAlias", () => {
  it("flags collect. and sub. prefixes as reserved", () => {
    expect(isReservedAlias("collect.foo")).toBe(true);
    expect(isReservedAlias("sub.bar")).toBe(true);
    expect(isReservedAlias("token")).toBe(false);
  });
});

describe("EvaluateConfigPanel", () => {
  afterEach(() => {
    cleanup();
    runInWorkerMock.mockReset();
  });

  it.each([
    ["an Evaluate block", { id: "e2", type: "evaluate", code: "", outputAlias: "token" }],
    ["a Display block", { id: "d1", type: "display", targetKey: "token" }],
    ["a Loop itemAlias", { id: "l1", type: "loop", itemAlias: "token" }],
    ["a Start input", { id: "s1", type: "start", inputs: [{ key: "token" }] }],
  ])("blocks Save when the alias is already published by %s", async (_l, other) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
        chainBlocks={[buildNode(), other] as unknown as ChainBlock[]}
      />,
    );
    expect(screen.getByText(/already publishes "token"/)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks Save when an edge injection already publishes the alias", () => {
    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        chainBlocks={[buildNode()]}
        chainEdges={[
          {
            id: "edge-1",
            sourceRequestId: "a",
            targetRequestId: "eval-1",
            injections: [{ targetKey: "token" }],
          },
        ] as unknown as ChainEdge[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("allows Save when only the node's own saved alias matches", () => {
    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        chainBlocks={[buildNode()]}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("renders nothing when node is null", () => {
    const { container } = render(
      <EvaluateConfigPanel
        open={false}
        node={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("saves the edited alias and code", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    const aliasInput = screen.getByPlaceholderText("e.g. token");
    await user.clear(aliasInput);
    await user.type(aliasInput, "renamedToken");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ outputAlias: "renamedToken" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("disables Save and shows a warning for a reserved alias prefix", async () => {
    const user = userEvent.setup();
    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const aliasInput = screen.getByPlaceholderText("e.g. token");
    await user.clear(aliasInput);
    await user.type(aliasInput, "collect.foo");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText(/reserved/i)).toBeInTheDocument();
  });

  it("runs Test with last run and shows the output", async () => {
    const user = userEvent.setup();
    runInWorkerMock.mockResolvedValue({ output: "abc123" });

    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        testInput={{
          data: { response: { token: "abc123" } },
          inputs: { userId: "42" },
          env: { host: "example.com" },
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /test with last run/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("evaluate-test-output")).toHaveTextContent(
        '"abc123"',
      );
    });
    expect(runInWorkerMock).toHaveBeenCalledWith({
      code: "return data.response.token",
      data: { response: { token: "abc123" } },
      inputs: { userId: "42" },
      env: { host: "example.com" },
    });
  });

  it("shows the error when Test with last run fails", async () => {
    const user = userEvent.setup();
    runInWorkerMock.mockResolvedValue({ error: "boom" });

    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /test with last run/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("evaluate-test-error")).toHaveTextContent(
        "boom",
      );
    });
  });

  it("deletes the node", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      <EvaluateConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete node/i }));

    expect(onDelete).toHaveBeenCalledWith("eval-1");
    expect(onClose).toHaveBeenCalled();
  });
});
