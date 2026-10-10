import { resolveInNamespace } from "@/lib/chainValueNamespace";
import {
  buildFinalUrl,
  mergeKvHeaders,
  prependGlobalBaseUrl,
} from "@/lib/utils";
import type { AuthConfig, BodyConfig, KVPair, RequestModel } from "@/types";

const UNRESOLVED_VAR_REGEX = /\{\{(\w+)\}\}/g;

/** Returns all `{{var}}` placeholder names still present in the given strings. */
function extractUnresolvedVars(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(UNRESOLVED_VAR_REGEX)) {
      found.add(match[1]);
    }
  }
  return [...found];
}

/**
 * Dry-run resolve for the amber "n unresolved" node pill: computes which
 * `{{var}}` placeholders a request would still contain if resolved right
 * now, without building a final URL or running the request. Reuses the
 * same resolution + detection logic as `resolveHttpRequestTemplate` so the
 * pre-run pill and the post-run result can never disagree.
 */
export function getUnresolvedRequestVars(
  request: Pick<RequestModel, "url" | "headers" | "params" | "body">,
  resolveVariables: (text: string) => string,
  chainInputs?: Record<string, string>,
  aliasValues?: Record<string, string>,
): string[] {
  const { unresolvedVars } = resolveHttpRequestTemplate(
    {
      url: request.url,
      headers: request.headers,
      params: request.params,
      body: request.body,
      globalHeaders: [],
      globalBaseUrl: "",
    },
    resolveVariables,
    chainInputs,
    aliasValues,
  );
  return unresolvedVars;
}

/** Resolves `{{var}}` placeholders in every credential field of an auth config. */
export function resolveAuthConfig(
  auth: AuthConfig,
  resolveVariables: (text: string) => string,
): AuthConfig {
  switch (auth.type) {
    case "bearer":
      return { ...auth, token: resolveVariables(auth.token) };
    case "basic":
      return {
        ...auth,
        username: resolveVariables(auth.username),
        password: resolveVariables(auth.password),
      };
    case "api-key":
      return {
        ...auth,
        key: resolveVariables(auth.key),
        value: resolveVariables(auth.value),
      };
    case "none":
      return auth;
  }
}

/** Input for HTTP request resolution. */
export type HttpRequestInput = {
  url: string;
  headers: KVPair[];
  params: KVPair[];
  body: BodyConfig;
  globalHeaders: KVPair[];
  globalBaseUrl: string;
};

/** Resolved HTTP request output. */
export type ResolvedHttpRequest = {
  url: string;
  headers: KVPair[];
  body: BodyConfig;
};

/** Input for GraphQL request resolution. */
export type GraphQLRequestInput = {
  url: string;
  headers: KVPair[];
  query: string;
  globalHeaders: KVPair[];
  globalBaseUrl: string;
};

/** Resolved GraphQL request output. */
export type ResolvedGraphQLRequest = {
  url: string;
  headers: KVPair[];
  query: string;
};

/**
 * Pure function to resolve an HTTP request template with variables.
 * Resolves URL, headers, params, and body; checks for unresolved {{var}} placeholders.
 *
 * @param request - HTTP request data to resolve
 * @param resolveVariables - Function that replaces {{var}} with values
 * @param chainInputs - Chain input values, keyed by `ChainInput.key` (namespace tier 1)
 * @param aliasValues - Extracted-alias values from edges/Display/Evaluate/Collect
 *   (namespace tier 2); see `chainValueNamespace.ts` for precedence
 * @returns Resolved request plus list of unresolvedVars that remain
 */
export function resolveHttpRequestTemplate(
  request: HttpRequestInput,
  resolveVariables: (text: string) => string,
  chainInputs?: Record<string, string>,
  aliasValues?: Record<string, string>,
): {
  resolvedRequest: ResolvedHttpRequest;
  unresolvedVars: string[];
} {
  const resolve = (text: string) =>
    resolveInNamespace(text, { chainInputs, aliasValues, resolveVariables });

  // Resolve the shared namespace (chain inputs → extracted aliases → env) in all fields
  const resolvedUrl = resolve(request.url);
  const resolvedGlobalHeaders: KVPair[] = request.globalHeaders.map((h) => ({
    ...h,
    key: resolve(h.key),
    value: resolve(h.value),
  }));
  const resolvedHeaders: KVPair[] = request.headers.map((h) => ({
    ...h,
    key: resolve(h.key),
    value: resolve(h.value),
  }));
  const resolvedParams: KVPair[] = request.params.map((p) => ({
    ...p,
    key: resolve(p.key),
    value: resolve(p.value),
  }));
  const resolvedBody = {
    ...request.body,
    content: resolve(request.body.content),
    // Shared by urlencoded and multipart rows
    ...(request.body.formData && {
      formData: request.body.formData.map((f) => ({
        ...f,
        key: resolve(f.key),
        value: resolve(f.value),
      })),
    }),
  };

  // Check for unresolved {{variable}} placeholders BEFORE URL-encoding
  const headerTexts = resolvedGlobalHeaders
    .concat(resolvedHeaders)
    .flatMap((h) => [h.key, h.value]);
  const paramTexts = resolvedParams.flatMap((p) => [p.key, p.value]);
  const bodyText = resolvedBody.content ?? "";
  const formTexts = (resolvedBody.formData ?? []).flatMap((f) => [
    f.key,
    f.value,
  ]);
  const unresolvedVars = extractUnresolvedVars(
    resolvedUrl,
    ...headerTexts,
    ...paramTexts,
    bodyText,
    ...formTexts,
  );

  // Prepend global base URL and merge headers
  const urlAfterGlobalBase = prependGlobalBaseUrl(
    resolvedUrl,
    request.globalBaseUrl,
  );
  const mergedHeaders = mergeKvHeaders(resolvedGlobalHeaders, resolvedHeaders);
  const finalUrl = buildFinalUrl(urlAfterGlobalBase, resolvedParams);

  return {
    resolvedRequest: {
      url: finalUrl,
      headers: mergedHeaders,
      body: resolvedBody,
    },
    unresolvedVars,
  };
}

/**
 * Pure function to resolve a GraphQL request template with variables.
 * Resolves URL, headers, and query; checks for unresolved {{var}} placeholders.
 *
 * @param request - GraphQL request data to resolve
 * @param resolveVariables - Function that replaces {{var}} with values
 * @param chainInputs - Chain input values, keyed by `ChainInput.key` (namespace tier 1)
 * @param aliasValues - Extracted-alias values from edges/Display/Evaluate/Collect
 *   (namespace tier 2); see `chainValueNamespace.ts` for precedence
 * @returns Resolved request plus list of unresolvedVars that remain
 */
export function resolveGraphQLRequestTemplate(
  request: GraphQLRequestInput,
  resolveVariables: (text: string) => string,
  chainInputs?: Record<string, string>,
  aliasValues?: Record<string, string>,
): {
  resolvedRequest: ResolvedGraphQLRequest;
  unresolvedVars: string[];
} {
  const resolve = (text: string) =>
    resolveInNamespace(text, { chainInputs, aliasValues, resolveVariables });

  // Resolve the shared namespace (chain inputs → extracted aliases → env)
  const resolvedUrl = prependGlobalBaseUrl(
    resolve(request.url),
    request.globalBaseUrl,
  );
  const resolvedHeaders: KVPair[] = request.headers.map((h) => ({
    ...h,
    key: resolve(h.key),
    value: resolve(h.value),
  }));
  const resolvedGlobalHeaders: KVPair[] = request.globalHeaders.map((h) => ({
    ...h,
    key: resolve(h.key),
    value: resolve(h.value),
  }));
  const mergedHeaders = mergeKvHeaders(resolvedGlobalHeaders, resolvedHeaders);
  const resolvedQuery = resolve(request.query);

  // Check for unresolved {{variable}} placeholders
  const headerTexts = mergedHeaders.flatMap((h) => [h.key, h.value]);
  const unresolvedVars = extractUnresolvedVars(
    resolvedUrl,
    ...headerTexts,
    resolvedQuery,
  );

  return {
    resolvedRequest: {
      url: resolvedUrl,
      headers: mergedHeaders,
      query: resolvedQuery,
    },
    unresolvedVars,
  };
}
