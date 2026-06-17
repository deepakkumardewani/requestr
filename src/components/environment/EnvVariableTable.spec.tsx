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
import { EnvVariableTable } from "./EnvVariableTable";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function resetStores() {
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
}

function EnvVariableHarness({ envId }: { envId: string }) {
  const env = useEnvironmentsStore((s) =>
    s.environments.find((e) => e.id === envId),
  );
  if (!env) return null;
  return <EnvVariableTable env={env} />;
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("EnvVariableTable", () => {
  it("renders variable rows and placeholder hint for interpolation syntax", () => {
    const variables: EnvVariable[] = [
      {
        id: "va",
        key: "TOKEN",
        initialValue: "abc",
        currentValue: "xyz",
        isSecret: false,
      },
    ];
    const env: EnvironmentModel = {
      id: "env-table",
      name: "TabEnv",
      variables,
      createdAt: 1,
      updatedAt: 1,
    };
    useEnvironmentsStore.setState({ environments: [env] });

    render(<EnvVariableHarness envId="env-table" />);

    expect(screen.getAllByTestId("var-key-input")[0]).toHaveValue("TOKEN");
    expect(screen.getAllByTestId("var-initial-value-input")[0]).toHaveValue(
      "abc",
    );
    expect(screen.getAllByTestId("var-current-value-input")[0]).toHaveValue(
      "xyz",
    );
    expect(screen.getAllByText(/\{\{VARIABLE_NAME\}\}/).length).toBeGreaterThan(
      0,
    );
  });

  it("updates variable key and values in the store", async () => {
    const variables: EnvVariable[] = [
      {
        id: "vb",
        key: "OLD",
        initialValue: "",
        currentValue: "",
        isSecret: false,
      },
    ];
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e-var",
          name: "E",
          variables,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    render(<EnvVariableHarness envId="e-var" />);

    fireEvent.change(screen.getAllByTestId("var-key-input")[0], {
      target: { value: "NEW_KEY" },
    });
    fireEvent.change(screen.getAllByTestId("var-current-value-input")[0], {
      target: { value: "runtime" },
    });

    await waitFor(() => {
      const v = useEnvironmentsStore.getState().environments[0].variables[0];
      expect(v.key).toBe("NEW_KEY");
      expect(v.currentValue).toBe("runtime");
    });
  });

  it("adds and removes variable rows", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e-add",
          name: "E",
          variables: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    render(<EnvVariableHarness envId="e-add" />);

    await user.click(screen.getByTestId("add-variable-btn"));

    await waitFor(() => {
      expect(
        useEnvironmentsStore.getState().environments[0].variables,
      ).toHaveLength(1);
    });

    await user.click(screen.getByTestId("var-delete-btn"));

    await waitFor(() => {
      expect(
        useEnvironmentsStore.getState().environments[0].variables,
      ).toHaveLength(0);
    });
  });

  it("marks secret and toggles visibility eye when secret", async () => {
    const user = userEvent.setup();
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "e-sec",
          name: "E",
          variables: [
            {
              id: "vs",
              key: "PWD",
              initialValue: "secret",
              currentValue: "secret",
              isSecret: false,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    render(<EnvVariableHarness envId="e-sec" />);

    await user.click(screen.getAllByTestId("var-secret-checkbox")[0]);

    await waitFor(() => {
      expect(
        useEnvironmentsStore.getState().environments[0].variables[0].isSecret,
      ).toBe(true);
    });

    expect(screen.getByTestId("var-secret-toggle")).toBeInTheDocument();

    await user.click(screen.getByTestId("var-secret-toggle"));

    expect(screen.getAllByTestId("var-initial-value-input")[0]).toHaveAttribute(
      "type",
      "text",
    );
  });
});
