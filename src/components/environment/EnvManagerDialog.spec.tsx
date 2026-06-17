/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
});
