/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DisplayExtractor } from "./DisplayExtractor";

function renderExtractor(onChange = vi.fn()) {
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
      panelOpen
      panelSessionKey="s1"
      onChange={onChange}
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
