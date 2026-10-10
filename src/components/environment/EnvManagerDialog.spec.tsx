/** @vitest-environment happy-dom */

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { EnvironmentModel, EnvVariable } from "@/types";
import { EnvManagerDialog } from "./EnvManagerDialog";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function resetStores() {
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useUIStore.setState({
    envManagerOpen: false,
    envManagerFocusEnvId: null,
  });
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

// The dialog dismisses via a document-level keydown listener, so the rename
// input must stop the native event from bubbling that far. happy-dom detaches
// the unmounted input's propagation path, so assert on stopPropagation directly.
function pressEscapeAndTrackPropagation(input: HTMLElement) {
  const event = createEvent.keyDown(input, { key: "Escape" });
  const stopPropagation = vi.spyOn(event, "stopPropagation");
  fireEvent(input, event);
  return stopPropagation;
}

describe("EnvManagerDialog", () => {
  it("renders dialog with environment list and variable table when envs exist", async () => {
    const variables: EnvVariable[] = [
      {
        id: "v1",
        key: "BASE_URL",
        initialValue: "https://a",
        currentValue: "https://b",
        isSecret: false,
      },
    ];
    const env: EnvironmentModel = {
      id: "e1",
      name: "Local",
      variables,
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({
      environments: [env],
      activeEnvId: "e1",
    });
    useUIStore.setState({ envManagerOpen: true });

    render(<EnvManagerDialog />);

    expect(screen.getByTestId("env-manager-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("env-list-item-Local")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByTestId("var-key-input").length).toBeGreaterThan(0);
    });
    expect(screen.getByDisplayValue("BASE_URL")).toBeInTheDocument();
    expect(screen.getAllByText(/\{\{VARIABLE_NAME\}\}/).length).toBeGreaterThan(
      0,
    );
  });

  it("shows empty state when there are no environments", () => {
    useUIStore.setState({ envManagerOpen: true });

    render(<EnvManagerDialog />);

    expect(
      screen.getByText(/add an environment to get started/i),
    ).toBeInTheDocument();
  });

  it("edits env name inline in header", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e-h",
          name: "HeaderName",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "e-h",
    });
    useUIStore.setState({ envManagerOpen: true });

    render(<EnvManagerDialog />);

    await user.click(screen.getByTestId("env-name-display"));

    const input = screen.getByTestId("env-name-input");
    fireEvent.change(input, { target: { value: "Renamed Header" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(useEnvironmentsStore.getState().environments[0].name).toBe(
        "Renamed Header",
      );
    });
  });

  function seedTwoEnvs() {
    const env = (id: string, name: string): EnvironmentModel => ({
      id,
      name,
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    });
    useEnvironmentsStore.setState({
      environments: [env("e-a", "Alpha"), env("e-b", "Beta")],
      activeEnvId: "e-a",
    });
    useUIStore.setState({ envManagerOpen: true, envManagerFocusEnvId: "e-a" });
  }

  it("header rename to another environment's name shows inline error and does not save", async () => {
    const user = userEvent.setup();
    seedTwoEnvs();
    render(<EnvManagerDialog />);

    await user.click(screen.getByTestId("env-name-display"));
    const input = screen.getByTestId("env-name-input");
    fireEvent.change(input, { target: { value: " beta " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("env-header-name-error")).toBeInTheDocument();
    expect(screen.getByTestId("env-name-input")).toBeInTheDocument();
    expect(
      useEnvironmentsStore.getState().environments.map((e) => e.name),
    ).toEqual(["Alpha", "Beta"]);
  });

  it("header rename to its own name (different case) is allowed", async () => {
    const user = userEvent.setup();
    seedTwoEnvs();
    render(<EnvManagerDialog />);

    await user.click(screen.getByTestId("env-name-display"));
    const input = screen.getByTestId("env-name-input");
    fireEvent.change(input, { target: { value: "ALPHA" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.queryByTestId("env-header-name-error")).toBeNull();
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("ALPHA");
  });

  it("header error clears as soon as the user edits the name", async () => {
    const user = userEvent.setup();
    seedTwoEnvs();
    render(<EnvManagerDialog />);

    await user.click(screen.getByTestId("env-name-display"));
    const input = screen.getByTestId("env-name-input");
    fireEvent.change(input, { target: { value: "Beta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("env-header-name-error")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Gamma" } });
    expect(screen.queryByTestId("env-header-name-error")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("Gamma");
  });

  it("header rename to blank falls back to the default name", async () => {
    const user = userEvent.setup();
    seedTwoEnvs();
    render(<EnvManagerDialog />);

    await user.click(screen.getByTestId("env-name-display"));
    const input = screen.getByTestId("env-name-input");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(useEnvironmentsStore.getState().environments[0].name).toBe(
      "New Environment",
    );
    expect(screen.queryByTestId("env-header-name-error")).toBeNull();
  });

  it("header Escape discards the draft without saving it", async () => {
    const user = userEvent.setup();
    seedTwoEnvs();
    render(<EnvManagerDialog />);

    await user.click(screen.getByTestId("env-name-display"));
    const input = screen.getByTestId("env-name-input");
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(useEnvironmentsStore.getState().environments[0].name).toBe("Alpha");
  });

  describe("closing", () => {
    it("closes when the X button is clicked", async () => {
      const user = userEvent.setup();
      seedTwoEnvs();
      render(<EnvManagerDialog />);

      await user.click(screen.getByRole("button", { name: /close/i }));

      expect(useUIStore.getState().envManagerOpen).toBe(false);
    });

    it("closes when Escape is pressed", async () => {
      const user = userEvent.setup();
      seedTwoEnvs();
      render(<EnvManagerDialog />);

      await user.keyboard("{Escape}");

      expect(useUIStore.getState().envManagerOpen).toBe(false);
    });

    it("Escape in the header rename input cancels the rename and keeps the dialog open", async () => {
      const user = userEvent.setup();
      seedTwoEnvs();
      render(<EnvManagerDialog />);

      await user.click(screen.getByTestId("env-name-display"));
      const input = screen.getByTestId("env-name-input");
      fireEvent.change(input, { target: { value: "Discarded" } });
      const stopPropagation = pressEscapeAndTrackPropagation(input);

      expect(stopPropagation).toHaveBeenCalled();
      expect(screen.queryByTestId("env-name-input")).toBeNull();
      expect(useEnvironmentsStore.getState().environments[0].name).toBe(
        "Alpha",
      );
      expect(useUIStore.getState().envManagerOpen).toBe(true);
    });

    it("Escape in the list rename input cancels the rename and keeps the dialog open", async () => {
      const user = userEvent.setup();
      seedTwoEnvs();
      render(<EnvManagerDialog />);

      const row = screen.getByTestId("env-list-item-Alpha");
      await user.click(within(row).getByTestId("env-item-more-btn"));
      await user.click(screen.getByTestId("env-item-rename-btn"));
      const input = await screen.findByTestId("env-item-rename-input");
      fireEvent.change(input, { target: { value: "Discarded" } });
      const stopPropagation = pressEscapeAndTrackPropagation(input);

      expect(stopPropagation).toHaveBeenCalled();
      expect(screen.queryByTestId("env-item-rename-input")).toBeNull();
      expect(useEnvironmentsStore.getState().environments[0].name).toBe(
        "Alpha",
      );
      expect(useUIStore.getState().envManagerOpen).toBe(true);
    });

    it("renders nothing when envManagerOpen is false", () => {
      useUIStore.setState({ envManagerOpen: false });
      render(<EnvManagerDialog />);

      expect(screen.queryByTestId("env-manager-dialog")).toBeNull();
    });
  });

  describe("selection", () => {
    it("selects the focus env passed through the UI store when opened", () => {
      seedTwoEnvs();
      useUIStore.setState({ envManagerFocusEnvId: "e-b" });
      render(<EnvManagerDialog />);

      expect(screen.getByTestId("env-name-display")).toHaveTextContent("Beta");
    });

    it("moves selection to the remaining env when the selected active env is deleted", async () => {
      const user = userEvent.setup();
      seedTwoEnvs();
      render(<EnvManagerDialog />);
      expect(screen.getByTestId("env-name-display")).toHaveTextContent("Alpha");

      const row = screen.getByTestId("env-list-item-Alpha");
      await user.click(within(row).getByTestId("env-item-more-btn"));
      await user.click(screen.getByTestId("env-item-delete-btn"));
      await user.click(
        await screen.findByRole("button", { name: /yes, delete environment/i }),
      );

      await waitFor(() => {
        expect(screen.getByTestId("env-name-display")).toHaveTextContent(
          "Beta",
        );
      });
      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.id),
      ).toEqual(["e-b"]);
    });

    it("shows the empty state when the last environment is deleted", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({
        environments: [
          { id: "solo", name: "Solo", variables: [], createdAt: 1, updatedAt: 1 },
        ],
        activeEnvId: "solo",
      });
      useUIStore.setState({ envManagerOpen: true, envManagerFocusEnvId: "solo" });
      render(<EnvManagerDialog />);

      const row = screen.getByTestId("env-list-item-Solo");
      await user.click(within(row).getByTestId("env-item-more-btn"));
      await user.click(screen.getByTestId("env-item-delete-btn"));
      await user.click(
        await screen.findByRole("button", { name: /yes, delete environment/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/add an environment to get started/i),
        ).toBeInTheDocument();
      });
      expect(screen.queryByTestId("env-name-display")).toBeNull();
    });
  });
});
