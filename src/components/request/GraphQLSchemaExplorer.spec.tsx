/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as introspection from "@/lib/graphqlIntrospection";
import { GraphQLSchemaExplorer } from "./GraphQLSchemaExplorer";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn() },
}));

const sampleSchema: introspection.ParsedSchema = {
  queryTypeName: "Query",
  mutationTypeName: null,
  subscriptionTypeName: null,
  types: [
    {
      kind: "OBJECT",
      name: "Query",
      description: null,
      fields: [
        {
          name: "users",
          description: null,
          args: [],
          type: {
            kind: "LIST",
            name: null,
            ofType: {
              kind: "NON_NULL",
              name: null,
              ofType: { kind: "OBJECT", name: "User", ofType: null },
            },
          },
        },
      ],
    },
    {
      kind: "OBJECT",
      name: "User",
      description: null,
      fields: [
        {
          name: "id",
          description: null,
          args: [],
          type: { kind: "SCALAR", name: "ID", ofType: null },
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GraphQLSchemaExplorer", () => {
  beforeEach(() => {
    vi.spyOn(introspection, "fetchGraphQLSchema");
  });

  it("shows idle fetch control before schema is loaded", () => {
    render(
      <GraphQLSchemaExplorer
        url="https://api.example.com/graphql"
        headers={[]}
        sslVerify
        followRedirects
        onFieldSnippet={vi.fn()}
      />,
    );

    expect(screen.getByTestId("fetch-schema-btn")).toHaveTextContent(
      "Fetch Schema",
    );
  });

  it("shows error state when schema fetch fails", async () => {
    vi.mocked(introspection.fetchGraphQLSchema).mockRejectedValueOnce({
      message: "Proxy returned 502",
    });

    render(
      <GraphQLSchemaExplorer
        url="https://api.example.com/graphql"
        headers={[]}
        sslVerify
        followRedirects
        onFieldSnippet={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("fetch-schema-btn"));

    await waitFor(() =>
      expect(screen.getByText(/Proxy returned 502/)).toBeInTheDocument(),
    );
  });

  it("renders query fields and invokes onFieldSnippet when a field is chosen", async () => {
    vi.mocked(introspection.fetchGraphQLSchema).mockResolvedValueOnce(
      sampleSchema,
    );
    const onFieldSnippet = vi.fn();

    render(
      <GraphQLSchemaExplorer
        url="https://api.example.com/graphql"
        headers={[]}
        sslVerify
        followRedirects
        onFieldSnippet={onFieldSnippet}
      />,
    );

    fireEvent.click(screen.getByTestId("fetch-schema-btn"));

    await waitFor(() =>
      expect(screen.getByText("users")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText("users"));

    expect(onFieldSnippet).toHaveBeenCalled();
    expect(onFieldSnippet.mock.calls[0]?.[0]).toContain("users");
  });
});
