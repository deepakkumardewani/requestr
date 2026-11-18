/** @vitest-environment happy-dom */

import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InjectionEditor } from "./InjectionEditor";

function renderEditor(onChange = vi.fn(), extra: Partial<ComponentProps<typeof InjectionEditor>> = {}) {
  render(
    <InjectionEditor
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
      initialInjections={[
        { sourceJsonPath: "$.value", targetField: "header", targetKey: "" },
      ]}
      initialTargetUrl=""
      onChange={onChange}
      {...extra}
    />,
  );
  return onChange;
}

describe("InjectionEditor reserved target key", () => {
  afterEach(() => cleanup());

  it("shows an inline error and reports invalid for a collect./sub. targetKey", async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();

    const keyInput = screen.getByPlaceholderText("Authorization");
    await user.clear(keyInput);
    await user.type(keyInput, "collect.foo");

    expect(screen.getByText(/those prefixes are/i)).toBeInTheDocument();
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[2]).toBe(false);
  });

  it("reports valid for a non-reserved targetKey", async () => {
    const user = userEvent.setup();
    const onChange = renderEditor();

    const keyInput = screen.getByPlaceholderText("Authorization");
    await user.clear(keyInput);
    await user.type(keyInput, "Authorization");

    expect(screen.queryByText(/those prefixes are/i)).not.toBeInTheDocument();
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[2]).toBe(true);
  });
});

describe("InjectionEditor alias collisions", () => {
  afterEach(() => cleanup());

  const otherEdge = {
    id: "other",
    sourceRequestId: "a",
    targetRequestId: "b",
    injections: [
      { sourceJsonPath: "$.id", targetField: "header", targetKey: "id" },
    ],
  } as const;

  it("warns when the typed alias is already used by another edge in the chain", async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn(), {
      edgeId: "mine",
      chainEdges: [{ ...otherEdge, injections: [...otherEdge.injections] }],
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Authorization"), "id");

    expect(screen.getByRole("alert")).toHaveTextContent(/written by 2 edges/i);
  });

  it("does not warn for a unique alias", async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn(), {
      edgeId: "mine",
      chainEdges: [{ ...otherEdge, injections: [...otherEdge.injections] }],
    });
    await user.type(screen.getByPlaceholderText("Authorization"), "other");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when the alias collides with an Evaluate block's outputAlias", async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn(), {
      edgeId: "mine",
      chainBlocks: [{ id: "ev", type: "evaluate", code: "", outputAlias: "result" }],
    });
    await user.type(screen.getByPlaceholderText("Authorization"), "result");
    expect(screen.getByRole("alert")).toHaveTextContent(
      /1 Evaluate block, 1 edge/i,
    );
  });
});
