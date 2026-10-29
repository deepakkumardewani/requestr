/** @vitest-environment happy-dom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAI", () => ({
  useAI: vi.fn(() => ({
    run: vi.fn().mockResolvedValue({ explanation: "AI says: bad token." }),
    loading: false,
    error: null,
    reset: vi.fn(),
  })),
}));
import { useAI } from "@/hooks/useAI";
import { useRelayStore } from "@/stores/useRelayStore";
import { ErrorExplainer } from "./ErrorExplainer";

afterEach(() => {
  cleanup();
});

describe("ErrorExplainer", () => {
  it("renders children only when status is below 400", () => {
    render(
      <ErrorExplainer status={200} body="" responseKey={1}>
        <span>OK</span>
      </ErrorExplainer>,
    );

    expect(screen.queryByTestId("error-explainer")).not.toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("opens popover with explanation title after hover", async () => {
    const user = userEvent.setup();

    render(
      <ErrorExplainer status={404} body="" responseKey={1}>
        <span>Not found</span>
      </ErrorExplainer>,
    );

    await user.hover(screen.getByTestId("error-explainer-trigger"));

    expect(
      await screen.findByTestId("error-explainer-title"),
    ).toHaveTextContent("Why did this fail?");
    expect(screen.getByText("404 Not Found")).toBeInTheDocument();
  });

  it("shows matched body-pattern hints", async () => {
    const user = userEvent.setup();

    render(
      <ErrorExplainer
        status={401}
        body='{"error":"invalid_token"}'
        responseKey={1}
      >
        <span>Auth</span>
      </ErrorExplainer>,
    );

    await user.hover(screen.getByTestId("error-explainer-trigger"));

    expect(
      await screen.findByText(
        /The token format is incorrect — check the expected format/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows AI insight link inside known-error popover and renders result on click", async () => {
    const mockRun = vi.fn().mockResolvedValue({ explanation: "Token expired." });
    vi.mocked(useAI).mockReturnValue({
      run: mockRun,
      loading: false,
      error: null,
      reset: vi.fn(),
    });

    const user = userEvent.setup();

    render(
      <ErrorExplainer status={401} body="" responseKey={1}>
        <span>Auth</span>
      </ErrorExplainer>,
    );

    await user.hover(screen.getByTestId("error-explainer-trigger"));
    await screen.findByTestId("error-explainer-content");

    const aiLink = screen.getByTestId("ai-insight-link");
    expect(aiLink).toBeInTheDocument();

    await user.click(aiLink);

    await waitFor(() => {
      expect(screen.getByTestId("ai-explanation")).toHaveTextContent("Token expired.");
    });
  });

  it("renders AI-only popover for unknown error codes (no static explanation)", async () => {
    const mockRun = vi.fn().mockResolvedValue({ explanation: "Custom error." });
    vi.mocked(useAI).mockReturnValue({
      run: mockRun,
      loading: false,
      error: null,
      reset: vi.fn(),
    });

    const user = userEvent.setup();

    render(
      <ErrorExplainer status={599} body="" responseKey={1}>
        <span>Custom</span>
      </ErrorExplainer>,
    );

    expect(screen.getByTestId("error-explainer")).toBeInTheDocument();
    const aiBtn = screen.getByTestId("ai-explain-btn");
    expect(aiBtn).toBeInTheDocument();

    await user.click(aiBtn);

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 599 }),
      );
    });
  });

  it("dismiss hides explainer until responseKey changes", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorExplainer status={403} body="" responseKey={1}>
        <span>X</span>
      </ErrorExplainer>,
    );

    await user.hover(screen.getByTestId("error-explainer-trigger"));
    await screen.findByTestId("error-explainer-content");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByTestId("error-explainer")).not.toBeInTheDocument();
    });

    rerender(
      <ErrorExplainer status={403} body="" responseKey={2}>
        <span>X</span>
      </ErrorExplainer>,
    );

    expect(screen.getByTestId("error-explainer")).toBeInTheDocument();
  });

  it("offers Open in Relay with the error context beside the AI action", async () => {
    const user = userEvent.setup();
    useRelayStore.setState({ open: false, composerDraft: null });

    render(
      <ErrorExplainer status={599} body="boom" responseKey={1}>
        <span>Custom</span>
      </ErrorExplainer>,
    );
    await user.click(screen.getByTestId("open-in-relay-btn"));

    const state = useRelayStore.getState();
    const prefill = (useRelayStore.getState().composerDraft ?? [])
      .map((segment) => (segment.type === "text" ? segment.text : ""))
      .join("");
    expect(state.open).toBe(true);
    expect(prefill).toContain("Status: 599");
    expect(prefill).toContain("boom");
    expect(screen.getByTestId("ai-explain-btn")).toBeInTheDocument();
  });
});
