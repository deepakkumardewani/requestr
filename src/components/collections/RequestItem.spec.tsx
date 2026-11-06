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
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab, RequestModel } from "@/types";
import { downloadPostmanRequest } from "@/lib/postmanExporter";
import { toast } from "sonner";
import { RequestItem } from "./RequestItem";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/postmanExporter", () => ({
  downloadPostmanRequest: vi.fn(),
}));

vi.mock("@/components/request/CodeGenDialog", () => ({
  CodeGenDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="codegen-dialog" /> : null,
}));

vi.mock("@/components/collections/HealthDot", () => ({
  HealthDot: () => <span data-testid="health-dot" />,
}));

function resetStores() {
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useSettingsStore.setState({ showHealthMonitor: false, pinnedRequestIds: [] });
}

function minimalRequest(overrides: Partial<RequestModel> = {}): RequestModel {
  return {
    id: "req-1",
    collectionId: "col-1",
    name: "Get User",
    method: "GET",
    url: "https://api.example.com/users",
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  cleanup();
  resetStores();
  vi.clearAllMocks();
});

describe("RequestItem", () => {
  it("renders method and request name", () => {
    const req = minimalRequest({ name: "List Posts" });
    useCollectionsStore.setState({
      collections: [
        {
          id: "col-1",
          name: "API",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    expect(screen.getByText("List Posts")).toBeInTheDocument();
    expect(screen.getByTestId("request-item")).toBeInTheDocument();
  });

  it("opens a new tab when clicked and no tab exists for the request", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item"));

    await waitFor(() => {
      const tabs = useTabsStore.getState().tabs;
      expect(tabs).toHaveLength(1);
      const t = tabs[0] as HttpTab;
      expect(t.requestId).toBe(req.id);
      expect(t.name).toBe(req.name);
    });
  });

  it("activates existing tab instead of opening duplicate", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    useTabsStore.getState().openTab({
      type: "http",
      requestId: req.id,
      name: req.name,
      method: req.method,
      url: req.url,
      params: req.params,
      headers: req.headers,
      auth: req.auth,
      body: req.body,
      preScript: req.preScript,
      postScript: req.postScript,
      isDirty: false,
    });
    const existingTabId = useTabsStore.getState().tabs[0].tabId;
    useTabsStore.setState({ activeTabId: null });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item"));

    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeTabId).toBe(existingTabId);
  });

  it("starts inline rename from dropdown and commits on blur", async () => {
    const user = userEvent.setup();
    const req = minimalRequest({ name: "Old" });
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByTestId("request-rename-btn"));

    const input = screen.getByDisplayValue("Old");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        useCollectionsStore.getState().requests.find((r) => r.id === req.id)
          ?.name,
      ).toBe("New Title");
    });
    expect(screen.queryByDisplayValue("New Title")).not.toBeInTheDocument();
  });

  it("duplicate adds a copied request to the same collection", async () => {
    const user = userEvent.setup();
    const req = minimalRequest({ name: "Original" });
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByRole("menuitem", { name: /duplicate/i }));

    await waitFor(() => {
      const requests = useCollectionsStore.getState().requests;
      expect(requests).toHaveLength(2);
      expect(requests.some((r) => r.name === "Original (copy)")).toBe(true);
    });
  });

  it("delete confirmation removes request", async () => {
    const user = userEvent.setup();
    const req = minimalRequest();
    useCollectionsStore.setState({
      collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
      requests: [req],
    });

    render(<RequestItem request={req} isActive={false} />);

    await user.click(screen.getByTestId("request-item-more-btn"));
    await user.click(screen.getByTestId("request-delete-btn"));

    fireEvent.click(screen.getByRole("button", { name: /^yes, delete$/i }));

    await waitFor(() => {
      expect(useCollectionsStore.getState().requests).toHaveLength(0);
    });
  });
  describe("rendering states", () => {
    it("shows the health dot only when monitoring is on and a url exists", () => {
      useSettingsStore.setState({ showHealthMonitor: true });
      const { rerender } = render(
        <RequestItem request={minimalRequest()} isActive={false} />,
      );
      expect(screen.getByTestId("health-dot")).toBeInTheDocument();

      rerender(
        <RequestItem request={minimalRequest({ url: "" })} isActive={false} />,
      );
      expect(screen.queryByTestId("health-dot")).not.toBeInTheDocument();
    });

    it("shows a pinned indicator for pinned requests", () => {
      useSettingsStore.setState({ pinnedRequestIds: ["req-1"] });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
    });

    it("highlights the active request", () => {
      render(<RequestItem request={minimalRequest()} isActive />);

      expect(screen.getByTestId("request-item").className).toContain(
        "border-l-theme-accent",
      );
    });
  });

  describe("keyboard open", () => {
    it.each(["Enter", " "])("opens a tab on %j", (key) => {
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      fireEvent.keyDown(screen.getByTestId("request-item"), { key });

      expect(useTabsStore.getState().tabs).toHaveLength(1);
    });

    it("ignores other keys", () => {
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      fireEvent.keyDown(screen.getByTestId("request-item"), { key: "a" });

      expect(useTabsStore.getState().tabs).toHaveLength(0);
    });
  });

  describe("rename", () => {
    async function startRename(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByTestId("request-item-more-btn"));
      await user.click(screen.getByTestId("request-rename-btn"));
    }

    function seed(req: RequestModel) {
      useCollectionsStore.setState({
        collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
        requests: [req],
      });
    }

    it("commits on Enter and syncs the open tab name", async () => {
      const user = userEvent.setup();
      const req = minimalRequest({ name: "Old" });
      seed(req);
      useTabsStore.getState().openTab({
        type: "http",
        requestId: req.id,
        name: "Old",
        method: "GET",
        url: req.url,
        params: [],
        headers: [],
        auth: req.auth,
        body: req.body,
        preScript: "",
        postScript: "",
        isDirty: false,
      });
      render(<RequestItem request={req} isActive={false} />);

      await startRename(user);
      const input = screen.getByDisplayValue("Old");
      fireEvent.change(input, { target: { value: "  Renamed  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useCollectionsStore.getState().requests[0].name).toBe("Renamed");
      expect(useTabsStore.getState().tabs[0].name).toBe("Renamed");
    });

    it("cancels on Escape without saving", async () => {
      const user = userEvent.setup();
      const req = minimalRequest({ name: "Old" });
      seed(req);
      render(<RequestItem request={req} isActive={false} />);

      await startRename(user);
      const input = screen.getByDisplayValue("Old");
      fireEvent.change(input, { target: { value: "Nope" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.queryByDisplayValue("Nope")).not.toBeInTheDocument();
      expect(useCollectionsStore.getState().requests[0].name).toBe("Old");
    });

    it("does not save a blank or unchanged name", async () => {
      const user = userEvent.setup();
      const req = minimalRequest({ name: "Old" });
      seed(req);
      render(<RequestItem request={req} isActive={false} />);

      await startRename(user);
      const input = screen.getByDisplayValue("Old");
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useCollectionsStore.getState().requests[0].name).toBe("Old");
    });

    it("does not open a tab when clicking the row while renaming", async () => {
      const user = userEvent.setup();
      const req = minimalRequest({ name: "Old" });
      seed(req);
      render(<RequestItem request={req} isActive={false} />);

      await startRename(user);
      fireEvent.click(screen.getByTestId("request-item"));
      expect(useTabsStore.getState().tabs).toHaveLength(0);

      fireEvent.click(screen.getByDisplayValue("Old"));
      expect(useTabsStore.getState().tabs).toHaveLength(0);
    });
  });

  describe("dropdown actions", () => {
    async function openMenu(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByTestId("request-item-more-btn"));
    }

    it("pins an unpinned request", async () => {
      const user = userEvent.setup();
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /pin to top/i }));

      expect(useSettingsStore.getState().pinnedRequestIds).toEqual(["req-1"]);
    });

    it("unpins a pinned request", async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ pinnedRequestIds: ["req-1"] });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /unpin/i }));

      expect(useSettingsStore.getState().pinnedRequestIds).toEqual([]);
    });

    it("opens the code generation dialog", async () => {
      const user = userEvent.setup();
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openMenu(user);
      await user.click(
        screen.getByRole("menuitem", { name: /generate code/i }),
      );

      expect(screen.getByTestId("codegen-dialog")).toBeInTheDocument();
    });

    it("exports the request as Postman", async () => {
      const user = userEvent.setup();
      const req = minimalRequest();
      render(<RequestItem request={req} isActive={false} />);

      await openMenu(user);
      await user.click(
        screen.getByRole("menuitem", { name: /export as postman/i }),
      );

      expect(downloadPostmanRequest).toHaveBeenCalledWith(req);
    });

    it("copies a cURL command and confirms with a toast", async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /curl/i }));

      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("https://api.example.com/users"),
      );
      vi.unstubAllGlobals();
    });

    it("reports a failure toast when the clipboard rejects", async () => {
      const user = userEvent.setup();
      vi.stubGlobal("navigator", {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) },
      });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /curl/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      vi.unstubAllGlobals();
    });
  });

  describe("context menu actions", () => {
    async function openContext() {
      fireEvent.contextMenu(screen.getByTestId("request-item"));
      await screen.findByText("Actions");
    }

    it("pins from the context menu", async () => {
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openContext();
      fireEvent.click(screen.getByRole("menuitem", { name: /pin to top/i }));

      expect(useSettingsStore.getState().pinnedRequestIds).toEqual(["req-1"]);
    });

    it("unpins from the context menu", async () => {
      useSettingsStore.setState({ pinnedRequestIds: ["req-1"] });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openContext();
      fireEvent.click(screen.getByRole("menuitem", { name: /unpin/i }));

      expect(useSettingsStore.getState().pinnedRequestIds).toEqual([]);
    });

    it("duplicates from the context menu", async () => {
      const req = minimalRequest({ name: "Orig" });
      useCollectionsStore.setState({
        collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
        requests: [req],
      });
      render(<RequestItem request={req} isActive={false} />);

      await openContext();
      fireEvent.click(screen.getByRole("menuitem", { name: /duplicate/i }));

      expect(
        useCollectionsStore
          .getState()
          .requests.some((r) => r.name === "Orig (copy)"),
      ).toBe(true);
    });

    // The menu's list navigation re-focuses the clicked item as it closes; in
    // happy-dom that blur commits the rename at once, while a real browser keeps
    // the autofocused input. Neutralise that focus steal to match the browser.
    it("renames from the context menu", async () => {
      useCollectionsStore.setState({
        collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
        requests: [minimalRequest()],
      });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openContext();
      const renameItem = screen.getByRole("menuitem", { name: /rename/i });
      vi.spyOn(renameItem, "focus").mockImplementation(() => {});
      fireEvent.click(renameItem);

      const input = await screen.findByDisplayValue("Get User");
      fireEvent.change(input, { target: { value: "Fetched User" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(useCollectionsStore.getState().requests[0].name).toBe(
        "Fetched User",
      );
      expect(
        screen.queryByDisplayValue("Fetched User"),
      ).not.toBeInTheDocument();
    });

    it("exports to Postman and opens code gen from the context menu", async () => {
      const req = minimalRequest();
      render(<RequestItem request={req} isActive={false} />);

      await openContext();
      fireEvent.click(
        screen.getByRole("menuitem", { name: /export as postman/i }),
      );
      expect(downloadPostmanRequest).toHaveBeenCalledWith(req);

      await openContext();
      fireEvent.click(
        screen.getByRole("menuitem", { name: /generate code/i }),
      );
      expect(screen.getByTestId("codegen-dialog")).toBeInTheDocument();
    });

    it("copies cURL from the context menu", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      render(<RequestItem request={minimalRequest()} isActive={false} />);

      await openContext();
      fireEvent.click(screen.getByRole("menuitem", { name: /curl/i }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      vi.unstubAllGlobals();
    });

    it("deletes through the confirmation dialog", async () => {
      const req = minimalRequest();
      useCollectionsStore.setState({
        collections: [{ id: "col-1", name: "API", createdAt: 1, updatedAt: 1 }],
        requests: [req],
      });
      render(<RequestItem request={req} isActive={false} />);

      await openContext();
      fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /^yes, delete$/i }));

      await waitFor(() =>
        expect(useCollectionsStore.getState().requests).toHaveLength(0),
      );
    });
  });
});
