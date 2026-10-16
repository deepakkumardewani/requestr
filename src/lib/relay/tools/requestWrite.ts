import { parseFormDataFromContent } from "@/lib/bodyFormData";
import { generateId } from "@/lib/utils";
import type {
  AuthConfig,
  BodyConfig,
  BodyType,
  KVPair,
  RequestModel,
} from "@/types";
import { commitChange } from "../changeLog";
import {
  isSensitiveName,
  REDACTED,
  redactSecretLiteral,
  redactValue,
} from "../redact";
import type { StoreAccess } from "../storeAccess";
import type {
  ConfirmPreview,
  ToolContext,
  ToolImpl,
  ToolOutcome,
} from "./registry";
import { PREVIEW_TARGETS_MAX, type RelayToolInput } from "./schemas";

/**
 * Request write tools (SPEC section 5). Everything they store is validated
 * first: URL schemes are allow-listed, secrets must be `{{var}}` references
 * and scripts are kept as text that this module never runs (SPEC section 8).
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const ALLOWED_URL = /^(?:https?|wss?):\/\//i;
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const CONTROL_GUIDANCE =
  "values must not contain line breaks or control characters";
const LEADING_VARIABLE = /^\{\{\s*[\w.-]+\s*\}\}/;
const URL_GUIDANCE =
  "url must start with http://, https://, ws:// or wss://, or with a {{variable}} such as {{baseUrl}}";
const SECRET_GUIDANCE =
  "use an environment variable reference such as {{API_TOKEN}} instead of the literal value";
const NOTHING_TO_CHANGE = "nothing to change: every field was null";

/** The store has no GraphQL body type; GraphQL over HTTP is a JSON body. */
const BODY_TYPE_MAP: Record<
  RelayToolInput<"set_request_body">["body"]["type"],
  BodyType
> = {
  json: "json",
  text: "text",
  form: "form-data",
  urlencoded: "urlencoded",
  graphql: "json",
  none: "none",
};

/* -------------------------------- validation -------------------------------- */

/** True when a (variable-resolved) URL starts with http, https, ws or wss. */
export function hasAllowedScheme(url: string): boolean {
  return ALLOWED_URL.test(url.trim());
}

/** Line breaks and other control characters would let a value smuggle in headers. */
function hasControlChars(value: string): boolean {
  return CONTROL_CHARS.test(value);
}

export function urlProblem(url: string): string | null {
  if (hasControlChars(url)) return CONTROL_GUIDANCE;
  const trimmed = url.trim();
  if (hasAllowedScheme(trimmed) || LEADING_VARIABLE.test(trimmed)) return null;
  return URL_GUIDANCE;
}

/** True for values that are empty or built only from `{{var}}` references. */
function isSafeSecretValue(value: string): boolean {
  return value !== REDACTED && redactSecretLiteral(value) === value;
}

function pairLooksSecret({
  key,
  value,
}: Pick<KVPair, "key" | "value">): boolean {
  if (value === REDACTED) return true;
  return isSensitiveName(key)
    ? redactSecretLiteral(value) !== value
    : redactValue(value) !== value;
}

export function secretPairProblem(
  pairs: readonly Pick<KVPair, "key" | "value">[],
): string | null {
  if (pairs.some((pair) => hasControlChars(pair.key + pair.value))) {
    return CONTROL_GUIDANCE;
  }
  const offender = pairs.find(pairLooksSecret);
  return offender
    ? `"${offender.key}" looks like a literal secret: ${SECRET_GUIDANCE}`
    : null;
}

export type AuthInput = RelayToolInput<"set_request_auth">["auth"];

function secretField(label: string, value: string): string | null {
  return isSafeSecretValue(value)
    ? null
    : `${label} looks like a literal secret: ${SECRET_GUIDANCE}`;
}

/** Maps tool input to the store's auth shape, or explains why it is refused. */
export function toAuthConfig(auth: AuthInput): AuthConfig | string {
  switch (auth.type) {
    case "none":
      return { type: "none" };
    case "bearer": {
      const token = auth.token ?? "";
      return secretField("token", token) ?? { type: "bearer", token };
    }
    case "basic": {
      const password = auth.password ?? "";
      return (
        secretField("password", password) ?? {
          type: "basic",
          username: auth.username ?? "",
          password,
        }
      );
    }
    case "apikey": {
      if (!auth.keyName) return "keyName is required for an API key";
      const value = auth.keyValue ?? "";
      return (
        secretField("keyValue", value) ?? {
          type: "api-key",
          key: auth.keyName,
          value,
          addTo: auth.addTo ?? "header",
        }
      );
    }
  }
}

/* ---------------------------------- helpers --------------------------------- */

type PairInput = { key: string; value: string; enabled: boolean };

export function toPair(input: PairInput, type?: KVPair["type"]): KVPair {
  return {
    id: generateId(),
    key: input.key,
    value: input.value,
    enabled: input.enabled,
    ...(type ? { type } : {}),
  };
}

const sameKey = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Removes by name, then updates matching rows in place and appends new ones. */
function mergePairs(
  existing: readonly KVPair[],
  upsert: readonly PairInput[] | null,
  remove: readonly string[] | null,
  type?: KVPair["type"],
): KVPair[] {
  const kept = existing.filter(
    (pair) => !(remove ?? []).some((key) => sameKey(key, pair.key)),
  );
  const rows = [...kept];
  for (const input of upsert ?? []) {
    const index = rows.findIndex((pair) => sameKey(pair.key, input.key));
    if (index < 0) {
      rows.push(toPair(input, type));
      continue;
    }
    rows[index] = {
      ...rows[index],
      value: input.value,
      enabled: input.enabled,
    };
  }
  return rows;
}

function toBody({
  type,
  content,
}: {
  type: keyof typeof BODY_TYPE_MAP;
  content: string;
}): BodyConfig {
  const mapped = BODY_TYPE_MAP[type];
  if (mapped === "none") return { type: "none", content: "" };
  if (mapped === "form-data") {
    return {
      type: mapped,
      content,
      formData: parseFormDataFromContent(content),
    };
  }
  return { type: mapped, content };
}

function findRequest(store: StoreAccess, id: string): RequestModel | undefined {
  return store.requests().find((request) => request.id === id);
}

/** Runs a change on one existing request through the log. */
function editRequest(
  { store, write }: ToolContext,
  requestId: string,
  summary: (request: RequestModel) => string,
  edit: (request: RequestModel) => Partial<RequestModel> | string,
): ReturnType<typeof commitChange> | ToolOutcome {
  const request = findRequest(store, requestId);
  if (!request) return fail(`request not found: ${requestId}`);
  const patch = edit(request);
  if (typeof patch === "string") return fail(patch);
  return commitChange(write, {
    entity: "request",
    entityId: requestId,
    summary: summary(request),
    before: request,
    mutate: () => write?.writer.put("request", { ...request, ...patch }),
  });
}

const requestRef = (input: { requestId: string }) => [
  { kind: "request" as const, id: input.requestId },
];

/* ----------------------------------- tools ---------------------------------- */

const createRequest: ToolImpl<"create_request"> = {
  name: "create_request",
  refs: ({ collectionId, folderId }) => [
    { kind: "collection", id: collectionId },
    ...(folderId ? [{ kind: "folder" as const, id: folderId }] : []),
  ],
  run: async (input, { store, write }) => {
    const name = input.name.trim();
    if (!name) return fail("name must not be empty");
    const folder = input.folderId
      ? store.folders().find((item) => item.id === input.folderId)
      : undefined;
    if (folder && folder.collectionId !== input.collectionId) {
      return fail("folder is not inside that collection");
    }
    const problem =
      urlProblem(input.url) ??
      secretPairProblem([...(input.headers ?? []), ...(input.params ?? [])]);
    if (problem) return fail(problem);
    const auth = input.auth
      ? toAuthConfig(input.auth)
      : ({ type: "none" } as const);
    if (typeof auth === "string") return fail(auth);

    const now = Date.now();
    const request: RequestModel = {
      id: generateId(),
      collectionId: input.collectionId,
      folderId: input.folderId,
      name,
      method: input.method,
      url: input.url.trim(),
      params: (input.params ?? []).map((pair) => toPair(pair, "query")),
      headers: (input.headers ?? []).map((pair) => toPair(pair)),
      auth,
      body: input.body ? toBody(input.body) : { type: "none", content: "" },
      preScript: "",
      postScript: "",
      createdAt: now,
      updatedAt: now,
    };
    return commitChange(
      write,
      {
        entity: "request",
        entityId: request.id,
        summary: `Created ${request.method} "${name}"`,
        before: null,
        mutate: () => write?.writer.put("request", request),
      },
      { requestId: request.id, createdIds: [request.id] },
    );
  },
};

const updateRequest: ToolImpl<"update_request"> = {
  name: "update_request",
  refs: requestRef,
  run: async (input, context) => {
    if (input.name === null && input.method === null && input.url === null) {
      return fail(NOTHING_TO_CHANGE);
    }
    return editRequest(
      context,
      input.requestId,
      (request) => `Updated "${request.name}"`,
      () => {
        const name = input.name?.trim();
        if (name === "") return "name must not be empty";
        const problem = input.url === null ? null : urlProblem(input.url);
        if (problem) return problem;
        return {
          ...(name ? { name } : {}),
          ...(input.method ? { method: input.method } : {}),
          ...(input.url === null ? {} : { url: input.url.trim() }),
        };
      },
    );
  },
};

const duplicateRequest: ToolImpl<"duplicate_request"> = {
  name: "duplicate_request",
  refs: ({ requestId, toCollectionId }) => [
    { kind: "request", id: requestId },
    ...(toCollectionId
      ? [{ kind: "collection" as const, id: toCollectionId }]
      : []),
  ],
  run: async ({ requestId, toCollectionId }, { store, write }) => {
    const source = findRequest(store, requestId);
    if (!source) return fail(`request not found: ${requestId}`);
    const collectionId = toCollectionId ?? source.collectionId;
    const now = Date.now();
    const copy: RequestModel = {
      ...source,
      id: generateId(),
      collectionId,
      folderId: collectionId === source.collectionId ? source.folderId : null,
      name: `${source.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    };
    return commitChange(
      write,
      {
        entity: "request",
        entityId: copy.id,
        summary: `Duplicated "${source.name}"`,
        before: null,
        mutate: () => write?.writer.put("request", copy),
      },
      { requestId: copy.id, createdIds: [copy.id] },
    );
  },
};

const setRequestHeaders: ToolImpl<"set_request_headers"> = {
  name: "set_request_headers",
  refs: requestRef,
  run: async (input, context) => {
    const problem = secretPairProblem(input.upsert ?? []);
    if (problem) return fail(problem);
    return editRequest(
      context,
      input.requestId,
      (request) => `Updated headers of "${request.name}"`,
      (request) => ({
        headers: mergePairs(request.headers, input.upsert, input.remove),
      }),
    );
  },
};

const setRequestParams: ToolImpl<"set_request_params"> = {
  name: "set_request_params",
  refs: requestRef,
  run: async (input, context) => {
    const problem = secretPairProblem(input.upsert ?? []);
    if (problem) return fail(problem);
    return editRequest(
      context,
      input.requestId,
      (request) => `Updated parameters of "${request.name}"`,
      (request) => ({
        params: mergePairs(request.params, input.upsert, input.remove, "query"),
      }),
    );
  },
};

const setRequestBody: ToolImpl<"set_request_body"> = {
  name: "set_request_body",
  refs: requestRef,
  run: (input, context) =>
    editRequest(
      context,
      input.requestId,
      (request) => `Updated body of "${request.name}"`,
      () => ({ body: toBody(input.body) }),
    ),
};

const setRequestAuth: ToolImpl<"set_request_auth"> = {
  name: "set_request_auth",
  refs: requestRef,
  run: (input, context) =>
    editRequest(
      context,
      input.requestId,
      (request) => `Updated auth of "${request.name}"`,
      () => {
        const auth = toAuthConfig(input.auth);
        return typeof auth === "string" ? auth : { auth };
      },
    ),
};

const setRequestScripts: ToolImpl<"set_request_scripts"> = {
  name: "set_request_scripts",
  refs: requestRef,
  run: async ({ requestId, pre, post }, context) => {
    if (pre === null && post === null) return fail(NOTHING_TO_CHANGE);
    return editRequest(
      context,
      requestId,
      (request) => `Updated scripts of "${request.name}"`,
      () => ({
        ...(pre === null ? {} : { preScript: pre }),
        ...(post === null ? {} : { postScript: post }),
      }),
    );
  },
};

type BulkOp = RelayToolInput<"bulk_update_requests">["op"];

function applyBulkOp(request: RequestModel, op: BulkOp): RequestModel | string {
  const url = op.urlReplace
    ? request.url.split(op.urlReplace.find).join(op.urlReplace.replace)
    : request.url;
  const problem = urlProblem(url);
  if (problem) return `"${request.name}": ${problem}`;
  return {
    ...request,
    method: op.method ?? request.method,
    url,
    headers: mergePairs(request.headers, op.upsertHeaders, op.removeHeaders),
  };
}

const bulkUpdateRequests: ToolImpl<"bulk_update_requests"> = {
  name: "bulk_update_requests",
  refs: ({ ids }) => ids.map((id) => ({ kind: "request" as const, id })),
  // Only shown above the bulk threshold; the registry decides when Approve is needed.
  describe: ({ ids }, store): ConfirmPreview => {
    const targets = [...new Set(ids)]
      .map((id) => findRequest(store, id))
      .filter((request): request is RequestModel => request !== undefined);
    return {
      action: "bulkUpdate",
      severity: "caution",
      targets: targets.slice(0, PREVIEW_TARGETS_MAX).map((r) => r.name),
      count: targets.length,
    };
  },
  run: async ({ ids, op }, { store, write }) => {
    if (
      op.method === null &&
      op.urlReplace === null &&
      op.upsertHeaders === null &&
      op.removeHeaders === null
    ) {
      return fail(NOTHING_TO_CHANGE);
    }
    const secretProblem = secretPairProblem(op.upsertHeaders ?? []);
    if (secretProblem) return fail(secretProblem);

    const targets = [...new Set(ids)]
      .map((id) => findRequest(store, id))
      .filter((request): request is RequestModel => request !== undefined);
    const updated = targets.map((request) => applyBulkOp(request, op));
    const refusal = updated.find((item) => typeof item === "string");
    if (refusal) return fail(String(refusal));

    return commitChange(
      write,
      {
        entity: "requests",
        entityId: targets.map((request) => request.id).join(","),
        summary: `Updated ${targets.length} requests`,
        before: targets,
        mutate: () => {
          for (const request of updated as RequestModel[]) {
            write?.writer.put("request", request);
          }
        },
      },
      { updatedIds: targets.map((request) => request.id) },
    );
  },
};

export const requestWriteTools = [
  createRequest,
  updateRequest,
  duplicateRequest,
  setRequestHeaders,
  setRequestParams,
  setRequestBody,
  setRequestAuth,
  setRequestScripts,
  bulkUpdateRequests,
] as const;
