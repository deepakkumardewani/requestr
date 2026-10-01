/** @vitest-environment happy-dom */

import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayExtractor } from "./DisplayExtractor";

function renderExtractor(
  onChange = vi.fn(),
  extra: Partial<ComponentProps<typeof DisplayExtractor>> = {},
) {
  render(
    <DisplayExtractor
      parsedResponseBody={null}
      sourceRequest={{ id: "src", name: "Source", method: "GET" } as never}
      targetRequest={{ id: "tgt", name: "Target", method: "POST" } as never}
      sourceResponse={{
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 0,
        size: 0,
        url: "",
        method: "GET",
        timestamp: 0,
      }}
      onChange={onChange}
      {...extra}
    />,
  );
  return onChange;
}

describe("DisplayExtractor reserved target key", () => {
  afterEach(() => cleanup());

  it("shows an inline error and reports invalid for a collect./sub. targetKey", async () => {
    const user = userEvent.setup();
    const onChange = renderExtractor();

    const keyInput = screen.getByPlaceholderText("Authorization");
    await user.clear(keyInput);
    await user.type(keyInput, "sub.foo");

    expect(
      screen.getByText(/those prefixes are/i),
    ).toBeInTheDocument();
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(false);
  });

  it("reports valid for a non-reserved targetKey", async () => {
    const user = userEvent.setup();
    const onChange = renderExtractor();

    const keyInput = screen.getByPlaceholderText("Authorization");
    await user.clear(keyInput);
    await user.type(keyInput, "token");

    expect(screen.queryByText(/those prefixes are/i)).not.toBeInTheDocument();
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(true);
  });
});

describe("DisplayExtractor alias collisions", () => {
  afterEach(() => cleanup());

  const edgeWithId = {
    id: "e1",
    sourceRequestId: "a",
    targetRequestId: "b",
    injections: [
      { sourceJsonPath: "$.id", targetField: "header" as const, targetKey: "id" },
    ],
  };

  it("warns when the typed targetKey is already published by an edge", async () => {
    const user = userEvent.setup();
    renderExtractor(vi.fn(), { chainEdges: [edgeWithId] });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Authorization"), "id");

    expect(screen.getByRole("alert")).toHaveTextContent(
      /written by 1 Display block, 1 edge/i,
    );
  });

  it("warns when it collides with an Evaluate outputAlias and not for a unique key", async () => {
    const user = userEvent.setup();
    renderExtractor(vi.fn(), {
      chainBlocks: [{ id: "ev", type: "evaluate", code: "", outputAlias: "out" }],
    });
    const input = screen.getByPlaceholderText("Authorization");
    await user.type(input, "unique");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "out");
    expect(screen.getByRole("alert")).toHaveTextContent(/1 Evaluate block, 1 Display block/i);
  });
});
