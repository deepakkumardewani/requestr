// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { CollectionModel, EnvironmentModel, RequestModel } from "@/types";
import type { Chain } from "@/types/chain";
import { EntityPill } from "./EntityPill";

const push = vi.hoisted(() => vi.fn());
vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const REQUEST_ID = "req-users_1";
const COLLECTION_ID = "col-api_1";
const ENVIRONMENT_ID = "env-prod_1";
const CHAIN_ID = "chain-test_1";

const usersRequest = {
  id: REQUEST_ID,
  name: "List users",
  method: "GET",
  url: "https://api.test/users",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none" },
} as unknown as RequestModel;

const postRequest = {
  id: "req-create_1",
  name: "Create user",
  method: "POST",
  url: "https://api.test/users",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "json" },
} as unknown as RequestModel;

const apiCollection = {
  id: COLLECTION_ID,
  name: "API Tests",
  folders: [],
  requests: [],
} as unknown as CollectionModel;

const prodEnvironment = {
  id: ENVIRONMENT_ID,
  name: "Production",
  variables: [],
  isActive: false,
} as unknown as EnvironmentModel;

const testChain = {
  id: CHAIN_ID,
  title: "Test Flow",
  description: "",
  nodes: [],
  edges: [],
} as unknown as Chain;

beforeEach(() => {
  push.mockClear();
  useCollectionsStore.setState({
    collections: [apiCollection],
    requests: [usersRequest, postRequest],
    folders: [],
  });
  useEnvironmentsStore.setState({
    environments: [prodEnvironment],
    activeEnvId: null,
  });
  useTabsStore.setState({
    tabs: [],
    activeTabId: null,
  });
  useChainStore.setState({
    chains: {
      [CHAIN_ID]: testChain,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EntityPill", () => {
  describe("request entity (FR-180, FR-181)", () => {
    it("renders a request pill with method badge and accessible name", () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: "List users",
            method: "GET",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill).toHaveAttribute("data-kind", "request");
      expect(pill).toHaveAttribute("aria-label");
      expect(pill.getAttribute("aria-label")).toContain("request");
      expect(pill.getAttribute("aria-label")).toContain("List users");
      expect(pill).toHaveTextContent("List users");
      const badge = screen.getByTestId("relay-pill-method");
      expect(badge).toHaveTextContent("GET");
    });

    it("renders POST method badge with its colour", () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: "req-create_1",
            name: "Create user",
            method: "POST",
          }}
        />,
      );
      const badge = screen.getByTestId("relay-pill-method");
      expect(badge).toHaveTextContent("POST");
      expect(badge.className).toContain("bg-blue-500/20");
      expect(badge.className).toContain("text-blue-400");
    });

    it("opens the request tab when clicked", async () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: "List users",
            method: "GET",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(useTabsStore.getState().tabs.some((tab) => tab.requestId === REQUEST_ID)).toBe(
          true,
        );
      });
    });

    it("does not navigate to a route when a request is opened", async () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: "List users",
            method: "GET",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(useTabsStore.getState().tabs).toHaveLength(1);
      });
      expect(push).not.toHaveBeenCalled();
    });

    it("logs an error when opening a request that does not exist", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: "missing-req",
            name: "Ghost",
            method: "GET",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(error).toHaveBeenCalled();
      });
      error.mockRestore();
    });

    it("name with HTML is shown as plain text, not rendered", () => {
      const { container } = render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: '<img src=x onerror="alert(1)">',
            method: "GET",
          }}
        />,
      );
      expect(container.querySelector("img")).toBeNull();
      expect(container.textContent).toContain('<img src=x onerror="alert(1)">' );
    });
  });

  describe("collection entity", () => {
    it("renders a collection pill with a folder icon and accessible name", () => {
      render(
        <EntityPill
          entity={{
            kind: "collection",
            id: COLLECTION_ID,
            name: "API Tests",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill).toHaveAttribute("data-kind", "collection");
      expect(pill).toHaveAttribute("aria-label");
      expect(pill.getAttribute("aria-label")).toContain("collection");
      expect(pill.getAttribute("aria-label")).toContain("API Tests");
      expect(pill).toHaveTextContent("API Tests");
      expect(screen.queryByTestId("relay-pill-method")).toBeNull();
    });

    it("navigates to /app when a collection pill is clicked", async () => {
      render(
        <EntityPill
          entity={{
            kind: "collection",
            id: COLLECTION_ID,
            name: "API Tests",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/app");
      });
    });

    it("logs an error when opening a collection that does not exist", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <EntityPill
          entity={{
            kind: "collection",
            id: "missing-col",
            name: "Absent",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(error).toHaveBeenCalled();
      });
      expect(push).not.toHaveBeenCalled();
      error.mockRestore();
    });
  });

  describe("environment entity", () => {
    it("renders an environment pill with a globe icon and accessible name", () => {
      render(
        <EntityPill
          entity={{
            kind: "environment",
            id: ENVIRONMENT_ID,
            name: "Production",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill).toHaveAttribute("data-kind", "environment");
      expect(pill).toHaveAttribute("aria-label");
      expect(pill.getAttribute("aria-label")).toContain("environment");
      expect(pill.getAttribute("aria-label")).toContain("Production");
      expect(pill).toHaveTextContent("Production");
      expect(screen.queryByTestId("relay-pill-method")).toBeNull();
    });

    it("navigates to /environments when an environment pill is clicked", async () => {
      render(
        <EntityPill
          entity={{
            kind: "environment",
            id: ENVIRONMENT_ID,
            name: "Production",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/environments");
      });
    });
  });

  describe("chain entity", () => {
    it("renders a chain pill with a workflow icon and accessible name", () => {
      render(
        <EntityPill
          entity={{
            kind: "chain",
            id: CHAIN_ID,
            name: "Test Flow",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill).toHaveAttribute("data-kind", "chain");
      expect(pill).toHaveAttribute("aria-label");
      expect(pill.getAttribute("aria-label")).toContain("chain");
      expect(pill.getAttribute("aria-label")).toContain("Test Flow");
      expect(pill).toHaveTextContent("Test Flow");
      expect(screen.queryByTestId("relay-pill-method")).toBeNull();
    });

    it("navigates to /chain/<id> when a chain pill is clicked", async () => {
      render(
        <EntityPill
          entity={{
            kind: "chain",
            id: CHAIN_ID,
            name: "Test Flow",
          }}
        />,
      );
      fireEvent.click(screen.getByTestId("relay-entity-pill"));
      await waitFor(() => {
        expect(push).toHaveBeenCalledWith(`/chain/${CHAIN_ID}`);
      });
    });
  });

  describe("accessibility and styling (FR-181)", () => {
    it("pill button is always button type", () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: "List users",
            method: "GET",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill).toBeInstanceOf(HTMLButtonElement);
      expect(pill).toHaveAttribute("type", "button");
    });

    it("truncates long entity names with ellipsis", () => {
      const longName =
        "Very long request name that should be truncated with ellipsis due to max-width";
      const { container } = render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: longName,
            method: "GET",
          }}
        />,
      );
      const nameSpan = Array.from(container.querySelectorAll("span")).find(
        (el) => el.textContent === longName && el.className.includes("truncate"),
      );
      expect(nameSpan).toBeTruthy();
      expect(nameSpan?.className).toContain("truncate");
    });
  });

  describe("focus and interaction", () => {
    it("has focus-visible styles for keyboard navigation", () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: "List users",
            method: "GET",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      expect(pill.className).toContain("focus-visible");
    });

    it("is keyboard accessible", async () => {
      render(
        <EntityPill
          entity={{
            kind: "request",
            id: REQUEST_ID,
            name: "List users",
            method: "GET",
          }}
        />,
      );
      const pill = screen.getByTestId("relay-entity-pill");
      pill.focus();
      expect(document.activeElement).toBe(pill);
      // Simulate Enter key press
      fireEvent.keyDown(pill, { key: "Enter", code: "Enter" });
    });
  });
});
