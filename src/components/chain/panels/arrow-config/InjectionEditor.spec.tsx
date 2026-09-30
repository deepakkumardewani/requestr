/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InjectionEditor } from "./InjectionEditor";

function renderEditor(onChange = vi.fn()) {
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
      panelOpen
      panelSessionKey="s1"
      onChange={onChange}
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
