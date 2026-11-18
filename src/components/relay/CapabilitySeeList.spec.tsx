/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { CapabilitySeeList } from "./CapabilitySeeList";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next-intl", async () =>
  (await import("./relayIntlMock")).relayIntlMock(),
);

afterEach(cleanup);

beforeEach(() => {
  useRelayStore.setState({ shareValues: false });
});

describe("CapabilitySeeList", () => {
  it("is a labelled What Relay can see section", () => {
    render(<CapabilitySeeList />);
    const section = screen.getByTestId("relay-capability-see-list");
    expect(section).toHaveAccessibleName("What Relay can see");
  });

  it("lists what reaches the model and what never does", () => {
    render(<CapabilitySeeList />);
    const section = screen.getByTestId("relay-capability-see-list");
    expect(section).toHaveTextContent("Items you attach with + or @");
    expect(section).toHaveTextContent("The names, ids and counts");
    expect(section).toHaveTextContent("Secret values, never");
  });

  it("says variable values stay private until sharing is on, then that they are shared", () => {
    render(<CapabilitySeeList />);
    const values = screen.getByTestId("relay-capability-see-values");
    expect(values).toHaveTextContent("only when you turn on Share variable values");
    act(() => useRelayStore.setState({ shareValues: true }));
    expect(values).toHaveTextContent("because Share variable values is on");
  });

  it("links to the Relay settings", () => {
    render(<CapabilitySeeList />);
    const link = screen.getByTestId("relay-capability-settings-link");
    expect(link).toHaveAttribute("href", "/settings");
    expect(link).toHaveTextContent("Open Settings > Relay");
  });
});
