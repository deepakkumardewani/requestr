/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { relayIntlMock } from "./relayIntlMock";
import { RelayRoot } from "./RelayRoot";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));
vi.mock("next-intl", () => relayIntlMock());

// next/dynamic needs the Next runtime; model it with React.lazy.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<React.ComponentType<object>>) => {
    const Lazy = lazy(async () => ({ default: await loader() }));
    return (props: object) => (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  },
}));

// A getter that throws models the lazy dock chunk rejecting when fetched.
vi.mock("./RelayDockWithMessages", () => ({
  get RelayDockWithMessages(): never {
    throw new Error("Loading chunk failed");
  },
}));

afterEach(cleanup);

describe("RelayRoot dock chunk failure", () => {
  it("shows a localized error instead of crashing when the dock chunk fails", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<RelayRoot />);

    act(() => useRelayStore.getState().setOpen(true));

    expect(await screen.findByTestId("relay-dock-error")).toHaveTextContent(
      "Relay couldn’t load",
    );
    expect(screen.queryByTestId("relay-dock")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
