// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./CodeBlock";

vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const highlightCode = vi.hoisted(() => vi.fn());
vi.mock("@/lib/relay/codeHighlight", () => ({ highlightCode }));
vi.mock("./ApplyCodeAction", () => ({
  ApplyCodeAction: ({ code }: { code: string }) => <div data-testid="apply-stub" data-code={code} />,
}));

const writeText = vi.fn();

beforeEach(() => {
  highlightCode.mockReset();
  highlightCode.mockResolvedValue(null);
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CodeBlock", () => {
  it("shows plain text while the highlighter loads", () => {
    highlightCode.mockReturnValue(new Promise(() => {}));
    render(<CodeBlock code={'{"a":1}'} language="json" />);
    const code = screen.getByText('{"a":1}');
    expect(code.tagName).toBe("CODE");
    expect(code).toHaveAttribute("data-highlighted", "false");
    expect(code).toHaveClass("language-json");
  });

  it("renders highlighted segments once loaded, keeping the text", async () => {
    highlightCode.mockResolvedValue([
      { text: "{", className: "tok-punct" },
      { text: "}", className: null },
    ]);
    const { container } = render(<CodeBlock code="{}" language="json" />);
    await waitFor(() =>
      expect(container.querySelector("code")).toHaveAttribute("data-highlighted", "true"),
    );
    const spans = container.querySelectorAll("code > span");
    expect(spans).toHaveLength(2);
    expect(spans[0]).toHaveClass("tok-punct");
    expect(container.querySelector("code")?.textContent).toBe("{}");
  });

  it("falls back to plain text when no grammar applies", async () => {
    const { container } = render(<CodeBlock code="hello" language={null} />);
    await waitFor(() => expect(highlightCode).toHaveBeenCalledWith("hello", null));
    const code = container.querySelector("code");
    expect(code).toHaveAttribute("data-highlighted", "false");
    expect(code).not.toHaveAttribute("class");
    expect(code?.textContent).toBe("hello");
  });

  it("never shows segments computed for earlier code", async () => {
    highlightCode.mockResolvedValue([{ text: "a", className: "x" }]);
    const { container, rerender } = render(<CodeBlock code="a" language="json" />);
    await waitFor(() =>
      expect(container.querySelector("code")).toHaveAttribute("data-highlighted", "true"),
    );
    highlightCode.mockReturnValue(new Promise(() => {}));
    rerender(<CodeBlock code="ab" language="json" />);
    const code = container.querySelector("code");
    expect(code).toHaveAttribute("data-highlighted", "false");
    expect(code?.textContent).toBe("ab");
  });

  it("ignores a highlight result that resolves after unmount", async () => {
    let resolve: (v: null) => void = () => {};
    highlightCode.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { unmount } = render(<CodeBlock code="a" language="json" />);
    unmount();
    await act(async () => resolve(null));
    expect(screen.queryByTestId("relay-code-block")).toBeNull();
  });

  it("has a Copy button with an accessible name that copies the code", async () => {
    render(<CodeBlock code="echo hi" language="sh" />);
    const button = screen.getByRole("button", { name: "Copy code" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("echo hi");
  });

  it("restores the Copy label after the confirmation timeout", async () => {
    vi.useFakeTimers();
    render(<CodeBlock code="x" language={null} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("relay-copy-code"));
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("restarts the reset timer when copied twice quickly", async () => {
    vi.useFakeTimers();
    render(<CodeBlock code="x" language={null} />);
    const click = async () =>
      act(async () => {
        fireEvent.click(screen.getByTestId("relay-copy-code"));
      });
    await click();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await click();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("keeps the Copy label and logs when the clipboard rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    writeText.mockRejectedValue(new Error("denied"));
    render(<CodeBlock code="x" language={null} />);
    fireEvent.click(screen.getByTestId("relay-copy-code"));
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith("[relay] copy code failed", expect.any(Error)),
    );
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("renders the apply action for the same code", () => {
    render(<CodeBlock code="payload" language="json" />);
    expect(screen.getByTestId("apply-stub")).toHaveAttribute("data-code", "payload");
  });
});
