/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelayMarkdown } from "./RelayMarkdown";

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

  it("does not add a copy button to inline code", () => {
    render(<RelayMarkdown text="use `foo()` here" />);
    expect(screen.queryByTestId("relay-copy-code")).toBeNull();
  });

  it("copies a fenced code block's text and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<RelayMarkdown text={"```json\n{\"a\": 1}\n```"} />);

    fireEvent.click(screen.getByRole("button", { name: "copyCode" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('{"a": 1}'));
    expect(await screen.findByRole("button", { name: "copied" })).toBeInTheDocument();
  });

  it("keeps the label unchanged and logs when the clipboard rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<RelayMarkdown text={"```\nx\n```"} />);

    fireEvent.click(screen.getByRole("button", { name: "copyCode" }));

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "copyCode" })).toBeInTheDocument();
    error.mockRestore();
  });

  it("renders an unterminated code fence mid-stream without throwing", () => {
    expect(() => render(<RelayMarkdown text={"```ts\nconst a ="} />)).not.toThrow();
    expect(screen.getByTestId("relay-copy-code")).toBeInTheDocument();
  });
});
