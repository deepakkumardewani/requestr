/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab } from "@/types";
import { CodeGenDialog } from "./CodeGenDialog";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/request/CodeEditor", () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="code-editor">{value}</pre>
  ),
}));

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useEnvironmentsStore.setState({ environments: [], activeEnvId: null });
  useSettingsStore.setState({ showCodeGen: false, codeGenLang: "cURL" });
}

function seedHttpTab(overrides: Partial<HttpTab> = {}): HttpTab {
  useTabsStore.getState().openTab({
    type: "http",
    name: "Get Users",
    method: "GET",
    url: "https://api.test/users",
    ...overrides,
  });
  return useTabsStore.getState().tabs[0] as HttpTab;
}

beforeEach(resetStores);

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("CodeGenDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <CodeGenDialog open={false} onOpenChange={() => {}} tab={seedHttpTab()} />,
    );

    expect(screen.queryByTestId("code-gen-dialog")).not.toBeInTheDocument();
  });

  it("shows the request name, method and URL in the header", () => {
    render(<CodeGenDialog open onOpenChange={() => {}} tab={seedHttpTab()} />);

    expect(screen.getByText("Get Users")).toBeInTheDocument();
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("https://api.test/users")).toBeInTheDocument();
  });

  it("falls back to 'No URL' when the tab has an empty URL", () => {
    render(
      <CodeGenDialog open onOpenChange={() => {}} tab={seedHttpTab({ url: "" })} />,
    );

    expect(screen.getByText("No URL")).toBeInTheDocument();
  });

  it("renders the generated snippet expanded regardless of showCodeGen", () => {
    useSettingsStore.setState({ showCodeGen: false });

    render(<CodeGenDialog open onOpenChange={() => {}} tab={seedHttpTab()} />);

    expect(screen.getByTestId("code-gen-panel")).toBeInTheDocument();
    expect(screen.getByTestId("code-editor").textContent).toContain(
      "https://api.test/users",
    );
  });

  it("reflects the persisted language in the snippet", () => {
    useSettingsStore.setState({ codeGenLang: "Python" });

    render(<CodeGenDialog open onOpenChange={() => {}} tab={seedHttpTab()} />);

    expect(screen.getByTestId("code-editor").textContent).toContain("requests");
  });

  it("calls onOpenChange(false) when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CodeGenDialog open onOpenChange={onOpenChange} tab={seedHttpTab()} />,
    );

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalled());
    // Base UI passes extra event details after the open flag.
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});
