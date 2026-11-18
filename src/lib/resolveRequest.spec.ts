import { describe, expect, it } from "vitest";
import type { RequestModel } from "@/types";
import {
  getUnresolvedRequestVars,
  resolveGraphQLRequestTemplate,
  resolveHttpRequestTemplate,
  type HttpRequestInput,
  type GraphQLRequestInput,
} from "./resolveRequest";

describe("resolveRequest", () => {
  describe("resolveHttpRequestTemplate", () => {
    // Helper to create a mock resolveVariables that handles {{var}} syntax
    const createResolver = (vars: Record<string, string>) => {
      return (text: string) => {
        let result = text;
        for (const [key, value] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
        return result;
      };
    };

    it("resolves simple URL with variables", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{endpoint}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ endpoint: "users" });

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.url).toBe("https://example.com/users");
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves URL with multiple variables", () => {
      const request: HttpRequestInput = {
        url: "https://{{host}}/api/{{version}}/{{endpoint}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({
        host: "api.example.com",
        version: "v2",
        endpoint: "users",
      });

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.url).toBe("https://api.example.com/api/v2/users");
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves headers with variables", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
          {
            id: "h2",
            key: "X-Custom-{{header}}",
            value: "value",
            enabled: true,
          },
        ],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ token: "abc123", header: "Id" });

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.headers).toHaveLength(2);
      expect(resolvedRequest.headers[0].value).toBe("Bearer abc123");
      expect(resolvedRequest.headers[1].key).toBe("X-Custom-Id");
      expect(unresolvedVars).toEqual([]);
    });

    it("merges global and tab headers", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [
          { id: "h1", key: "X-Custom", value: "value1", enabled: true },
        ],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [
          { id: "g1", key: "X-Global", value: "value2", enabled: true },
        ],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.headers).toHaveLength(2);
      expect(resolvedRequest.headers).toContainEqual(
        expect.objectContaining({ key: "X-Global", value: "value2" }),
      );
      expect(resolvedRequest.headers).toContainEqual(
        expect.objectContaining({ key: "X-Custom", value: "value1" }),
      );
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves query parameters with variables", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [],
        params: [
          { id: "p1", key: "filter", value: "{{filterValue}}", enabled: true },
          { id: "p2", key: "page", value: "{{page}}", enabled: true },
        ],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ filterValue: "active", page: "1" });

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      // buildFinalUrl adds query params to URL
      expect(resolvedRequest.url).toContain("filter=active");
      expect(resolvedRequest.url).toContain("page=1");
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves body content with variables", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [],
        params: [],
        body: {
          type: "json",
          content: '{"userId": "{{userId}}", "name": "{{name}}"}',
        },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ userId: "42", name: "John Doe" });

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.body.content).toBe(
        '{"userId": "42", "name": "John Doe"}',
      );
      expect(unresolvedVars).toEqual([]);
    });

    it("prepends global base URL to request URL", () => {
      const request: HttpRequestInput = {
        url: "/api/users",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "https://example.com",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.url).toContain("https://example.com/api/users");
      expect(unresolvedVars).toEqual([]);
    });

    it("detects unresolved variables in URL", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{missing}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missing");
    });

    it("detects unresolved variables in headers", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "Bearer {{missingToken}}",
            enabled: true,
          },
        ],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } = resolveHttpRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missingToken");
    });

    it("detects unresolved variables in params", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [],
        params: [
          { id: "p1", key: "filter", value: "{{missingFilter}}", enabled: true },
        ],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } = resolveHttpRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missingFilter");
    });

    it("detects unresolved variables in body", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [],
        params: [],
        body: {
          type: "json",
          content: '{"userId": "{{missingUserId}}"}',
        },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } = resolveHttpRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missingUserId");
    });

    it("detects multiple unresolved variables", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{missing1}}",
        headers: [
          {
            id: "h1",
            key: "X-Token",
            value: "{{missing2}}",
            enabled: true,
          },
        ],
        params: [
          { id: "p1", key: "q", value: "{{missing3}}", enabled: true },
        ],
        body: {
          type: "json",
          content: '{"val": "{{missing1}}"}',
        },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } = resolveHttpRequestTemplate(request, resolver);

      // missing1 appears twice but should only be listed once
      expect(unresolvedVars).toContain("missing1");
      expect(unresolvedVars).toContain("missing2");
      expect(unresolvedVars).toContain("missing3");
      expect(unresolvedVars).toHaveLength(3);
    });

    it("handles empty/null body content", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [],
        params: [],
        body: { type: "none", content: "" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } =
        resolveHttpRequestTemplate(request, resolver);

      expect(resolvedRequest.body.content).toBe("");
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves a chain input when there is no matching env var", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{token}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } = resolveHttpRequestTemplate(
        request,
        resolver,
        { token: "input-value" },
      );

      expect(resolvedRequest.url).toBe("https://example.com/input-value");
      expect(unresolvedVars).toEqual([]);
    });

    it("lets a chain input shadow an env var of the same name", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/api",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
        ],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ token: "env-value" });

      const { resolvedRequest, unresolvedVars } = resolveHttpRequestTemplate(
        request,
        resolver,
        { token: "input-value" },
      );

      expect(resolvedRequest.headers[0].value).toBe("Bearer input-value");
      expect(unresolvedVars).toEqual([]);
    });

    it("still reports a placeholder unresolved when neither an input nor the env has it", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{missing}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } = resolveHttpRequestTemplate(
        request,
        resolver,
        { token: "input-value" },
      );

      expect(unresolvedVars).toContain("missing");
    });
  });

  describe("resolveGraphQLRequestTemplate", () => {
    const createResolver = (vars: Record<string, string>) => {
      return (text: string) => {
        let result = text;
        for (const [key, value] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
        return result;
      };
    };

    it("resolves GraphQL URL with variables", () => {
      const request: GraphQLRequestInput = {
        url: "https://{{host}}/graphql",
        headers: [],
        query: "{ ping }",
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ host: "api.example.com" });

      const { resolvedRequest, unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(resolvedRequest.url).toBe("https://api.example.com/graphql");
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves GraphQL headers with variables", () => {
      const request: GraphQLRequestInput = {
        url: "https://example.com/graphql",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
        ],
        query: "{ ping }",
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ token: "xyz789" });

      const { resolvedRequest, unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(resolvedRequest.headers[0].value).toBe("Bearer xyz789");
      expect(unresolvedVars).toEqual([]);
    });

    it("resolves GraphQL query with variables", () => {
      const request: GraphQLRequestInput = {
        url: "https://example.com/graphql",
        headers: [],
        query: 'query GetUser($id: ID!) { user(id: "{{userId}}") { name } }',
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ userId: "123" });

      const { resolvedRequest, unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(resolvedRequest.query).toBe(
        'query GetUser($id: ID!) { user(id: "123") { name } }',
      );
      expect(unresolvedVars).toEqual([]);
    });

    it("merges global and tab headers in GraphQL", () => {
      const request: GraphQLRequestInput = {
        url: "https://example.com/graphql",
        headers: [
          { id: "h1", key: "X-Custom", value: "value1", enabled: true },
        ],
        query: "{ ping }",
        globalHeaders: [
          { id: "g1", key: "X-Global", value: "value2", enabled: true },
        ],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(resolvedRequest.headers).toHaveLength(2);
      expect(resolvedRequest.headers).toContainEqual(
        expect.objectContaining({ key: "X-Global" }),
      );
      expect(resolvedRequest.headers).toContainEqual(
        expect.objectContaining({ key: "X-Custom" }),
      );
      expect(unresolvedVars).toEqual([]);
    });

    it("prepends global base URL in GraphQL", () => {
      const request: GraphQLRequestInput = {
        url: "/graphql",
        headers: [],
        query: "{ ping }",
        globalHeaders: [],
        globalBaseUrl: "https://example.com",
      };
      const resolver = createResolver({});

      const { resolvedRequest, unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(resolvedRequest.url).toContain("https://example.com/graphql");
      expect(unresolvedVars).toEqual([]);
    });

    it("detects unresolved variables in GraphQL URL", () => {
      const request: GraphQLRequestInput = {
        url: "https://{{missingHost}}/graphql",
        headers: [],
        query: "{ ping }",
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missingHost");
    });

    it("detects unresolved variables in GraphQL headers", () => {
      const request: GraphQLRequestInput = {
        url: "https://example.com/graphql",
        headers: [
          {
            id: "h1",
            key: "X-API-Key",
            value: "{{missingKey}}",
            enabled: true,
          },
        ],
        query: "{ ping }",
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missingKey");
    });

    it("detects unresolved variables in GraphQL query", () => {
      const request: GraphQLRequestInput = {
        url: "https://example.com/graphql",
        headers: [],
        query: 'query { user(id: "{{missingId}}") { name } }',
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("missingId");
    });

    it("detects multiple unresolved variables in GraphQL", () => {
      const request: GraphQLRequestInput = {
        url: "https://{{host}}/graphql",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "{{token}}",
            enabled: true,
          },
        ],
        query: 'query { user(id: "{{userId}}") { name } }',
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({});

      const { unresolvedVars } =
        resolveGraphQLRequestTemplate(request, resolver);

      expect(unresolvedVars).toContain("host");
      expect(unresolvedVars).toContain("token");
      expect(unresolvedVars).toContain("userId");
      expect(unresolvedVars).toHaveLength(3);
    });

    it("lets a chain input shadow a GraphQL env var of the same name", () => {
      const request: GraphQLRequestInput = {
        url: "https://example.com/graphql",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
        ],
        query: "{ ping }",
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const resolver = createResolver({ token: "env-value" });

      const { resolvedRequest, unresolvedVars } = resolveGraphQLRequestTemplate(
        request,
        resolver,
        { token: "input-value" },
      );

      expect(resolvedRequest.headers[0].value).toBe("Bearer input-value");
      expect(unresolvedVars).toEqual([]);
    });
  });

  describe("getUnresolvedRequestVars", () => {
    const createResolver = (vars: Record<string, string>) => {
      return (text: string) => {
        let result = text;
        for (const [key, value] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
        return result;
      };
    };

    function requestWith(
      overrides: Partial<
        Pick<RequestModel, "url" | "headers" | "params" | "body">
      >,
    ): Pick<RequestModel, "url" | "headers" | "params" | "body"> {
      return {
        url: "https://example.com",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        ...overrides,
      };
    }

    it("reports no unresolved vars once every placeholder resolves", () => {
      const request = requestWith({ url: "https://example.com/{{baseUrl}}" });
      const vars = getUnresolvedRequestVars(
        request,
        createResolver({ baseUrl: "v1" }),
      );
      expect(vars).toEqual([]);
    });

    it("reports unresolved vars across url, headers, params and body without running the request", () => {
      const request = requestWith({
        url: "https://example.com/{{userId}}",
        headers: [
          {
            id: "h1",
            key: "Authorization",
            value: "Bearer {{token}}",
            enabled: true,
          },
        ],
        params: [{ id: "p1", key: "q", value: "{{query}}", enabled: true }],
        body: { type: "json", content: '{"id":"{{userId}}"}' },
      });

      const vars = getUnresolvedRequestVars(request, createResolver({}));

      expect(vars).toContain("userId");
      expect(vars).toContain("token");
      expect(vars).toContain("query");
      expect(vars).toHaveLength(3);
    });
  });

  describe("shared value namespace precedence (spec: chain inputs → extracted aliases → environment)", () => {
    const createResolver = (vars: Record<string, string>) => {
      return (text: string) => {
        let result = text;
        for (const [key, value] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
        return result;
      };
    };

    it("resolves {{alias}} in a downstream request template from an extracted alias", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/users/{{userId}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const { resolvedRequest, unresolvedVars } = resolveHttpRequestTemplate(
        request,
        createResolver({}), // no env value for userId
        undefined, // no chain input for userId
        { userId: "extracted-42" }, // alias produced by an upstream edge
      );

      expect(resolvedRequest.url).toBe("https://example.com/users/extracted-42");
      expect(unresolvedVars).toEqual([]);
    });

    it("a chain input shadows an alias of the same name", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{name}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const { resolvedRequest } = resolveHttpRequestTemplate(
        request,
        createResolver({ name: "from-env" }),
        { name: "from-input" },
        { name: "from-alias" },
      );

      expect(resolvedRequest.url).toBe("https://example.com/from-input");
    });

    it("an alias shadows an environment variable of the same name", () => {
      const request: HttpRequestInput = {
        url: "https://example.com/{{name}}",
        headers: [],
        params: [],
        body: { type: "json", content: "{}" },
        globalHeaders: [],
        globalBaseUrl: "",
      };
      const { resolvedRequest } = resolveHttpRequestTemplate(
        request,
        createResolver({ name: "from-env" }),
        undefined,
        { name: "from-alias" },
      );

      expect(resolvedRequest.url).toBe("https://example.com/from-alias");
    });
  });
});
