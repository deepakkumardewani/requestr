/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { EnvironmentModel } from "@/types";
import { EnvSelector } from "./EnvSelector";

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

describe("EnvSelector", () => {
  it("shows No Environment when none is active", () => {
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e1",
          name: "Prod",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: null,
    });

    render(<EnvSelector />);

    expect(screen.getByTestId("env-selector-trigger")).toHaveTextContent(
      "No Environment",
    );
  });

  it("shows active environment name on trigger", () => {
    const env: EnvironmentModel = {
      id: "e-act",
      name: "Staging",
      variables: [],
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({
      environments: [env],
      activeEnvId: "e-act",
    });

    render(<EnvSelector />);

    expect(screen.getByTestId("env-selector-trigger")).toHaveTextContent(
      "Staging",
    );
  });

  it("clears active env when No Environment is chosen", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e-clear",
          name: "Prod",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "e-clear",
    });

    render(<EnvSelector />);

    await user.click(screen.getByTestId("env-selector-trigger"));
    await user.click(screen.getByTestId("env-selector-no-env"));

    expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
  });

  it("opens manage dialog when Manage Environments is clicked", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "m1",
          name: "Dev",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "m1",
    });

    render(<EnvSelector />);

    await user.click(screen.getByTestId("env-selector-trigger"));
    await user.click(screen.getByTestId("env-selector-manage-btn"));

    await waitFor(() => {
      expect(useUIStore.getState().envManagerOpen).toBe(true);
    });
  });

  it("activates environment when selecting from menu", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "ea",
          name: "Alpha",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "eb",
          name: "Beta",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "ea",
    });

    render(<EnvSelector />);

    await user.click(screen.getByTestId("env-selector-trigger"));
    await user.click(screen.getByTestId("env-selector-item-Beta"));

    expect(useEnvironmentsStore.getState().activeEnvId).toBe("eb");
  });

  it("env row more button opens actions without selecting the env or showing a chevron", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        { id: "ea", name: "Alpha", variables: [], createdAt: 1, updatedAt: 1 },
        { id: "eb", name: "Beta", variables: [], createdAt: 1, updatedAt: 1 },
      ],
      activeEnvId: "ea",
    });

    render(<EnvSelector />);
    await user.click(screen.getByTestId("env-selector-trigger"));
    await user.click(screen.getByTestId("env-selector-more-Beta"));

    expect(await screen.findByText("Rename")).toBeInTheDocument();
    expect(useEnvironmentsStore.getState().activeEnvId).toBe("ea");
    const row = screen.getByTestId("env-selector-item-Beta");
    expect(row.querySelector("svg.lucide-chevron-right")).toBeNull();
  });

  describe("rename and delete actions", () => {
    const envs: EnvironmentModel[] = [
      { id: "ea", name: "Alpha", variables: [], createdAt: 1, updatedAt: 1 },
      { id: "eb", name: "Beta", variables: [], createdAt: 1, updatedAt: 1 },
    ];

    async function openMenu(user: ReturnType<typeof userEvent.setup>) {
      render(<EnvSelector />);
      await user.click(screen.getByTestId("env-selector-trigger"));
    }

    it("opens the manager focused on the env when Rename is chosen from the more menu", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({ environments: envs, activeEnvId: "ea" });

      await openMenu(user);
      await user.click(screen.getByTestId("env-selector-more-Beta"));
      await user.click(await screen.findByText("Rename"));

      await waitFor(() => {
        expect(useUIStore.getState().envManagerOpen).toBe(true);
      });
      expect(useUIStore.getState().envManagerFocusEnvId).toBe("eb");
    });

    it("deletes a non-active env after confirming from the more menu and keeps the active one", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({ environments: envs, activeEnvId: "ea" });

      await openMenu(user);
      await user.click(screen.getByTestId("env-selector-more-Beta"));
      await user.click(await screen.findByText("Delete"));
      expect(
        await screen.findByText(/"Beta" and all its variables/),
      ).toBeInTheDocument();
      await user.click(screen.getByText("Yes, delete environment"));

      await waitFor(() => {
        expect(
          useEnvironmentsStore.getState().environments.map((e) => e.id),
        ).toEqual(["ea"]);
      });
      expect(useEnvironmentsStore.getState().activeEnvId).toBe("ea");
    });

    it("clears the active env when the active env is deleted", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({ environments: envs, activeEnvId: "eb" });

      await openMenu(user);
      await user.click(screen.getByTestId("env-selector-more-Beta"));
      await user.click(await screen.findByText("Delete"));
      await user.click(await screen.findByText("Yes, delete environment"));

      await waitFor(() => {
        expect(useEnvironmentsStore.getState().activeEnvId).toBeNull();
      });
      expect(useEnvironmentsStore.getState().environments).toHaveLength(1);
    });

    it("keeps the env when delete is cancelled", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({ environments: envs, activeEnvId: "ea" });

      await openMenu(user);
      await user.click(screen.getByTestId("env-selector-more-Beta"));
      await user.click(await screen.findByText("Delete"));
      await user.click(await screen.findByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByText("Yes, delete environment")).toBeNull();
      });
      expect(useEnvironmentsStore.getState().environments).toHaveLength(2);
    });

    it("offers Rename and Delete in the row context menu", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({ environments: envs, activeEnvId: "ea" });

      await openMenu(user);
      fireEvent.contextMenu(screen.getByTestId("env-selector-item-Beta"));
      const rename = await screen.findAllByText("Rename");
      await user.click(rename[rename.length - 1]);

      await waitFor(() => {
        expect(useUIStore.getState().envManagerFocusEnvId).toBe("eb");
      });
    });

    it("deletes via the row context menu after confirming", async () => {
      const user = userEvent.setup();
      useEnvironmentsStore.setState({ environments: envs, activeEnvId: "ea" });

      await openMenu(user);
      fireEvent.contextMenu(screen.getByTestId("env-selector-item-Beta"));
      const del = await screen.findAllByText("Delete");
      await user.click(del[del.length - 1]);
      await user.click(await screen.findByText("Yes, delete environment"));

      await waitFor(() => {
        expect(
          useEnvironmentsStore.getState().environments.map((e) => e.id),
        ).toEqual(["ea"]);
      });
    });
  });
});
