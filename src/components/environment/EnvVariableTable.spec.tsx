/** @vitest-environment happy-dom */

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
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

function makeVar(patch: Partial<EnvVariable> = {}): EnvVariable {
  return {
    id: "v",
    key: "K",
    initialValue: "",
    currentValue: "",
    isSecret: false,
    ...patch,
  };
}

function makeEnv(id: string, variables: EnvVariable[]): EnvironmentModel {
  return { id, name: "E", variables, createdAt: 1, updatedAt: 1 };
}

function seedEnv(id: string, variables: EnvVariable[]) {
  useEnvironmentsStore.setState({ environments: [makeEnv(id, variables)] });
}

function storedVars(): EnvVariable[] {
  return useEnvironmentsStore.getState().environments[0].variables;
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

  it("marks secret, masks values, then reveals them via the eye toggle", async () => {
    const user = userEvent.setup();
    seedEnv("e-sec", [makeVar({ id: "vs", key: "PWD", initialValue: "secret", currentValue: "secret" })]);
    render(<EnvVariableHarness envId="e-sec" />);

    expect(screen.queryByTestId("var-secret-toggle")).not.toBeInTheDocument();
    expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "text");

    await user.click(screen.getByTestId("var-secret-checkbox"));

    await waitFor(() => {
      expect(storedVars()[0].isSecret).toBe(true);
    });
    expect(screen.getByTestId("var-secret-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "password");
    expect(screen.getByTestId("var-current-value-input")).toHaveAttribute("type", "password");

    await user.click(screen.getByTestId("var-secret-toggle"));

    expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "text");
    expect(screen.getByTestId("var-current-value-input")).toHaveAttribute("type", "text");
  });

  describe("secret visibility (U-ENV-09)", () => {
    it("removes the eye and resets visibility when secret is unchecked, so re-marking starts masked", async () => {
      const user = userEvent.setup();
      seedEnv("e-uncheck", [makeVar({ id: "v1", key: "API", initialValue: "s3", currentValue: "s3", isSecret: true })]);
      render(<EnvVariableHarness envId="e-uncheck" />);
      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "password");
      await user.click(screen.getByTestId("var-secret-toggle"));
      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "text");

      await user.click(screen.getByTestId("var-secret-checkbox"));

      await waitFor(() => {
        expect(storedVars()[0].isSecret).toBe(false);
      });
      expect(screen.queryByTestId("var-secret-toggle")).not.toBeInTheDocument();
      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "text");

      await user.click(screen.getByTestId("var-secret-checkbox"));

      await waitFor(() => {
        expect(storedVars()[0].isSecret).toBe(true);
      });
      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "password");
      expect(screen.getByTestId("var-current-value-input")).toHaveAttribute("type", "password");
    });

    it("masks a secret row that has an empty key", () => {
      seedEnv("e-empty", [makeVar({ id: "v1", key: "", initialValue: "hidden", currentValue: "hidden", isSecret: true })]);
      render(<EnvVariableHarness envId="e-empty" />);

      expect(screen.getByTestId("var-key-input")).toHaveValue("");
      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "password");
      expect(screen.getByTestId("var-current-value-input")).toHaveAttribute("type", "password");
      expect(screen.getByTestId("var-secret-toggle")).toBeInTheDocument();
    });

    it("never copies a masked secret value into placeholders", () => {
      seedEnv("e-leak", [makeVar({ id: "v1", key: "TOKEN", initialValue: "sup3r-secret", currentValue: "sup3r-secret", isSecret: true })]);
      render(<EnvVariableHarness envId="e-leak" />);

      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("placeholder", "Initial value");
      for (const input of screen.getAllByRole("textbox")) {
        expect(input.getAttribute("placeholder") ?? "").not.toContain("sup3r-secret");
      }
      expect(screen.getByTestId("var-initial-value-input")).toHaveAttribute("type", "password");
    });

    it("keeps other rows' visibility independent when one secret is revealed", async () => {
      const user = userEvent.setup();
      seedEnv("e-two", [
        makeVar({ id: "a", key: "A", initialValue: "1", currentValue: "1", isSecret: true }),
        makeVar({ id: "b", key: "B", initialValue: "2", currentValue: "2", isSecret: true }),
      ]);
      render(<EnvVariableHarness envId="e-two" />);

      await user.click(screen.getAllByTestId("var-secret-toggle")[0]);

      const inputs = screen.getAllByTestId("var-initial-value-input");
      expect(inputs[0]).toHaveAttribute("type", "text");
      expect(inputs[1]).toHaveAttribute("type", "password");
    });
  });

  describe("bulk paste (U-ENV-02)", () => {
    const MULTI = "API_URL=https://x.io\nTOKEN=abc";
    const cells = ["var-key-input", "var-initial-value-input", "var-current-value-input"];

    it.each(cells)("imports multi-line .env text pasted into %s, prevents default and toasts", (testId) => {
      seedEnv("e-paste", [makeVar({ id: "v1", key: "", initialValue: "", currentValue: "" })]);
      render(<EnvVariableHarness envId="e-paste" />);

      const notPrevented = fireEvent.paste(screen.getByTestId(testId), {
        clipboardData: { getData: () => MULTI },
      });

      expect(notPrevented).toBe(false);
      const vars = storedVars();
      expect(vars.find((v) => v.key === "API_URL")?.currentValue).toBe("https://x.io");
      expect(vars.find((v) => v.key === "TOKEN")?.currentValue).toBe("abc");
      expect(toast.success).toHaveBeenCalledWith("2 variables imported from paste");
    });

    it("uses singular wording when the paste yields one variable", () => {
      seedEnv("e-one", []);
      render(<EnvVariableHarness envId="e-one" />);
      // no rows: paste into a freshly added row
      fireEvent.click(screen.getByTestId("add-variable-btn"));

      fireEvent.paste(screen.getByTestId("var-key-input"), {
        clipboardData: { getData: () => "# comment\nONLY=1\n" },
      });

      expect(toast.success).toHaveBeenCalledWith("1 variable imported from paste");
    });

    it("leaves single-line pastes alone so the cell receives normal paste", () => {
      seedEnv("e-single", [makeVar({ id: "v1" })]);
      render(<EnvVariableHarness envId="e-single" />);

      const notPrevented = fireEvent.paste(screen.getByTestId("var-key-input"), {
        clipboardData: { getData: () => "KEY=value" },
      });

      expect(notPrevented).toBe(true);
      expect(storedVars()).toHaveLength(1);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("does not intercept multi-line text that contains no KEY=VALUE lines", () => {
      seedEnv("e-nokv", [makeVar({ id: "v1" })]);
      render(<EnvVariableHarness envId="e-nokv" />);

      const notPrevented = fireEvent.paste(screen.getByTestId("var-key-input"), {
        clipboardData: { getData: () => "just text\nmore text" },
      });

      expect(notPrevented).toBe(true);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("shows a 'No KEY=VALUE lines' error when nothing could be imported", () => {
      // env is not in the store, so the store reports 0 imported variables
      render(<EnvVariableTable env={makeEnv("ghost", [makeVar({ id: "v1" })])} />);

      const notPrevented = fireEvent.paste(screen.getByTestId("var-key-input"), {
        clipboardData: { getData: () => MULTI },
      });

      expect(notPrevented).toBe(false);
      expect(toast.error).toHaveBeenCalledWith("No KEY=VALUE lines in paste");
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe(".env file import (U-ENV-01)", () => {
    function envFile(content: string, name = ".env") {
      return new File([content], name, { type: "" });
    }
    function fileInput(container: HTMLElement) {
      return container.querySelector('input[type="file"]') as HTMLInputElement;
    }
    function panel(container: HTMLElement) {
      return container.firstElementChild as HTMLElement;
    }

    it("imports a dotfile chosen via the file input and shows the plural toast", async () => {
      const user = userEvent.setup();
      seedEnv("e-file", []);
      const { container } = render(<EnvVariableHarness envId="e-file" />);

      await user.upload(fileInput(container), envFile("A=1\nB=2\n", ".env"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("2 variables imported");
      });
      expect(storedVars().map((v) => v.key)).toEqual(["A", "B"]);
      expect(fileInput(container)).not.toHaveAttribute("accept");
    });

    it("shows the singular toast when exactly one variable is imported", async () => {
      const user = userEvent.setup();
      seedEnv("e-file1", []);
      const { container } = render(<EnvVariableHarness envId="e-file1" />);

      await user.upload(fileInput(container), envFile("ONLY=1"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("1 variable imported");
      });
    });

    it("opens the file picker when the Import button is clicked", async () => {
      const user = userEvent.setup();
      seedEnv("e-btn", []);
      const { container } = render(<EnvVariableHarness envId="e-btn" />);
      const clickSpy = vi.spyOn(fileInput(container), "click");

      await user.click(screen.getByTestId("import-env-btn"));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("reports 'No variables found in file' for a comments-only file", async () => {
      const user = userEvent.setup();
      seedEnv("e-empty-file", []);
      const { container } = render(<EnvVariableHarness envId="e-empty-file" />);

      await user.upload(fileInput(container), envFile("# nothing here\n\n"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("No variables found in file");
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(storedVars()).toHaveLength(0);
    });

    it("surfaces the error message when the file cannot be read", async () => {
      const user = userEvent.setup();
      seedEnv("e-fail", []);
      const { container } = render(<EnvVariableHarness envId="e-fail" />);
      const file = envFile("A=1");
      Object.defineProperty(file, "text", {
        value: () => Promise.reject(new Error("disk unreadable")),
      });

      await user.upload(fileInput(container), file);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("disk unreadable");
      });
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when the read rejects with a non-Error", async () => {
      const user = userEvent.setup();
      seedEnv("e-fail2", []);
      const { container } = render(<EnvVariableHarness envId="e-fail2" />);
      const file = envFile("A=1");
      Object.defineProperty(file, "text", {
        value: () => Promise.reject("boom"),
      });

      await user.upload(fileInput(container), file);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to read .env file");
      });
    });

    it("imports a dropped file and clears the highlight", async () => {
      seedEnv("e-drop", []);
      const { container } = render(<EnvVariableHarness envId="e-drop" />);
      fireEvent.dragOver(panel(container), { dataTransfer: { files: [] } });

      fireEvent.drop(panel(container), {
        dataTransfer: { files: [envFile("X=1\nY=2\nZ=3", ".env.local")] },
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("3 variables imported");
      });
      expect(panel(container)).not.toHaveClass("ring-inset");
    });

    it("ignores a drop that carries no file", () => {
      seedEnv("e-nodrop", []);
      const { container } = render(<EnvVariableHarness envId="e-nodrop" />);

      fireEvent.drop(panel(container), { dataTransfer: { files: [] } });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("highlights the panel on dragover and clears it when the drag leaves", () => {
      seedEnv("e-hl", []);
      const { container } = render(<EnvVariableHarness envId="e-hl" />);
      expect(panel(container)).not.toHaveClass("ring-inset");

      fireEvent.dragOver(panel(container), { dataTransfer: { files: [] } });
      expect(panel(container)).toHaveClass("ring-inset");

      fireEvent.dragLeave(panel(container), { relatedTarget: null });
      expect(panel(container)).not.toHaveClass("ring-inset");
    });

    it("keeps the highlight when the drag moves onto a child element", () => {
      seedEnv("e-child", []);
      const { container } = render(<EnvVariableHarness envId="e-child" />);
      fireEvent.dragOver(panel(container), { dataTransfer: { files: [] } });

      // happy-dom drops relatedTarget from the DragEvent init, so set it explicitly
      const leave = createEvent.dragLeave(panel(container));
      Object.defineProperty(leave, "relatedTarget", {
        value: screen.getByTestId("add-variable-btn"),
      });
      fireEvent(panel(container), leave);

      expect(panel(container)).toHaveClass("ring-inset");
    });
  });
});
