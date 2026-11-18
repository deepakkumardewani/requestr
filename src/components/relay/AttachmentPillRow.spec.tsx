/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { CollectionModel, EnvironmentModel, RequestModel } from "@/types";
import { AttachmentPillRow } from "./AttachmentPillRow";

vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const usersRequest = {
  id: "req-users_1",
  name: "List users",
  method: "GET",
  url: "https://api.test/users",
} as unknown as RequestModel;
const apiCollection = { id: "col-api_1", name: "API Tests" } as unknown as CollectionModel;
const prodEnvironment = { id: "env-prod_1", name: "Production" } as unknown as EnvironmentModel;

beforeEach(() => {
  useCollectionsStore.setState({
    collections: [apiCollection],
    requests: [usersRequest],
    folders: [],
  });
  useEnvironmentsStore.setState({ environments: [prodEnvironment] });
  useChainStore.setState({ chains: {} });
});

afterEach(() => {
  cleanup();
});

const meta = (attachments: unknown) => ({ attachments });

describe("AttachmentPillRow", () => {
  it("renders nothing for metadata without attachments", () => {
    render(<AttachmentPillRow metadata={undefined} />);
    expect(screen.queryByTestId("relay-attachment-pills")).toBeNull();
  });

  it("ignores malformed attachment entries", () => {
    render(
      <AttachmentPillRow
        metadata={meta([{ id: 1, kind: "request", label: "x" }, { id: "a", kind: "bogus", label: "y" }])}
      />,
    );
    expect(screen.queryByTestId("relay-attachment-pills")).toBeNull();
  });

  it("renders a live pill for each existing entity, as links", () => {
    render(
      <AttachmentPillRow
        metadata={meta([
          { id: "req-users_1", kind: "request", label: "List users", method: "GET" },
          { id: "col-api_1", kind: "collection", label: "API Tests" },
          { id: "env-prod_1", kind: "environment", label: "Production" },
        ])}
      />,
    );
    const list = screen.getByTestId("relay-attachment-pills");
    expect(list).toHaveAttribute("aria-label", "Context for your next message");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    const pills = screen.getAllByTestId("relay-entity-pill");
    expect(pills.map((p) => p.getAttribute("data-kind"))).toEqual([
      "request",
      "collection",
      "environment",
    ]);
    expect(screen.queryByTestId("relay-attachment-pill-deleted")).toBeNull();
  });

  it("shows a deleted entity as a dimmed static pill with the stale message", () => {
    render(
      <AttachmentPillRow
        metadata={meta([{ id: "req-gone_9", kind: "request", label: "Old call", method: "DELETE" }])}
      />,
    );
    const deleted = screen.getByTestId("relay-attachment-pill-deleted");
    expect(deleted).toHaveAttribute("aria-label", "Old call no longer exists");
    expect(deleted).toHaveAttribute("title", "Old call no longer exists");
    expect(within(deleted).getByTestId("relay-entity-pill-static")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-entity-pill")).toBeNull();
  });

  it("keeps a tab pill static and live, defaulting its method to GET", () => {
    render(
      <AttachmentPillRow metadata={meta([{ id: "tab-1", kind: "tab", label: "Scratch" }])} />,
    );
    const pill = screen.getByTestId("relay-entity-pill-static");
    expect(pill).toHaveAttribute("data-kind", "request");
    expect(pill).toHaveTextContent("Scratch");
    expect(screen.getByTestId("relay-pill-method")).toHaveTextContent("GET");
    expect(screen.queryByTestId("relay-attachment-pill-deleted")).toBeNull();
  });

  it("marks a pill deleted when its entity is removed from the store", () => {
    const metadata = meta([{ id: "col-api_1", kind: "collection", label: "API Tests" }]);
    const { rerender } = render(<AttachmentPillRow metadata={metadata} />);
    expect(screen.getByTestId("relay-entity-pill")).toBeInTheDocument();
    useCollectionsStore.setState({ collections: [] });
    rerender(<AttachmentPillRow metadata={metadata} />);
    expect(screen.getByTestId("relay-attachment-pill-deleted")).toBeInTheDocument();
  });
});
