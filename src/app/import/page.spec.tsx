/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import ImportPage from "./page";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default({ children, href }: { children: ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: () => null,
}));

function resetCollectionsStore() {
  useCollectionsStore.setState({ collections: [], requests: [] });
}

function resetTabsStore() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCollectionsStore();
    resetTabsStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("parses cURL and opens a tab, then navigates home", async () => {
    const openTabSpy = vi.spyOn(useTabsStore.getState(), "openTab");

    render(<ImportPage />);
    fireEvent.click(screen.getByRole("tab", { name: /cURL import/i }));

    const curlBox = screen.getByRole("textbox", {
      name: /cURL command to import/i,
    });
    fireEvent.change(curlBox, {
      target: { value: "curl -X POST https://api.example.com/items -d '{}'" },
    });

    fireEvent.click(screen.getByRole("button", { name: /import command/i }));

    await waitFor(() => {
      expect(openTabSpy).toHaveBeenCalled();
    });
    const call = openTabSpy.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      type: "http",
      method: "POST",
      url: expect.stringContaining("api.example.com/items"),
    });
    expect(push).toHaveBeenCalledWith("/app");

    const { toast } = await import("sonner");
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });

  it("shows cURL parse error for invalid cURL", async () => {
    render(<ImportPage />);
    fireEvent.click(screen.getByRole("tab", { name: /cURL import/i }));

    fireEvent.change(
      screen.getByRole("textbox", { name: /cURL command to import/i }),
      { target: { value: "not a curl command" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /import command/i }));

    expect(await screen.findByText(/Input must start with/i)).toBeTruthy();
  });

  it("imports Postman collection v2.1 from file upload", async () => {
    const { toast } = await import("sonner");
    render(<ImportPage />);

    const postmanJson = JSON.stringify({
      info: {
        name: "PM Collection",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "List users",
          request: { method: "GET", url: "https://example.com/users" },
        },
      ],
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File([postmanJson], "postman.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections).toHaveLength(1);
    });
    expect(useCollectionsStore.getState().requests).toHaveLength(1);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      expect.stringMatching(/imported/i),
    );
  });

  it("imports Requestly JSON format from file upload", async () => {
    const { toast } = await import("sonner");
    render(<ImportPage />);

    const body = JSON.stringify({
      collections: [
        {
          name: "API",
          requests: [
            { name: "Health", method: "GET", url: "https://a.test/ok" },
          ],
        },
      ],
    });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const rqFile = new File([body], "rq.json", { type: "application/json" });
    fireEvent.change(input, {
      target: { files: [rqFile] },
    });

    await waitFor(() => {
      expect(useCollectionsStore.getState().collections.length).toBeGreaterThan(
        0,
      );
    });
    expect(useCollectionsStore.getState().requests.length).toBeGreaterThan(0);
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
  });

  it("shows error toast for invalid JSON file", async () => {
    const { toast } = await import("sonner");
    render(<ImportPage />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(["{ not json"], "bad.json", { type: "application/json" }),
        ],
      },
    });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });

  it("shows error toast for unsupported JSON shape", async () => {
    const { toast } = await import("sonner");
    render(<ImportPage />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File([JSON.stringify({ unknown: true })], "x.json", {
            type: "application/json",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });

  it("imports Requestly collection from Raw JSON tab", async () => {
    const { toast } = await import("sonner");
    render(<ImportPage />);
    fireEvent.click(screen.getByRole("tab", { name: /raw json/i }));

    const tabPanel = screen.getByRole("tabpanel", { name: /raw json/i });
    const jsonArea = within(tabPanel).getByRole("textbox", {
      name: /raw JSON collection to import/i,
    });
    fireEvent.change(jsonArea, {
      target: {
        value: JSON.stringify({
          collections: [
            {
              name: "From JSON tab",
              requests: [
                { name: "Ping", method: "GET", url: "https://ping.test/" },
              ],
            },
          ],
        }),
      },
    });
    fireEvent.click(
      within(tabPanel).getByRole("button", { name: /import json/i }),
    );

    await waitFor(() => {
      expect(
        useCollectionsStore
          .getState()
          .collections.some((c) => c.name === "From JSON tab"),
      ).toBe(true);
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Collection imported",
    );
  });

  it("shows error toast for invalid JSON in Raw JSON tab", async () => {
    const { toast } = await import("sonner");
    render(<ImportPage />);
    fireEvent.click(screen.getByRole("tab", { name: /raw json/i }));

    const tabPanel = screen.getByRole("tabpanel", { name: /raw json/i });
    fireEvent.change(
      within(tabPanel).getByRole("textbox", {
        name: /raw JSON collection to import/i,
      }),
      { target: { value: "not-json" } },
    );
    fireEvent.click(
      within(tabPanel).getByRole("button", { name: /import json/i }),
    );

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });
});
