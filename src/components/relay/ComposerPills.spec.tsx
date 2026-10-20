/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useChainStore } from "@/stores/useChainStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { ComposerPills } from "./ComposerPills";

afterEach(() => {
  cleanup();
  useRelayStore.setState({ attachedItems: [] });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useChainStore.setState({ chains: {} });
  useEnvironmentsStore.setState({ environments: [] });
});

function setup() {
  cleanup();
  const onRemove = vi.fn();
  render(<ComposerPills onRemove={onRemove} />);
  return { onRemove };
}

describe("ComposerPills", () => {
  it("renders nothing when there are no attached items", () => {
    setup();
    expect(screen.queryByTestId("relay-composer-pills")).toBeNull();
  });

  it("renders a list of attached pills", () => {
    useRelayStore.setState({
      attachedItems: [
        { kind: "request", id: "r1", label: "Get users" },
        { kind: "collection", id: "c1", label: "API" },
      ],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    expect(screen.getByTestId("relay-composer-pills")).toHaveAttribute(
      "aria-label",
      "context.label",
    );
    const pills = screen.getAllByTestId("relay-composer-pill");
    expect(pills).toHaveLength(2);
  });

  it("renders each pill with the icon, label, and remove button", () => {
    useCollectionsStore.setState({
      collections: [{ id: "c1", name: "API", createdAt: 0, updatedAt: 0 }],
      requests: [
        {
          id: "r1",
          name: "Get users",
          collectionId: "c1",
          method: "GET",
          params: [],
          headers: [],
          auth: { type: "none" },
          body: { type: "none", content: "" },
          preScript: "",
          postScript: "",
          createdAt: 0,
          updatedAt: 0,
          url: "https://api.test/users",
        },
      ],
    } as never);
    useRelayStore.setState({
      attachedItems: [{ kind: "request", id: "r1", label: "Get users" }],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const pill = screen.getByTestId("relay-composer-pill");
    expect(pill).toHaveAttribute("data-kind", "request");
    expect(pill).toHaveAttribute("data-stale", "false");
    expect(screen.getByTestId("relay-composer-pill-label")).toHaveTextContent(
      "Get users",
    );
    const removeBtn = screen.getByTestId("relay-composer-pill-remove");
    expect(removeBtn).toHaveAttribute("aria-label", "composer.pill.remove");
  });

  it("removes a pill and calls onRemove when the remove button is clicked", () => {
    const { onRemove } = setup();
    useRelayStore.setState({
      attachedItems: [
        { kind: "request", id: "r1", label: "Get users" },
        { kind: "collection", id: "c1", label: "API" },
      ],
    });
    render(<ComposerPills onRemove={onRemove} />);
    const removeBtn = screen.getAllByTestId("relay-composer-pill-remove")[0];
    fireEvent.click(removeBtn);
    expect(useRelayStore.getState().attachedItems).toHaveLength(1);
    expect(onRemove).toHaveBeenCalledWith({
      kind: "request",
      id: "r1",
      label: "Get users",
    });
  });

  it("marks a pill as stale when the attached item no longer exists", () => {
    useCollectionsStore.setState({
      collections: [],
      requests: [],
    } as never);
    useRelayStore.setState({
      attachedItems: [{ kind: "request", id: "r1", label: "Deleted Request" }],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const pill = screen.getByTestId("relay-composer-pill");
    expect(pill).toHaveAttribute("data-stale", "true");
    const label = screen.getByTestId("relay-composer-pill-label");
    expect(label).toHaveClass("line-through");
  });

  it("shows stale title when a pill is for a deleted item", () => {
    useCollectionsStore.setState({
      collections: [],
      requests: [],
    } as never);
    useRelayStore.setState({
      attachedItems: [{ kind: "request", id: "r1", label: "Deleted" }],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const pill = screen.getByTestId("relay-composer-pill");
    expect(pill.getAttribute("title")).toMatch(/stale|Deleted/);
  });

  it("shows the label as the title when the pill is not stale", () => {
    useCollectionsStore.setState({
      collections: [{ id: "c1", name: "API", createdAt: 0, updatedAt: 0 }],
      requests: [
        {
          id: "r1",
          name: "Get users",
          collectionId: "c1",
          method: "GET",
          params: [],
          headers: [],
          auth: { type: "none" },
          body: { type: "none", content: "" },
          preScript: "",
          postScript: "",
          createdAt: 0,
          updatedAt: 0,
          url: "https://api.test/users",
        },
      ],
    } as never);
    useRelayStore.setState({
      attachedItems: [{ kind: "request", id: "r1", label: "Get users" }],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const pill = screen.getByTestId("relay-composer-pill");
    expect(pill.getAttribute("title")).toBe("Get users");
  });

  it("applies custom className when provided", () => {
    useRelayStore.setState({
      attachedItems: [{ kind: "request", id: "r1", label: "Get users" }],
    });
    render(<ComposerPills onRemove={vi.fn()} className="custom-class" />);
    const list = screen.getByTestId("relay-composer-pills");
    expect(list).toHaveClass("custom-class");
  });

  it("renders pills with different kinds", () => {
    useCollectionsStore.setState({
      collections: [{ id: "c1", name: "API", createdAt: 0, updatedAt: 0 }],
      requests: [],
    } as never);
    useChainStore.setState({
      chains: [{ id: "ch1", name: "Auth Flow", createdAt: 0, updatedAt: 0 }],
    } as never);
    useEnvironmentsStore.setState({
      environments: [{ id: "e1", name: "Production", createdAt: 0, updatedAt: 0 }],
    } as never);
    useRelayStore.setState({
      attachedItems: [
        { kind: "request", id: "r1", label: "Get" },
        { kind: "collection", id: "c1", label: "API" },
        { kind: "chain", id: "ch1", label: "Auth Flow" },
        { kind: "environment", id: "e1", label: "Production" },
        { kind: "tab", id: "t1", label: "Tab 1" },
      ],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const pills = screen.getAllByTestId("relay-composer-pill");
    expect(pills).toHaveLength(5);
    expect(pills[0]).toHaveAttribute("data-kind", "request");
    expect(pills[1]).toHaveAttribute("data-kind", "collection");
    expect(pills[2]).toHaveAttribute("data-kind", "chain");
    expect(pills[3]).toHaveAttribute("data-kind", "environment");
    expect(pills[4]).toHaveAttribute("data-kind", "tab");
  });

  it("truncates a pill label that is too long", () => {
    const longLabel = "A".repeat(100);
    useRelayStore.setState({
      attachedItems: [{ kind: "request", id: "r1", label: longLabel }],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const label = screen.getByTestId("relay-composer-pill-label");
    expect(label).toHaveClass("truncate");
  });

  it("removes a pill and updates the store", () => {
    useRelayStore.setState({
      attachedItems: [
        { kind: "request", id: "r1", label: "Item 1" },
        { kind: "request", id: "r2", label: "Item 2" },
      ],
    });
    render(<ComposerPills onRemove={vi.fn()} />);
    const removeBtn = screen.getAllByTestId("relay-composer-pill-remove")[0];
    fireEvent.click(removeBtn);
    const remaining = useRelayStore.getState().attachedItems;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toEqual({ kind: "request", id: "r2", label: "Item 2" });
  });

  it("calls onRemove with the removed chip", () => {
    const chip = { kind: "collection" as const, id: "c1", label: "MyCollection" };
    useRelayStore.setState({
      attachedItems: [chip],
    });
    const { onRemove } = setup();
    fireEvent.click(screen.getByTestId("relay-composer-pill-remove"));
    expect(onRemove).toHaveBeenCalledWith(chip);
  });
});
