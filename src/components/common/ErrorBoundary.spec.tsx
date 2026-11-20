/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const captureMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/adapter", () => ({
  captureScrubbedError: captureMock,
}));

const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

let passRender = false;

function MaybeThrow() {
  if (!passRender) throw new Error("boom");
  return <span>ok</span>;
}

afterEach(() => {
  cleanup();
  consoleError.mockClear();
  captureMock.mockClear();
  passRender = false;
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    passRender = true;
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("shows fallback and recovers after Try again when child stops throwing", () => {
    passRender = false;
    render(
      <ErrorBoundary fallbackTitle="Oops">
        <MaybeThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Oops")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();

    passRender = true;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("captures exactly one boundary error with the thrown error only", () => {
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    expect(captureMock).toHaveBeenCalledTimes(1);
    const [error, source, ...rest] = captureMock.mock.calls[0];
    expect((error as Error).message).toBe("boom");
    expect(source).toBe("boundary");
    expect(rest).toEqual([]);
  });

  it("captures nothing when children render fine", () => {
    passRender = true;
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("keeps the fallback UI unchanged with the default title", () => {
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("still logs the error and component stack locally", () => {
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "ErrorBoundary caught",
      expect.objectContaining({ message: "boom" }),
      expect.any(String),
    );
  });
});
