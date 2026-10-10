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

  async function startRename(user: ReturnType<typeof userEvent.setup>, name: string) {
    const row = screen.getByTestId(`env-list-item-${name}`);
    await user.click(within(row).getByTestId("env-item-more-btn"));
    await user.click(screen.getByTestId("env-item-rename-btn"));
    return screen.getByTestId("env-item-rename-input");
  }

  it("rename to another environment's name (trimmed, case-insensitive) shows inline error and does not save", async () => {
    const user = userEvent.setup();
    seedEnv("Dev");
    seedEnv("Staging");
    render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

    const input = await startRename(user, "Staging");
    fireEvent.change(input, { target: { value: "  dev " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("env-name-error")).toBeInTheDocument();
    expect(screen.getByTestId("env-item-rename-input")).toBeInTheDocument();
    expect(
      useEnvironmentsStore.getState().environments.map((e) => e.name),
    ).toEqual(["Dev", "Staging"]);
  });

  it("clears the inline error when the rename is cancelled with Escape", async () => {
    const user = userEvent.setup();
    seedEnv("Dev");
    seedEnv("Staging");
    render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

    const input = await startRename(user, "Staging");
    fireEvent.change(input, { target: { value: "Dev" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(screen.getByTestId("env-item-rename-input"), {
      key: "Escape",
    });

    expect(screen.queryByTestId("env-name-error")).toBeNull();
    expect(screen.queryByTestId("env-item-rename-input")).toBeNull();
  });

  it("rename to its own name (different case) is allowed", async () => {
    const user = userEvent.setup();
    seedEnv("Dev");
    render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

    const input = await startRename(user, "Dev");
    fireEvent.change(input, { target: { value: "DEV" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.queryByTestId("env-name-error")).toBeNull();
    expect(useEnvironmentsStore.getState().environments[0].name).toBe("DEV");
  });

  it("Add Environment never creates a duplicate default name", async () => {
    const user = userEvent.setup();
    seedEnv("New Environment");
    render(<EnvListPanel selectedEnvId={null} onSelect={() => {}} />);

    await user.click(screen.getByTestId("add-env-btn"));

    const names = useEnvironmentsStore.getState().environments.map((e) => e.name);
    expect(names).toEqual(["New Environment", "New Environment 2"]);
  });

  it("legacy duplicate names render and stay selectable by id", async () => {
    const user = userEvent.setup();
    seedEnv("GitHub", { id: "gh1" });
    seedEnv("GitHub", { id: "gh2" });
    const onSelect = vi.fn();
    render(<EnvListPanel selectedEnvId="gh1" onSelect={onSelect} />);

    const rows = screen.getAllByTestId("env-list-item-GitHub");
    expect(rows).toHaveLength(2);
    await user.click(rows[1]);

    expect(onSelect).toHaveBeenCalledWith("gh2");
    expect(useEnvironmentsStore.getState().activeEnvId).toBe("gh2");
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

  describe("rename keyboard and blank-name handling", () => {
    it("commits the draft name when Enter is pressed", async () => {
      const user = userEvent.setup();
      seedEnv("Dev");
      render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

      const input = await startRename(user, "Dev");
      fireEvent.change(input, { target: { value: "Prod" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useEnvironmentsStore.getState().environments[0].name).toBe("Prod");
      expect(screen.queryByTestId("env-item-rename-input")).toBeNull();
      expect(screen.getByTestId("env-list-item-Prod")).toBeInTheDocument();
    });

    it("discards the draft and keeps the old name when Escape is pressed", async () => {
      const user = userEvent.setup();
      seedEnv("Dev");
      render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

      const input = await startRename(user, "Dev");
      fireEvent.change(input, { target: { value: "Discarded" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.queryByTestId("env-item-rename-input")).toBeNull();
      expect(useEnvironmentsStore.getState().environments[0].name).toBe("Dev");
    });

    it("falls back to the default name when the draft is empty", async () => {
      const user = userEvent.setup();
      seedEnv("Dev");
      render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

      const input = await startRename(user, "Dev");
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useEnvironmentsStore.getState().environments[0].name).toBe(
        "New Environment",
      );
    });

    it("falls back to the default name when the draft is only whitespace", async () => {
      const user = userEvent.setup();
      seedEnv("Dev");
      render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

      const input = await startRename(user, "Dev");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);

      expect(useEnvironmentsStore.getState().environments[0].name).toBe(
        "New Environment",
      );
    });

    it("picks the next free default name when the default is already used by another env", async () => {
      const user = userEvent.setup();
      seedEnv("New Environment");
      seedEnv("Dev");
      render(<EnvListPanel selectedEnvId="env-Dev" onSelect={() => {}} />);

      const input = await startRename(user, "Dev");
      fireEvent.change(input, { target: { value: "  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.name),
      ).toEqual(["New Environment", "New Environment 2"]);
    });
  });

  describe("delete confirmation", () => {
    async function openDeleteDialog(
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) {
      const row = screen.getByTestId(`env-list-item-${name}`);
      await user.click(within(row).getByTestId("env-item-more-btn"));
      await user.click(screen.getByTestId("env-item-delete-btn"));
    }

    it("keeps the environment and selection when the delete dialog is cancelled", async () => {
      const user = userEvent.setup();
      seedEnv("First");
      seedEnv("Second");
      const onSelect = vi.fn();
      render(<EnvListPanel selectedEnvId="env-First" onSelect={onSelect} />);

      await openDeleteDialog(user, "First");
      await user.click(await screen.findByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /yes, delete environment/i }),
        ).toBeNull();
      });
      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.name),
      ).toEqual(["First", "Second"]);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("deleting one of two same-named envs removes only the targeted id", async () => {
      const user = userEvent.setup();
      seedEnv("GitHub", { id: "gh1" });
      seedEnv("GitHub", { id: "gh2" });
      render(<EnvListPanel selectedEnvId="gh1" onSelect={() => {}} />);

      const rows = screen.getAllByTestId("env-list-item-GitHub");
      await user.click(within(rows[1]).getByTestId("env-item-more-btn"));
      await user.click(screen.getByTestId("env-item-delete-btn"));
      await user.click(
        await screen.findByRole("button", { name: /yes, delete environment/i }),
      );

      expect(
        useEnvironmentsStore.getState().environments.map((e) => e.id),
      ).toEqual(["gh1"]);
    });
  });
});
