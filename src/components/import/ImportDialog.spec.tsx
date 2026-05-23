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
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useCollectionsStore.setState({ collections: [], requests: [] });
});

describe("ImportDialog", () => {
  it("imports valid cURL into a new tab and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ImportDialog open onClose={onClose} />);

    const textarea = screen.getByPlaceholderText(/Paste cURL command/i);
    await user.type(textarea, "curl https://api.example.com/items");

    await user.click(screen.getByRole("button", { name: /Import cURL/i }));

    await waitFor(() => {
      expect(useTabsStore.getState().tabs.length).toBe(1);
    });
    expect(useTabsStore.getState().tabs[0]?.url).toBe(
      "https://api.example.com/items",
    );
    expect(toast.success).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows cURL parse error when parseCurl throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(curlParser, "parseCurl").mockImplementation(() => {
      throw new curlParser.CurlParseError("bad curl");
    });

    render(<ImportDialog open onClose={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/Paste cURL command/i);
    await user.type(textarea, "x");

    await user.click(screen.getByRole("button", { name: /Import cURL/i }));

    expect(await screen.findByText("bad curl")).toBeInTheDocument();
  });

  it("import button only appears when cURL field is non-empty", async () => {
    const user = userEvent.setup();
    render(<ImportDialog open onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Import cURL/i }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/Paste cURL command/i),
      "curl x",
    );

    expect(
      screen.getByRole("button", { name: /Import cURL/i }),
    ).toBeInTheDocument();
  });

  it("Cancel invokes onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ImportDialog open onClose={onClose} />);

    await user.type(screen.getByPlaceholderText(/Paste cURL command/i), "x");
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("drops Postman JSON file and creates collection", async () => {
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

    render(<ImportDialog open onClose={vi.fn()} />);

    const zone = screen.getByText("Drop file here").closest("div")!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File([postmanJson], "c.json")] },
    });

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
    });
    expect(toast.success).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("toast error on unrecognized JSON file", async () => {
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

    render(<ImportDialog open onClose={vi.fn()} />);

    const zone = screen.getByText("Drop file here").closest("div")!;
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File([bad], "x.json")] },
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    vi.unstubAllGlobals();
  });
});
