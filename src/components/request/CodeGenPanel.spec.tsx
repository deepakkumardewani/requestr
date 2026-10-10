/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab, TabState } from "@/types";
import { CodeGenPanel } from "./CodeGenPanel";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// CodeMirror is a rendering boundary; expose the value + language it receives.
vi.mock("@/components/request/CodeEditor", () => ({
  default: ({ value, language }: { value: string; language: string }) => (
    <pre data-testid="code-editor" data-language={language}>
      {value}
    </pre>
  ),
}));

const writeText = vi.fn();

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useSettingsStore.setState({ showCodeGen: false, codeGenLang: "cURL" });
}

function seedHttpTab(overrides: Partial<HttpTab> = {}): HttpTab {
  useTabsStore.getState().openTab({
    type: "http",
    method: "GET",
    url: "https://api.test/users",
    ...overrides,
  });
  return useTabsStore.getState().tabs[0] as HttpTab;
}

function seedEnv() {
  useEnvironmentsStore.setState({
    environments: [
      {
        id: "e1",
        name: "Staging",
        variables: [
          {
            id: "v1",
            key: "host",
            initialValue: "staging.example.com",
            currentValue: "",
            isSecret: false,
          },
          {
            id: "v2",
            key: "token",
            initialValue: "super-secret-value",
            currentValue: "",
            isSecret: true,
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    activeEnvId: "e1",
  });
}

function snippet() {
  return screen.getByTestId("code-editor").textContent ?? "";
}

async function pickLanguage(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name }));
}

beforeEach(() => {
  resetStores();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("CodeGenPanel", () => {
  it("renders nothing for non-http tabs", () => {
    const wsTab = {
      tabId: "ws-1",
      type: "websocket",
      name: "WS",
      url: "wss://x.test",
    } as unknown as TabState;

    const { container } = render(<CodeGenPanel tab={wsTab} />);

    expect(container).toBeEmptyDOMElement();
  });

  describe("dock variant expand / collapse", () => {
    it("hides the code viewer when showCodeGen is false", () => {
      useSettingsStore.setState({ showCodeGen: false });

      render(<CodeGenPanel tab={seedHttpTab()} />);

      expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
      expect(screen.queryByText("Copy")).not.toBeInTheDocument();
    });

    it("shows the code viewer when showCodeGen is true", () => {
      useSettingsStore.setState({ showCodeGen: true });

      render(<CodeGenPanel tab={seedHttpTab()} />);

      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
      expect(snippet()).toContain("curl");
    });

    it("expands and persists showCodeGen when the header is clicked while collapsed", () => {
      render(<CodeGenPanel tab={seedHttpTab()} />);

      fireEvent.click(screen.getByRole("button", { name: /code/i }));

      expect(useSettingsStore.getState().showCodeGen).toBe(true);
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });

    it("collapses via keyboard Enter on the header", () => {
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);

      fireEvent.keyDown(screen.getAllByRole("button", { name: /code/i })[0], {
        key: "Enter",
      });

      expect(useSettingsStore.getState().showCodeGen).toBe(false);
      expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
    });

    it("does not collapse when the copy button is clicked", async () => {
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(useSettingsStore.getState().showCodeGen).toBe(true);
    });
  });

  describe("tab variant", () => {
    it("is always expanded even when showCodeGen is false", () => {
      useSettingsStore.setState({ showCodeGen: false });

      render(<CodeGenPanel tab={seedHttpTab()} variant="tab" />);

      expect(screen.getByTestId("code-gen-panel")).toBeInTheDocument();
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });

    it("keeps the panel visible when the toolbar is clicked", () => {
      render(<CodeGenPanel tab={seedHttpTab()} variant="tab" />);

      fireEvent.click(screen.getByText("Code"));

      expect(useSettingsStore.getState().showCodeGen).toBe(false);
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
  });

  describe("language switching", () => {
    it("defaults to the persisted codeGenLang", () => {
      useSettingsStore.setState({ showCodeGen: true, codeGenLang: "Python" });

      render(<CodeGenPanel tab={seedHttpTab()} />);

      expect(screen.getByTestId("code-editor")).toHaveAttribute(
        "data-language",
        "python",
      );
    });

    it("falls back to cURL when the persisted language is invalid", () => {
      useSettingsStore.setState({
        showCodeGen: true,
        codeGenLang: "Brainfuck" as never,
      });

      render(<CodeGenPanel tab={seedHttpTab()} />);

      expect(screen.getByTestId("code-editor")).toHaveAttribute(
        "data-language",
        "text",
      );
      expect(snippet()).toContain("curl");
    });

    it("switches the snippet and persists codeGenLang when a language is chosen", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);
      const curlSnippet = snippet();

      await pickLanguage(user, "Python");

      expect(useSettingsStore.getState().codeGenLang).toBe("Python");
      expect(snippet()).not.toBe(curlSnippet);
      expect(snippet()).toContain("requests");
      expect(screen.getByTestId("code-editor")).toHaveAttribute(
        "data-language",
        "python",
      );
    });

    it("does not collapse the panel when a language is selected", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);

      await pickLanguage(user, "Go");

      expect(useSettingsStore.getState().showCodeGen).toBe(true);
    });

    it("persists codeGenLang from the tab variant too", async () => {
      const user = userEvent.setup();
      render(<CodeGenPanel tab={seedHttpTab()} variant="tab" />);

      await pickLanguage(user, "fetch");

      expect(useSettingsStore.getState().codeGenLang).toBe("fetch");
      expect(snippet()).toContain("fetch(");
    });
  });

  describe("copy", () => {
    it("writes the current snippet to the clipboard and shows Copied", async () => {
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);

      fireEvent.click(screen.getByText("Copy"));

      await screen.findByText("Copied");
      expect(writeText).toHaveBeenCalledWith(snippet());
    });

    it("reverts the Copied label to Copy after the reset delay", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);

      fireEvent.click(screen.getByText("Copy"));
      await screen.findByText("Copied");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      expect(screen.getByText("Copy")).toBeInTheDocument();
      expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    });

    it("shows a success toast instead of the Copied label in the tab variant", async () => {
      render(<CodeGenPanel tab={seedHttpTab()} variant="tab" />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Copied to clipboard"),
      );
      expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    });

    it("shows an error toast when the clipboard write fails", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      writeText.mockRejectedValueOnce(new Error("denied"));
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab()} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Failed to copy"),
      );
      expect(screen.queryByText("Copied")).not.toBeInTheDocument();
      consoleError.mockRestore();
    });
  });

  describe("variable resolution", () => {
    it("keeps {{var}} tokens in the snippet by default", () => {
      seedEnv();
      useSettingsStore.setState({ showCodeGen: true });

      render(<CodeGenPanel tab={seedHttpTab({ url: "https://{{host}}/users" })} />);

      expect(snippet()).toContain("{{host}}");
      expect(screen.getByText("Resolve variables")).toBeInTheDocument();
    });

    it("substitutes active environment values when Resolve variables is enabled", async () => {
      const user = userEvent.setup();
      seedEnv();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab({ url: "https://{{host}}/users" })} />);

      await user.click(screen.getByRole("switch"));

      expect(snippet()).toContain("https://staging.example.com/users");
      expect(snippet()).not.toContain("{{host}}");
      expect(screen.getByText("Resolving: Staging")).toBeInTheDocument();
    });

    it("restores the raw tokens when Resolve variables is turned off again", async () => {
      const user = userEvent.setup();
      seedEnv();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab({ url: "https://{{host}}/users" })} />);

      await user.click(screen.getByRole("switch"));
      await user.click(screen.getByRole("switch"));

      expect(snippet()).toContain("{{host}}");
    });

    it("leaves tokens untouched when no environment is active", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab({ url: "https://{{host}}/users" })} />);

      await user.click(screen.getByRole("switch"));

      expect(snippet()).toContain("{{host}}");
      expect(screen.getByText("Resolve variables")).toBeInTheDocument();
    });
  });

  describe("secret redaction", () => {
    const secretHeader = {
      id: "h1",
      key: "Authorization",
      value: "Bearer {{token}}",
      enabled: true,
    };

    it("redacts secret variable values and never leaks them when resolving", async () => {
      const user = userEvent.setup();
      seedEnv();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab({ headers: [secretHeader] })} />);

      await user.click(screen.getByRole("switch"));

      expect(snippet()).toContain("Bearer <REDACTED>");
      expect(snippet()).not.toContain("super-secret-value");
    });

    it("shows the raw token placeholder, not the secret, while resolving is off", () => {
      seedEnv();
      useSettingsStore.setState({ showCodeGen: true });

      render(<CodeGenPanel tab={seedHttpTab({ headers: [secretHeader] })} />);

      expect(snippet()).toContain("Bearer {{token}}");
      expect(snippet()).not.toContain("super-secret-value");
    });

    it("keeps secrets redacted after switching language", async () => {
      const user = userEvent.setup();
      seedEnv();
      useSettingsStore.setState({ showCodeGen: true });
      render(<CodeGenPanel tab={seedHttpTab({ headers: [secretHeader] })} />);

      await user.click(screen.getByRole("switch"));
      await pickLanguage(user, "Python");

      expect(snippet()).toContain("<REDACTED>");
      expect(snippet()).not.toContain("super-secret-value");
    });
  });
});
