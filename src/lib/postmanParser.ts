import { generateId } from "@/lib/utils";
import type { AuthConfig, BodyConfig, HttpMethod, KVPair } from "@/types";

/**
 * Minimal structural types for the parts of a Postman Collection v2.1
 * document we consume. The full schema is large; we only model what we read.
 */
type PostmanUrl =
  | string
  | {
      raw?: string;
      query?: Array<{ key?: string; value?: string; disabled?: boolean }>;
    };

type PostmanKV = {
  key?: string;
  value?: string;
  disabled?: boolean;
};

type PostmanBody = {
  mode?: "raw" | "urlencoded" | "formdata" | "file";
  raw?: string;
  urlencoded?: PostmanKV[];
  formdata?: PostmanKV[];
  options?: { raw?: { language?: string } };
};

type PostmanAuth = {
  type?: string;
  bearer?: PostmanKV[];
  basic?: PostmanKV[];
  apikey?: PostmanKV[];
};

type PostmanRequest = {
  method?: string;
  header?: PostmanKV[];
  url?: PostmanUrl;
  body?: PostmanBody;
  auth?: PostmanAuth;
};

type PostmanItem = {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
};

type PostmanCollection = {
  info?: { name?: string; schema?: string; _postman_id?: string };
  item?: PostmanItem[];
};

export type ParsedPostmanRequest = {
  name: string;
  method: HttpMethod;
  url: string;
  params: KVPair[];
  headers: KVPair[];
  auth: AuthConfig;
  body: BodyConfig;
  folderTempId: string | null;
  order: number;
};

export type ParsedPostmanFolder = {
  tempId: string;
  name: string;
  parentTempId: string | null;
  order: number;
};

export type ParsedPostmanCollection = {
  name: string;
  folders: ParsedPostmanFolder[];
  requests: ParsedPostmanRequest[];
};

export class PostmanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostmanParseError";
  }
}

const HTTP_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

/**
 * Detects a Postman Collection v2.1 document. Postman stores the schema URL on
 * `info.schema` (e.g. ".../collection/v2.1.0/collection.json"); the presence of
 * `_postman_id` is a reliable secondary signal.
 */
export function isPostmanCollection(data: Record<string, unknown>): boolean {
  const info = data.info as Record<string, unknown> | undefined;
  if (!info || !Array.isArray(data.item)) return false;
  const schema = typeof info.schema === "string" ? info.schema : "";
  return (
    schema.includes("getpostman.com") || typeof info._postman_id === "string"
  );
}

function toMethod(method: string | undefined): HttpMethod {
  const upper = (method ?? "GET").toUpperCase();
  return (HTTP_METHODS.has(upper) ? upper : "GET") as HttpMethod;
}

function toKVPairs(items: PostmanKV[] | undefined): KVPair[] {
  return (items ?? [])
    .filter((item) => item.key)
    .map((item) => ({
      id: generateId(),
      key: item.key ?? "",
      value: item.value ?? "",
      enabled: !item.disabled,
    }));
}

function parseUrl(url: PostmanUrl | undefined): {
  url: string;
  params: KVPair[];
} {
  if (!url) return { url: "", params: [] };
  if (typeof url === "string") return { url, params: [] };
  return { url: url.raw ?? "", params: toKVPairs(url.query) };
}

function parseAuth(auth: PostmanAuth | undefined): AuthConfig {
  if (!auth) return { type: "none" };

  const find = (pairs: PostmanKV[] | undefined, key: string) =>
    pairs?.find((p) => p.key === key)?.value ?? "";

  switch (auth.type) {
    case "bearer":
      return { type: "bearer", token: find(auth.bearer, "token") };
    case "basic":
      return {
        type: "basic",
        username: find(auth.basic, "username"),
        password: find(auth.basic, "password"),
      };
    case "apikey":
      return {
        type: "api-key",
        key: find(auth.apikey, "key"),
        value: find(auth.apikey, "value"),
        addTo: "header",
      };
    default:
      return { type: "none" };
  }
}

function parseBody(body: PostmanBody | undefined): BodyConfig {
  if (!body || !body.mode) return { type: "none", content: "" };

  switch (body.mode) {
    case "raw": {
      const language = body.options?.raw?.language;
      const type =
        language === "json" || language === "xml" || language === "html"
          ? language
          : "text";
      return { type, content: body.raw ?? "" };
    }
    case "urlencoded":
      return {
        type: "urlencoded",
        content: "",
        formData: toKVPairs(body.urlencoded),
      };
    case "formdata":
      return {
        type: "form-data",
        content: "",
        formData: toKVPairs(body.formdata),
      };
    default:
      return { type: "none", content: "" };
  }
}

type ParseAccumulator = {
  folders: ParsedPostmanFolder[];
  requests: ParsedPostmanRequest[];
};

/**
 * Walks Postman's folder tree, preserving folders as first-class nodes. Folders
 * are items with a nested `item` array; leaf requests carry a `request` object.
 */
function walkItems(
  items: PostmanItem[] | undefined,
  parentFolderTempId: string | null,
  acc: ParseAccumulator,
): void {
  let order = 0;

  for (const item of items ?? []) {
    const name = item.name ?? "Request";

    if (Array.isArray(item.item)) {
      const tempId = generateId();
      acc.folders.push({
        tempId,
        name,
        parentTempId: parentFolderTempId,
        order: order++,
      });
      walkItems(item.item, tempId, acc);
      continue;
    }

    if (!item.request) continue;

    const { url, params } = parseUrl(item.request.url);
    acc.requests.push({
      name,
      method: toMethod(item.request.method),
      url,
      params,
      headers: toKVPairs(item.request.header),
      auth: parseAuth(item.request.auth),
      body: parseBody(item.request.body),
      folderTempId: parentFolderTempId,
      order: order++,
    });
  }
}

export function parsePostmanCollection(
  data: Record<string, unknown>,
): ParsedPostmanCollection {
  const collection = data as PostmanCollection;
  const acc: ParseAccumulator = { folders: [], requests: [] };
  walkItems(collection.item, null, acc);

  if (acc.requests.length === 0) {
    throw new PostmanParseError("No requests found in the Postman collection");
  }

  return {
    name: collection.info?.name ?? "Imported Collection",
    folders: acc.folders,
    requests: acc.requests,
  };
}
