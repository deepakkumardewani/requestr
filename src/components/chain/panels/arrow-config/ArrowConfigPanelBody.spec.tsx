/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui/sheet";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { EnvironmentModel, RequestModel, ResponseData } from "@/types";
import type { ChainEdge } from "@/types/chain";
import {
  ArrowConfigPanelBody,
  type ArrowConfigPanelBodyProps,
} from "./ArrowConfigPanelBody";

const source = { id: "src", name: "Login", method: "POST", url: "" } as RequestModel;
const target = {
  id: "tgt",
  name: "Profile",
  method: "GET",
  url: "https://api.test/me",
} as RequestModel;

const response: ResponseData = {
  status: 200,
  statusText: "OK",
  headers: {},
  body: JSON.stringify({ token: "abc" }),
  duration: 1,
  size: 1,
  url: "",
  method: "POST",
  timestamp: 0,
};

const existingEdge: ChainEdge = {
  id: "edge-1",
  sourceRequestId: "src",
  targetRequestId: "tgt",
  injections: [
    { sourceJsonPath: "$.id", targetField: "header", targetKey: "X-Id" },
  ],
  branchId: "success",
};

function setup(overrides: Partial<ArrowConfigPanelBodyProps> = {}) {
  const props: ArrowConfigPanelBodyProps = {
    onClose: vi.fn(),
    sourceRequest: source,
    targetRequest: target,
    existingEdge: null,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onViewResponse: vi.fn(),
    ...overrides,
  };
  render(
    <Sheet open>
      <ArrowConfigPanelBody {...props} />
    </Sheet>,
  );
  return props;
}

/** The editor body has its own run button; the panel footer's is the last one. */
function runSourceButton(label = "Run Source API"): HTMLElement {
  return screen.getAllByText(label).at(-1) as HTMLElement;
}

describe("ArrowConfigPanelBody", () => {
  beforeEach(() => {
    useEnvironmentsStore.setState({ environments: [] });
  });
  afterEach(cleanup);

  describe("header and footer", () => {
    it("shows source and target request names in the header", () => {
      setup();

      expect(screen.getByText("Configure Dependency")).toBeInTheDocument();
      // The editor repeats the names further down; the header badges come first.
      expect(screen.getAllByText("Login")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Profile")[0]).toBeInTheDocument();
    });

    it("falls back to generic labels when endpoints are not API requests", () => {
      setup({ sourceRequest: null, targetRequest: null });

      expect(screen.getByText("Source")).toBeInTheDocument();
      expect(screen.getByText("Target")).toBeInTheDocument();
    });

    it("hides Delete Config for a brand-new edge", () => {
      setup();

      expect(screen.queryByText("Delete Config")).not.toBeInTheDocument();
    });

    it("closes without saving when Cancel is clicked", async () => {
      const props = setup();

      await userEvent.click(screen.getByText("Cancel"));

      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(props.onSave).not.toHaveBeenCalled();
    });

    it("disables View Response until a response exists", () => {
      setup();

      expect(screen.getByText("View Response").closest("button")).toBeDisabled();
    });

    it("opens the response view when a response exists", async () => {
      const props = setup({ sourceResponse: response });

      await userEvent.click(screen.getByText("View Response"));

      expect(props.onViewResponse).toHaveBeenCalledTimes(1);
    });

    it("runs the source request and switches to the response view", async () => {
      const onRunSource = vi.fn();
      const props = setup({ onRunSource });

      await userEvent.click(runSourceButton());

      expect(onRunSource).toHaveBeenCalledWith("src");
      expect(props.onViewResponse).toHaveBeenCalledTimes(1);
    });

    it("disables the run button and shows progress while the source is running", () => {
      setup({ sourceRunState: "running" });

      expect(runSourceButton("Running...").closest("button")).toBeDisabled();
    });

    it("disables the run button when there is no source API request", () => {
      setup({ sourceRequest: null });

      expect(runSourceButton().closest("button")).toBeDisabled();
    });
  });

  describe("saving an edge", () => {
    it("saves an untouched starter injection as an empty injection list and closes", async () => {
      const props = setup();

      await userEvent.click(screen.getByText("Save"));

      expect(props.onSave).toHaveBeenCalledTimes(1);
      const saved = vi.mocked(props.onSave).mock.calls[0][0];
      expect(saved).toMatchObject({
        sourceRequestId: "src",
        targetRequestId: "tgt",
        injections: [],
      });
      expect(saved.id).toBeTruthy();
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("preserves the existing edge id and its injections on save", async () => {
      const props = setup({ existingEdge });

      await userEvent.click(screen.getByText("Save"));

      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "edge-1",
          branchId: "success",
          injections: [
            { sourceJsonPath: "$.id", targetField: "header", targetKey: "X-Id" },
          ],
        }),
      );
    });

    it("saves an edited target key trimmed", async () => {
      const props = setup({ existingEdge });
      const keyInput = screen.getByDisplayValue("X-Id");

      await userEvent.clear(keyInput);
      await userEvent.type(keyInput, "  X-Token  ");
      await userEvent.click(screen.getByText("Save"));

      const saved = vi.mocked(props.onSave).mock.calls[0][0];
      expect(saved.injections[0]?.targetKey).toBe("X-Token");
    });

    it("keeps endpoint ids from the existing edge when the endpoints are not API requests", async () => {
      const props = setup({
        existingEdge,
        sourceRequest: null,
        targetRequest: null,
      });

      await userEvent.click(screen.getByText("Save"));

      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceRequestId: "src",
          targetRequestId: "tgt",
        }),
      );
    });

    it("disables Save and does not save while the draft is invalid", async () => {
      const props = setup({ existingEdge });

      const keyInput = screen.getByDisplayValue("X-Id");
      await userEvent.clear(keyInput);
      await userEvent.type(keyInput, "collect.foo");

      const save = screen.getByText("Save").closest("button");
      expect(save).toBeDisabled();
      await userEvent.click(save as HTMLElement);
      expect(props.onSave).not.toHaveBeenCalled();
    });
  });

  describe("branch handle selection", () => {
    it("reflects the existing edge branch as pressed", () => {
      setup({ existingEdge });

      expect(screen.getByTestId("arrow-config-handle-success")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("arrow-config-handle-fail")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("saves the newly selected Fail branch", async () => {
      const props = setup({ existingEdge });

      await userEvent.click(screen.getByTestId("arrow-config-handle-fail"));
      await userEvent.click(screen.getByText("Save"));

      expect(props.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: "fail" }),
      );
    });

    it("omits branchId when no handle was chosen", async () => {
      const props = setup();

      await userEvent.click(screen.getByText("Save"));

      expect(vi.mocked(props.onSave).mock.calls[0][0]).not.toHaveProperty(
        "branchId",
      );
    });
  });

  describe("deleting", () => {
    it("deletes the existing edge and closes", async () => {
      const props = setup({ existingEdge });

      await userEvent.click(screen.getByText("Delete Config"));

      expect(props.onDelete).toHaveBeenCalledWith("edge-1");
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("env promotion badge", () => {
    const env = { id: "env-1", name: "Staging" } as EnvironmentModel;

    it("shows the badge with the environment name for a promoted edge", () => {
      useEnvironmentsStore.setState({ environments: [env] });
      setup({
        existingEdge,
        envPromotions: [
          { edgeId: "edge-1", envId: "env-1", envVarName: "TOKEN" },
        ],
      });

      expect(screen.getByText("→ ENV")).toHaveAttribute(
        "title",
        "Extracted value will be written to TOKEN in Staging",
      );
    });

    it("does not show the badge for a promotion that belongs to another edge", () => {
      useEnvironmentsStore.setState({ environments: [env] });
      setup({
        existingEdge,
        envPromotions: [
          { edgeId: "other", envId: "env-1", envVarName: "TOKEN" },
        ],
      });

      expect(screen.queryByText("→ ENV")).not.toBeInTheDocument();
    });
  });

  describe("display node mode", () => {
    const displayNode = {
      id: "disp-1",
      type: "display" as const,
      sourceJsonPath: "$.name",
      targetField: "header" as const,
      targetKey: "X-Name",
    };

    it("hides the branch selector and shows Delete Config for an existing display node", () => {
      setup({ displayNodeId: "disp-1", existingDisplayNode: displayNode });

      expect(
        screen.queryByTestId("arrow-config-handle-success"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Delete Config")).toBeInTheDocument();
    });

    it("saves the display node with trimmed fields and closes", async () => {
      const onSaveDisplayNode = vi.fn();
      const props = setup({
        displayNodeId: "disp-1",
        existingDisplayNode: displayNode,
        onSaveDisplayNode,
      });

      await userEvent.click(screen.getByText("Save"));

      expect(onSaveDisplayNode).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "disp-1",
          type: "display",
          sourceJsonPath: "$.name",
          targetKey: "X-Name",
        }),
      );
      expect(props.onSave).not.toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("deletes the display node, not an edge", async () => {
      const onDeleteDisplayNode = vi.fn();
      const props = setup({
        displayNodeId: "disp-1",
        existingDisplayNode: displayNode,
        existingEdge,
        onDeleteDisplayNode,
      });

      await userEvent.click(screen.getByText("Delete Config"));

      expect(onDeleteDisplayNode).toHaveBeenCalledWith("disp-1");
      expect(props.onDelete).not.toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
