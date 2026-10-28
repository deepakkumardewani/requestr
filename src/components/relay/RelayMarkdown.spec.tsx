// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { RequestModel } from "@/types";
import { RelayMarkdown } from "./RelayMarkdown";

const push = vi.hoisted(() => vi.fn());
vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const REQUEST_ID = "req-users_1";
const usersRequest = {
  id: REQUEST_ID,
  name: "List users",
  method: "GET",
  url: "https://api.test/users",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none" },
} as unknown as RequestModel;

function seedWorkspace(requests: RequestModel[] = [usersRequest]) {
  useCollectionsStore.setState({ requests });
  useTabsStore.setState({ tabs: [], activeTabId: null });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RelayMarkdown", () => {
  it("renders raw HTML as literal text, never as markup (FR-23)", () => {
    const { container } = render(
      <RelayMarkdown text={'<img src=x onerror="alert(1)"> <script>boom()</script>'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>boom()</script>");
  });

  it("renders GFM markdown (bold, lists, tables)", () => {
    const { container } = render(
      <RelayMarkdown text={"**hi**\n\n- a\n- b\n\n| h |\n|---|\n| c |"} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("hi");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("renders emphasis (italic) text", () => {
    const { container } = render(<RelayMarkdown text="*italic* and _also italic_" />);
    const emElements = container.querySelectorAll("em");
    expect(emElements).toHaveLength(2);
    expect(Array.from(emElements).map((el) => el.textContent)).toEqual(["italic", "also italic"]);
  });

  it("renders ordered lists", () => {
    const { container } = render(
      <RelayMarkdown text={"1. first\n2. second\n3. third"} />,
    );
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    const items = ol?.querySelectorAll("li");
    expect(items?.length).toBeGreaterThanOrEqual(1);
  });

  it("renders links in a new tab without opener access", () => {
    render(<RelayMarkdown text="[docs](https://example.com)" />);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("drops javascript: link targets", () => {
    render(<RelayMarkdown text="[x](javascript:alert(1))" />);
    expect(screen.queryByRole("link")?.getAttribute("href") ?? "").not.toMatch(
      /^javascript:/i,
    );
  });

  it("drops data: link targets", () => {
    render(<RelayMarkdown text="[x](data:text/html,<img src=x onerror=alert(1)>)" />);
    expect(screen.queryByRole("link")?.getAttribute("href") ?? "").not.toMatch(/^data:/i);
  });

  it("drops uppercase RELAY:// links", () => {
    render(<RelayMarkdown text="[x](RELAY://request/req-1)" />);
    expect(screen.queryByTestId("relay-entity-pill")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not add a copy button to inline code", () => {
    render(<RelayMarkdown text="use `foo()` here" />);
    expect(screen.queryByTestId("relay-copy-code")).toBeNull();
  });

  it("copies a fenced code block's text and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<RelayMarkdown text={"```json\n{\"a\": 1}\n```"} />);

    fireEvent.click(screen.getByTestId("relay-copy-code"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('{"a": 1}'));
    expect(screen.getByTestId("relay-copy-code")).toHaveAttribute("aria-label", "Copied");
  });

  it("keeps the label unchanged and logs when the clipboard rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<RelayMarkdown text={"```\nx\n```"} />);

    fireEvent.click(screen.getByTestId("relay-copy-code"));

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByTestId("relay-copy-code")).toHaveAttribute("aria-label", "Copy code");
    error.mockRestore();
  });

  it("highlights a fenced json block and keeps its text intact (FR-183)", async () => {
    render(<RelayMarkdown text={"```json\n{\"a\": 1}\n```"} />);

    const code = screen.getByTestId("relay-code-block").querySelector("code");
    expect(code).toHaveTextContent('{"a": 1}');
    await waitFor(() => expect(code).toHaveAttribute("data-highlighted", "true"));
    expect(code?.querySelectorAll("span").length).toBeGreaterThan(0);
    expect(code).toHaveTextContent('{"a": 1}');
    expect(screen.getByTestId("relay-copy-code")).toHaveAttribute("aria-label", "Copy code");
  });

  it("shows other languages as plain text", async () => {
    render(<RelayMarkdown text={"```graphql\nquery { me }\n```"} />);

    const code = screen.getByTestId("relay-code-block").querySelector("code");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(code).toHaveAttribute("data-highlighted", "false");
    expect(code).toHaveTextContent("query { me }");
  });

  it("renders an empty code fence as an empty code block", () => {
    render(<RelayMarkdown text={"```\n```"} />);
    const code = screen.getByTestId("relay-code-block").querySelector("code");
    expect(code?.textContent).toBe("");
    expect(screen.getByTestId("relay-copy-code")).toBeInTheDocument();
  });

  it("never renders code content as markup", () => {
    const { container } = render(
      <RelayMarkdown text={"```html\n<img src=x onerror=alert(1)>\n```"} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders an unterminated code fence mid-stream without throwing", () => {
    expect(() => render(<RelayMarkdown text={"```ts\nconst a ="} />)).not.toThrow();
    expect(screen.getByTestId("relay-copy-code")).toBeInTheDocument();
  });

  describe("relay:// pills (FR-180)", () => {
    it("renders a resolvable request link as a pill with a method badge", () => {
      seedWorkspace();
      render(<RelayMarkdown text={`[users](relay://request/${REQUEST_ID})`} />);
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill.tagName).toBe("BUTTON");
      expect(pill).toHaveTextContent("List users");
      expect(screen.getByTestId("relay-pill-method")).toHaveTextContent("GET");
    });

    it("opens the request tab when the pill is clicked", async () => {
      seedWorkspace();
      render(<RelayMarkdown text={`[users](relay://request/${REQUEST_ID})`} />);
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() =>
        expect(useTabsStore.getState().tabs.map((tab) => tab.requestId)).toEqual([
          REQUEST_ID,
        ]),
      );
    });

    it("renders an unknown id as plain label text, not a link", () => {
      seedWorkspace([]);
      render(<RelayMarkdown text="see [gone](relay://request/missing-1)" />);
      expect(screen.queryByTestId("relay-entity-pill")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("gone")).toBeInTheDocument();
    });

    it("does not linkify unknown relay:// kinds or javascript: links", () => {
      seedWorkspace();
      render(
        <RelayMarkdown
          text={"[a](relay://secret/abc) [b](javascript:alert(1)) [c](relay://request/bad%20id)"}
        />,
      );
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByText("a")).toBeInTheDocument();
    });
  });

  describe("method and status colour (FR-181)", () => {
    it("wraps method and status tokens in spans and keeps their text", () => {
      const { container } = render(
        <RelayMarkdown text="GET works, POST gets 404 or 500." />,
      );
      expect(screen.getAllByTestId("relay-method").map((n) => n.textContent)).toEqual([
        "GET",
        "POST",
      ]);
      expect(screen.getAllByTestId("relay-status").map((n) => n.textContent)).toEqual([
        "404",
        "500",
      ]);
      expect(container.textContent).toBe("GET works, POST gets 404 or 500.");
    });

    it("leaves tokens inside code blocks and inline code untouched", () => {
      render(<RelayMarkdown text={"use `GET 404` here\n\n```\nPOST 500\n```"} />);
      expect(screen.queryByTestId("relay-method")).toBeNull();
      expect(screen.queryByTestId("relay-status")).toBeNull();
    });

    it("keeps all inline code neutral (CONV-07)", () => {
      const { container } = render(
        <RelayMarkdown text="edit `src/app.ts` or call `run()`" />,
      );
      const [file, call] = Array.from(container.querySelectorAll("code"));
      expect(file.className).not.toContain("text-primary");
      expect(call.className).not.toContain("text-primary");
      expect(file.className).toBe(call.className);
    });
  });

  describe("memoization", () => {
    it("RelayMarkdown is a memoized component", () => {
      // Verify RelayMarkdown is a memo exotic component
      expect((RelayMarkdown as any).$$typeof).toBe(Symbol.for("react.memo"));
      // The component has an inner type with a name
      expect((RelayMarkdown as any).type).toBeDefined();
    });

    it("renders whitespace-only text and does not throw", () => {
      // Whitespace-only input should render without error
      const { container } = render(<RelayMarkdown text={"   \n\n   "} />);
      // Whitespace-only content renders as empty (remark strips it)
      expect(container.querySelector("p")).toBeNull();
      expect(container.textContent?.trim()).toBe("");
    });
  });

  describe("edge cases and content handling", () => {
    it("renders very long text without throwing", () => {
      const longText = "word ".repeat(1000);
      render(<RelayMarkdown text={longText} />);
      expect(screen.getByText(/word/).textContent).toContain("word");
    });

    it("renders mixed markdown and plain text correctly", () => {
      const { container } = render(
        <RelayMarkdown text="Here is **bold** and plain text and *italic*." />,
      );
      expect(container.querySelector("strong")?.textContent).toBe("bold");
      expect(container.querySelector("em")?.textContent).toBe("italic");
      expect(container.textContent).toContain("Here is");
      expect(container.textContent).toContain("and plain text");
    });

    it("handles nested lists with mixed types", () => {
      const { container } = render(
        <RelayMarkdown text={"1. first\n   - nested bullet\n2. second"} />,
      );
      // Verify nested structure: ul inside ol
      const nestedUl = container.querySelector("ol ul");
      expect(nestedUl).not.toBeNull();
    });

    it("preserves text structure in complex nested elements", () => {
      const { container } = render(
        <RelayMarkdown text="**Bold [link](https://example.com) text**" />,
      );
      expect(container.querySelector("strong")).toBeInTheDocument();
      expect(container.querySelector("a")).toBeInTheDocument();
    });
  });
});
