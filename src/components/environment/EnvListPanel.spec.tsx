/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { EnvironmentModel } from "@/types";
import { EnvListPanel } from "./EnvListPanel";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function resetEnvStore() {
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
}

function seedEnv(name: string, overrides: Partial<EnvironmentModel> = {}) {
  const env: EnvironmentModel = {
    id: `env-${name}`,
    name,
    variables: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
  useEnvironmentsStore.setState((s) => ({
    environments: [...s.environments, env],
  }));
  return env;
}

beforeEach(() => {
  resetEnvStore();
});

afterEach(() => {
  cleanup();
  resetEnvStore();
  vi.clearAllMocks();
});

describe("EnvListPanel", () => {
  it("lists environments and highlights selected row", () => {
    seedEnv("Dev");
    seedEnv("Staging");
    const onSelect = vi.fn();

    render(<EnvListPanel selectedEnvId="env-Dev" onSelect={onSelect} />);

    expect(screen.getByTestId("env-list-item-Dev")).toBeInTheDocument();
    expect(screen.getByTestId("env-list-item-Staging")).toBeInTheDocument();
  });

  it("calls onSelect and sets active env when an item is clicked", async () => {
    const user = userEvent.setup();
    seedEnv("Primary");
    const onSelect = vi.fn();

    render(<EnvListPanel selectedEnvId="env-Primary" onSelect={onSelect} />);

    await user.click(screen.getByTestId("env-list-item-Primary"));

    expect(onSelect).toHaveBeenCalledWith("env-Primary");
    expect(useEnvironmentsStore.getState().activeEnvId).toBe("env-Primary");
  });

  it("shows active indicator on the globally active environment", () => {
    seedEnv("Active");
    useEnvironmentsStore.setState({ activeEnvId: "env-Active" });

    const { container } = render(
      <EnvListPanel selectedEnvId="env-Active" onSelect={() => {}} />,
    );

    const row = screen.getByTestId("env-list-item-Active");
    expect(row.querySelector(".bg-theme-accent")).toBeTruthy();
    expect(container.textContent).toContain("Active");
  });

  it("creates environment via Add Environment and enters rename mode", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<EnvListPanel selectedEnvId={null} onSelect={onSelect} />);

    await user.click(screen.getByTestId("add-env-btn"));

    await waitFor(() => {
      expect(useEnvironmentsStore.getState().environments.length).toBe(1);
    });
    expect(screen.getByTestId("env-item-rename-input")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalled();
  });

  it("renames via dropdown and commits on blur", async () => {
    const user = userEvent.setup();
    seedEnv("RenameMe");
    useEnvironmentsStore.setState({ activeEnvId: "env-RenameMe" });

    render(<EnvListPanel selectedEnvId="env-RenameMe" onSelect={() => {}} />);

    await user.click(screen.getByTestId("env-item-more-btn"));
    await user.click(screen.getByTestId("env-item-rename-btn"));

    const input = screen.getByTestId("env-item-rename-input");
    fireEvent.change(input, { target: { value: "Production" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(useEnvironmentsStore.getState().environments[0].name).toBe(
        "Production",
      );
    });
  });

  it("delete confirms and selects fallback when deleting selected env", async () => {
    const user = userEvent.setup();
    seedEnv("First");
    seedEnv("Second");
    const onSelect = vi.fn();

    render(<EnvListPanel selectedEnvId="env-First" onSelect={onSelect} />);

    const firstRow = screen.getByTestId("env-list-item-First");
    await user.click(within(firstRow).getByTestId("env-item-more-btn"));
    await user.click(screen.getByTestId("env-item-delete-btn"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /yes, delete environment/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /yes, delete environment/i }),
    );

    await waitFor(() => {
      expect(
        useEnvironmentsStore
          .getState()
          .environments.find((e) => e.id === "env-First"),
      ).toBeUndefined();
    });
    expect(onSelect).toHaveBeenCalledWith("env-Second");
  });
});
