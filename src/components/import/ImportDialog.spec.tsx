/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as curlParser from "@/lib/curlParser";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { ImportDialog } from "./ImportDialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useCollectionsStore.setState({ collections: [], requests: [] });
});

describe("ImportDialog", () => {
  it("scans and imports valid cURL into a new tab", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ImportDialog open onClose={onClose} />);

    await user.click(screen.getByRole("tab", { name: /cURL/i }));

    const textarea = screen.getByPlaceholderText(/Paste cURL command/i);
    await user.type(textarea, "curl https://api.example.com/items");

    await user.click(screen.getByRole("button", { name: /^Scan$/i }));
    expect(await screen.findByText(/Review import/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Import$/i }));

    await waitFor(() => {
      expect(useTabsStore.getState().tabs.length).toBe(1);
    });
    expect(useTabsStore.getState().tabs[0]?.url).toBe(
      "https://api.example.com/items",
    );
    expect(toast.success).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows cURL parse error after scan when parseCurl throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(curlParser, "parseCurl").mockImplementation(() => {
      throw new curlParser.CurlParseError("bad curl");
    });

    render(<ImportDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /cURL/i }));
    const textarea = screen.getByPlaceholderText(/Paste cURL command/i);
    await user.type(textarea, "x");

    await user.click(screen.getByRole("button", { name: /^Scan$/i }));

    expect(await screen.findByText("bad curl")).toBeInTheDocument();
  });

  it("Scan button stays disabled until file or text is provided", async () => {
    const user = userEvent.setup();
    render(<ImportDialog open onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^Scan$/i })).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: /cURL/i }));
    await user.type(screen.getByPlaceholderText(/Paste cURL command/i), "curl x");

    expect(screen.getByRole("button", { name: /^Scan$/i })).toBeEnabled();
  });

  it("Cancel invokes onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ImportDialog open onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("scans Postman JSON file then imports on confirm", async () => {
    const postmanJson = JSON.stringify({
      info: {
        name: "API",
        _postman_id: "abc-123",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "Get users",
          request: {
            method: "GET",
            url: "https://api.example.com/users",
          },
        },
      ],
    });

    class MockFileReader {
      result = postmanJson;
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      readAsText() {
        queueMicrotask(() => {
          this.onload?.({ target: { result: this.result } });
        });
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const user = userEvent.setup();
    render(<ImportDialog open onClose={vi.fn()} />);

    const zone = screen.getByText(/Drag and drop/i).closest("div")!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File([postmanJson], "c.json")] },
    });

    await waitFor(() => {
      expect(screen.getByText("c.json")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^Scan$/i }));
    expect(await screen.findByText(/1 request/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Import$/i }));

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
    });
    expect(toast.success).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows scan error on unrecognized JSON file", async () => {
    const bad = '{"not":"postman"}';

    class MockFileReader {
      result = bad;
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      readAsText() {
        queueMicrotask(() => {
          this.onload?.({ target: { result: this.result } });
        });
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const user = userEvent.setup();
    render(<ImportDialog open onClose={vi.fn()} />);

    const zone = screen.getByText(/Drag and drop/i).closest("div")!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File([bad], "x.json")] },
    });

    await waitFor(() => {
      expect(screen.getByText("x.json")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^Scan$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unrecognized format/i)).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  describe("file formats and state handling", () => {
    const insomniaV4 = JSON.stringify({
      _type: "export",
      __export_format: 4,
      resources: [
        { _type: "workspace", _id: "w1", name: "Insomnia API" },
        { _type: "request_group", _id: "g1", name: "Users", parentId: "w1" },
        {
          _type: "request",
          _id: "r1",
          parentId: "g1",
          name: "List users",
          method: "GET",
          url: "https://api.example.com/users",
          headers: [],
          body: {},
        },
        {
          _type: "request",
          _id: "r2",
          parentId: "w1",
          name: "Health",
          method: "GET",
          url: "https://api.example.com/health",
          headers: [],
          body: {},
        },
      ],
    });
    const openApiJson = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Pet Store", version: "1.0.0" },
      servers: [{ url: "https://pets.example.com" }],
      paths: {
        "/pets": {
          get: { summary: "List pets", responses: { "200": { description: "ok" } } },
          post: { summary: "Add pet", responses: { "201": { description: "ok" } } },
        },
      },
    });

    async function dropFile(content: string, name: string) {
      const zone = screen.getByText(/Drag and drop/i).closest("div")!;
      fireEvent.drop(zone, {
        dataTransfer: { files: [new File([content], name)] },
      });
      expect(await screen.findByText(name)).toBeInTheDocument();
    }

    it("imports an Insomnia export as a collection and toasts", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ImportDialog open onClose={onClose} />);

      await dropFile(insomniaV4, "insomnia.json");
      await user.click(screen.getByRole("button", { name: /^Scan$/i }));

      expect(await screen.findByText(/Insomnia resources from/i)).toBeInTheDocument();
      expect(screen.getByText("2 requests")).toBeInTheDocument();
      expect(screen.getByText("1 folder")).toBeInTheDocument();
      expect(screen.getByText("Insomnia API")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^Import$/i }));

      const state = useCollectionsStore.getState();
      expect(state.collections.map((c) => c.name)).toContain("Insomnia API");
      expect(state.requests.map((r) => r.name)).toEqual(
        expect.arrayContaining(["List users", "Health"]),
      );
      expect(toast.success).toHaveBeenCalledWith(
        'Imported "insomnia.json" \u2014 2 requests',
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("imports an OpenAPI spec into a new collection with one request per operation", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ImportDialog open onClose={onClose} />);

      await dropFile(openApiJson, "pets.json");
      await user.click(screen.getByRole("button", { name: /^Scan$/i }));

      expect(await screen.findByText(/OpenAPI \/ Swagger resources from/i)).toBeInTheDocument();
      expect(screen.getByText("2 requests")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^Import$/i }));

      const state = useCollectionsStore.getState();
      expect(state.collections).toHaveLength(1);
      expect(state.collections[0]?.name).toBe("Pet Store");
      expect(state.requests).toHaveLength(2);
      expect(state.requests.every((r) => r.url.includes("pets.example.com"))).toBe(true);
      expect(toast.success).toHaveBeenCalledWith(
        'Imported "pets.json" \u2014 2 requests',
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("leaves stores untouched and keeps dialog open when the scan fails", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ImportDialog open onClose={onClose} />);

      await dropFile('{"not":"importable"}', "bad.json");
      await user.click(screen.getByRole("button", { name: /^Scan$/i }));

      expect(await screen.findByText(/Unrecognized format/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Import$/i })).not.toBeInTheDocument();
      expect(useCollectionsStore.getState().collections).toEqual([]);
      expect(useCollectionsStore.getState().requests).toEqual([]);
      expect(useTabsStore.getState().tabs).toEqual([]);
      expect(toast.success).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("Back from review returns to input with the chosen file retained", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);

      await dropFile(openApiJson, "pets.json");
      await user.click(screen.getByRole("button", { name: /^Scan$/i }));
      await screen.findByText(/Review import/i);

      await user.click(screen.getByRole("button", { name: /^Back$/i }));

      expect(screen.getByText("pets.json")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Scan$/i })).toBeEnabled();
      expect(useCollectionsStore.getState().collections).toEqual([]);
    });

    it("ignores a drop that carries no files", () => {
      render(<ImportDialog open onClose={vi.fn()} />);

      const zone = screen.getByText(/Drag and drop/i).closest("div")!;
      fireEvent.drop(zone, { dataTransfer: { files: [] } });

      expect(screen.getByText(/Drag and drop/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Scan$/i })).toBeDisabled();
    });

    it("Choose a different file clears the queued file and disables Scan", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);

      await dropFile(openApiJson, "pets.json");
      await user.click(screen.getByRole("button", { name: /choose a different file/i }));

      expect(screen.queryByText("pets.json")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Scan$/i })).toBeDisabled();
    });

    it("switching tabs clears a previous scan error", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);

      await user.click(screen.getByRole("tab", { name: /cURL/i }));
      await user.type(screen.getByPlaceholderText(/Paste cURL command/i), "not curl");
      await user.click(screen.getByRole("button", { name: /^Scan$/i }));
      expect(await screen.findByText(/Input must start with/i)).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: /^File$/i }));

      expect(screen.queryByText(/Input must start with/i)).not.toBeInTheDocument();
    });

    it("closing via Cancel discards the queued file for the next open", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ImportDialog open onClose={vi.fn()} />);

      await dropFile(openApiJson, "pets.json");
      await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
      rerender(<ImportDialog open={false} onClose={vi.fn()} />);
      rerender(<ImportDialog open onClose={vi.fn()} />);

      expect(screen.queryByText("pets.json")).not.toBeInTheDocument();
      expect(screen.getByText(/Drag and drop/i)).toBeInTheDocument();
    });
  });
});
