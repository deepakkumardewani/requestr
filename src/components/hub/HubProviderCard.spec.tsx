/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HubMeta } from "@/types/hub";
import { HubProviderCard } from "./HubProviderCard";

const importHubEntryMock = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => (
    <span data-testid="mock-image">{props.alt}</span>
  ),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const markImported = vi.fn();

vi.mock("@/hooks/useImportedHubSlugs", () => ({
  useImportedHubSlugs: () => ({
    importedSlugs: new Set<string>(),
    markImported,
  }),
}));

vi.mock("@/lib/hub", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/hub")>();
  return {
    ...mod,
    importHubEntry: importHubEntryMock,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const meta: HubMeta = {
  name: "Demo API",
  providerName: "Demo",
  description: "Hub description",
  category: "rest",
  logoUrl: "https://logo.test/x.png",
  docsUrl: "https://docs.test",
  specUrl: "https://spec.test",
  requestCount: 2,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HubProviderCard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("collection.json")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "c1",
                name: "C",
                createdAt: 1,
                requests: [
                  {
                    id: "r1",
                    name: "Get",
                    method: "GET",
                    url: "https://api.test",
                    headers: [],
                    params: [],
                    body: { type: "text", content: "" },
                  },
                ],
              }),
          });
        }
        if (url.includes("environment.json")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "e1",
                name: "Default",
                variables: [],
              }),
          });
        }
        return Promise.resolve({ ok: false });
      }),
    );
  });

  it("renders provider meta and completes import", async () => {
    const user = userEvent.setup();

    render(<HubProviderCard slug="demo" meta={meta} />);

    expect(screen.getByText("Demo API")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /docs/i })).toHaveAttribute(
      "href",
      "https://docs.test",
    );

    await user.click(screen.getByRole("button", { name: /^Import$/i }));

    await waitFor(() => {
      expect(importHubEntryMock).toHaveBeenCalled();
    });
    expect(markImported).toHaveBeenCalledWith("demo");
    expect(toast.success).toHaveBeenCalled();
  });

  it("wraps the footer so the Import button is not clipped", () => {
    render(<HubProviderCard slug="demo" meta={meta} />);

    const footer = screen.getByRole("button", { name: /^Import$/i })
      .parentElement;
    expect(footer).toHaveClass("flex-wrap");
  });

  it("toast error when hub JSON fetch fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<HubProviderCard slug="bad" meta={meta} />);

    await user.click(screen.getByRole("button", { name: /^Import$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
