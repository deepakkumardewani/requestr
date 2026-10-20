/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { relayIntlMock } from "./relayIntlMock";
import { RelayLoadError } from "./RelayLoadError";
import { useRelayStore } from "@/stores/useRelayStore";

vi.mock("next-intl", () => relayIntlMock());

beforeEach(() => {
  useRelayStore.setState({ open: true });
});

afterEach(cleanup);

describe("RelayLoadError", () => {
  it("shows a localized alert while Relay is open", () => {
    render(<RelayLoadError />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Relay couldn’t load. Check your connection and reload the page.",
    );
  });

  it("hides the alert once the user closes Relay", () => {
    render(<RelayLoadError />);
    act(() => useRelayStore.getState().setOpen(false));
    expect(screen.queryByTestId("relay-dock-error")).not.toBeInTheDocument();
  });
});
