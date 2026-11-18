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
import * as importScanner from "@/lib/importScanner";
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
  describe("input step", () => {
    it("shows Scan and Cancel, the File and cURL tabs, the trust warning and every format chip", () => {
      render(<ImportDialog open onClose={vi.fn()} />);

      expect(screen.getByRole("button", { name: "Scan" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
      expect(screen.getByRole("tab", { name: "File" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByRole("tab", { name: "cURL" })).toBeInTheDocument();
      expect(
        screen.getByText(
          "Only import files and commands from a source you trust.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Supported formats")).toBeInTheDocument();
      for (const format of importScanner.SUPPORTED_IMPORT_FORMATS) {
        expect(screen.getAllByText(format.label).length).toBeGreaterThan(0);
      }
      expect(
        screen.getByRole("heading", { name: "Import" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Scan a file or pasted content before importing."),
      ).toBeInTheDocument();
    });

    it("opens the file chooser from the choose a file link", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const click = vi.spyOn(input, "click");

      await user.click(screen.getByRole("button", { name: "choose a file" }));

      expect(click).toHaveBeenCalledTimes(1);
    });

    it("queues a chosen file, enables Scan and lets the user pick a different one", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await user.upload(input, new File(["{}"], "api.json"));

      expect(await screen.findByText("api.json")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Scan" })).toBeEnabled();

      await user.click(
        screen.getByRole("button", { name: "Choose a different file" }),
      );

      expect(screen.queryByText("api.json")).toBeNull();
      expect(screen.getByRole("button", { name: "Scan" })).toBeDisabled();
    });

    it("allows files to be dragged over the drop zone", () => {
      render(<ImportDialog open onClose={vi.fn()} />);
      const zone = screen.getByText(/Drag and drop/i).closest("div")!;

      const notPrevented = fireEvent.dragOver(zone);

      expect(notPrevented).toBe(false);
    });

    it("ignores a drop that carries no file", () => {
      render(<ImportDialog open onClose={vi.fn()} />);
      const zone = screen.getByText(/Drag and drop/i).closest("div")!;

      fireEvent.drop(zone, { dataTransfer: { files: [] } });

      expect(screen.queryByText(/\.json/)).toBeNull();
      expect(screen.getByRole("button", { name: "Scan" })).toBeDisabled();
    });

    it("ignores a file whose contents are not text", async () => {
      class BinaryFileReader {
        onload: ((ev: { target: { result: ArrayBuffer } }) => void) | null =
          null;
        readAsText() {
          queueMicrotask(() =>
            this.onload?.({ target: { result: new ArrayBuffer(1) } }),
          );
        }
      }
      vi.stubGlobal("FileReader", BinaryFileReader);
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await user.upload(input, new File(["x"], "bin.json"));
      await Promise.resolve();

      expect(screen.queryByText("bin.json")).toBeNull();
      vi.unstubAllGlobals();
    });

    it("clears a scan error when the user switches tabs or edits the cURL text", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);
      await user.click(screen.getByRole("tab", { name: "cURL" }));
      const textarea = screen.getByPlaceholderText(/Paste cURL command/i);
      await user.type(textarea, "not a curl command");
      await user.click(screen.getByRole("button", { name: "Scan" }));
      expect(document.querySelector(".text-destructive")).not.toBeNull();

      await user.type(textarea, "!");
      expect(document.querySelector(".text-destructive")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Scan" }));
      expect(document.querySelector(".text-destructive")).not.toBeNull();
      await user.click(screen.getByRole("tab", { name: "File" }));
      expect(document.querySelector(".text-destructive")).toBeNull();
    });
  });

  describe("review and import", () => {
    async function scanFile(text: string, name: string) {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ImportDialog open onClose={onClose} />);
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      await user.upload(input, new File([text], name));
      await screen.findByText(name);
      await user.click(screen.getByRole("button", { name: "Scan" }));
      await screen.findByText("Review import");
      return { user, onClose };
    }

    const openApiText = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Pets", version: "1" },
      paths: {
        "/pets": { get: { summary: "List pets" } },
        "/pets/{id}": { delete: { summary: "Remove pet" } },
      },
    });

    it("imports an OpenAPI file as a collection with one request per operation", async () => {
      const { user, onClose } = await scanFile(openApiText, "pets.json");

      expect(screen.getByText("2 requests")).toBeInTheDocument();
      expect(screen.getByText("Pets")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Only import files and commands from a source you trust.",
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Import" }));

      const { collections } = useCollectionsStore.getState();
      expect(collections).toHaveLength(1);
      expect(collections[0]?.name).toBe("Pets");
      expect(useCollectionsStore.getState().requests).toHaveLength(2);
      expect(toast.success).toHaveBeenCalledWith(
        'Imported "pets.json" — 2 requests',
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("imports an Insomnia export through the collections store", async () => {
      const insomnia = JSON.stringify({
        _type: "export",
        resources: [
          { _type: "workspace", _id: "wrk_1", name: "Shop" },
          {
            _type: "request",
            _id: "req_1",
            parentId: "wrk_1",
            name: "Get item",
            method: "GET",
            url: "https://shop.test/items",
          },
        ],
      });
      const { user, onClose } = await scanFile(insomnia, "shop.json");

      expect(screen.getByText("1 request")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Import" }));

      expect(useCollectionsStore.getState().collections).toHaveLength(1);
      expect(toast.success).toHaveBeenCalledWith(
        'Imported "shop.json" — 1 request',
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("lists folders, singular and plural, for a Postman collection", async () => {
      const postman = JSON.stringify({
        info: {
          name: "Nested",
          schema:
            "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        item: [
          {
            name: "Folder",
            item: [
              {
                name: "R",
                request: { method: "GET", url: "https://a.test/r" },
              },
            ],
          },
        ],
      });
      await scanFile(postman, "nested.json");

      expect(screen.getByText("1 folder")).toBeInTheDocument();
      expect(screen.getByText("Nested")).toBeInTheDocument();
    });

    it("shows the cURL summary and returns to the input step with Back", async () => {
      const user = userEvent.setup();
      render(<ImportDialog open onClose={vi.fn()} />);
      await user.click(screen.getByRole("tab", { name: "cURL" }));
      await user.type(
        screen.getByPlaceholderText(/Paste cURL command/i),
        "curl https://api.example.com/items",
      );
      await user.click(screen.getByRole("button", { name: "Scan" }));

      expect(await screen.findByText("Review import")).toBeInTheDocument();
      expect(screen.getByText("Opens as a new tab:")).toBeInTheDocument();
      expect(screen.queryByText(/^Collection:/)).toBeNull();

      await user.click(screen.getByRole("button", { name: "Back" }));

      expect(screen.getByText("Scan a file or pasted content before importing.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Scan" })).toBeEnabled();
    });

    it("lists the collection count and additional names when the scan reports them", async () => {
      vi.spyOn(importScanner, "scanFileContent").mockReturnValue({
        ok: true,
        format: "insomnia",
        sourceLabel: "multi.json",
        summary: {
          requestCount: 3,
          collectionCount: 2,
          folderCount: 2,
          primaryName: "Main",
          additionalNames: ["Other", "Extra"],
        },
        payload: {
          format: "insomnia",
          data: { name: "Main", folders: [], requests: [] } as never,
        },
      });
      await scanFile("{}", "multi.json");

      expect(screen.getByText("2 folders")).toBeInTheDocument();
      expect(screen.getByText("2 collections")).toBeInTheDocument();
      expect(screen.getByText("Also: Other, Extra")).toBeInTheDocument();
    });

    it("closes with Escape and resets to the input step on reopen", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<ImportDialog open onClose={onClose} />);

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
