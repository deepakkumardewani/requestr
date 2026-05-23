import yaml from "js-yaml";
import type {
  ParsedPostmanCollection,
  ParsedPostmanFolder,
  ParsedPostmanRequest,
} from "@/lib/postmanParser";
import { generateId } from "@/lib/utils";
import type { AuthConfig, BodyConfig, HttpMethod, KVPair } from "@/types";

export class InsomniaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsomniaParseError";
  }
}

type Dict = Record<string, unknown>;

const HTTP_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

function toMethod(method: unknown): HttpMethod {
  const upper = String(method ?? "GET").toUpperCase();
  return (HTTP_METHODS.has(upper) ? upper : "GET") as HttpMethod;
}

function parseHeaders(raw: unknown): KVPair[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is Dict => !!h && typeof h === "object")
    .filter((h) => h.name)
    .map((h) => ({
      id: generateId(),
      key: String(h.name ?? ""),
      value: String(h.value ?? ""),
      enabled: !h.disabled,
    }));
}

function parseBody(raw: unknown): BodyConfig {
  if (!raw || typeof raw !== "object") return { type: "none", content: "" };
  const body = raw as Dict;
  const mimeType = String(body.mimeType ?? "");

  if (mimeType.includes("application/json")) {
    return { type: "json", content: String(body.text ?? "") };
  }
  if (mimeType.includes("application/x-www-form-urlencoded")) {
    const params = Array.isArray(body.params) ? (body.params as Dict[]) : [];
    return {
      type: "urlencoded",
      content: "",
      formData: params
        .filter((p) => p.name)
        .map((p) => ({
          id: generateId(),
          key: String(p.name ?? ""),
          value: String(p.value ?? ""),
          enabled: !p.disabled,
        })),
    };
  }
  if (mimeType.includes("multipart/form-data")) {
    const params = Array.isArray(body.params) ? (body.params as Dict[]) : [];
    return {
      type: "form-data",
      content: "",
      formData: params
        .filter((p) => p.name)
        .map((p) => ({
          id: generateId(),
          key: String(p.name ?? ""),
          value: String(p.value ?? ""),
          enabled: !p.disabled,
        })),
    };
  }
  if (mimeType.includes("xml")) {
    return { type: "xml", content: String(body.text ?? "") };
  }
  if (body.text != null) {
    return { type: "text", content: String(body.text) };
  }
  return { type: "none", content: "" };
}

function parseAuth(raw: unknown): AuthConfig {
  if (!raw || typeof raw !== "object") return { type: "none" };
  const auth = raw as Dict;
  if (auth.disabled) return { type: "none" };

  const type = String(auth.type ?? "none");
  if (type === "bearer") {
    return { type: "bearer", token: String(auth.token ?? "") };
  }
  if (type === "basic") {
    return {
      type: "basic",
      username: String(auth.username ?? ""),
      password: String(auth.password ?? ""),
    };
  }
  if (type === "apikey") {
    return {
      type: "api-key",
      key: String(auth.key ?? ""),
      value: String(auth.value ?? ""),
      addTo: "header",
    };
  }
  return { type: "none" };
}

function isRequestNode(node: Dict): boolean {
  return typeof node.url === "string" || typeof node.method === "string";
}

/**
 * Walks the Insomnia v5 nested `collection` tree. Items are either folders
 * (have `children`) or requests (have `url` / `method`).
 */
function walkV5(
  items: unknown,
  parentFolderTempId: string | null,
  folders: ParsedPostmanFolder[],
  requests: ParsedPostmanRequest[],
): void {
  if (!Array.isArray(items)) return;
  let order = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const node = raw as Dict;
    const name = String(node.name ?? "Untitled");

    if (Array.isArray(node.children) || !isRequestNode(node)) {
      const tempId = generateId();
      folders.push({
        tempId,
        name,
        parentTempId: parentFolderTempId,
        order: order++,
      });
      if (Array.isArray(node.children)) {
        walkV5(node.children, tempId, folders, requests);
      }
      continue;
    }

    requests.push({
      name,
      method: toMethod(node.method),
      url: String(node.url ?? ""),
      params: [],
      headers: parseHeaders(node.headers),
      auth: parseAuth(node.authentication),
      body: parseBody(node.body),
      folderTempId: parentFolderTempId,
      order: order++,
    });
  }
}

function parseV5(doc: Dict): ParsedPostmanCollection {
  const name = String(doc.name ?? "Imported from Insomnia");
  const folders: ParsedPostmanFolder[] = [];
  const requests: ParsedPostmanRequest[] = [];
  walkV5(doc.collection, null, folders, requests);

  if (requests.length === 0) {
    throw new InsomniaParseError("No requests found in Insomnia collection");
  }
  return { name, folders, requests };
}

/**
 * Insomnia v4 export: flat `resources` array linked by `parentId`. Reconstructs
 * the folder tree and emits the same shape as the v5 parser.
 */
function parseV4(doc: Dict): ParsedPostmanCollection {
  const resources = Array.isArray(doc.resources)
    ? (doc.resources as Dict[])
    : [];

  let workspaceName = "Imported from Insomnia";
  const groupParent = new Map<string, string>();
  const groupName = new Map<string, string>();

  for (const r of resources) {
    const id = String(r._id ?? "");
    if (r._type === "workspace") {
      workspaceName = String(r.name ?? workspaceName);
    } else if (r._type === "request_group") {
      groupName.set(id, String(r.name ?? "Folder"));
      groupParent.set(id, String(r.parentId ?? ""));
    }
  }

  const folderTempIds = new Map<string, string>();
  const folders: ParsedPostmanFolder[] = [];
  let folderOrder = 0;
  for (const [id, gname] of groupName) {
    const tempId = generateId();
    folderTempIds.set(id, tempId);
    folders.push({
      tempId,
      name: gname,
      parentTempId: null,
      order: folderOrder++,
    });
  }
  for (const folder of folders) {
    const sourceId = [...folderTempIds.entries()].find(
      ([, t]) => t === folder.tempId,
    )?.[0];
    if (!sourceId) continue;
    const parentSourceId = groupParent.get(sourceId);
    if (parentSourceId && folderTempIds.has(parentSourceId)) {
      folder.parentTempId = folderTempIds.get(parentSourceId) ?? null;
    }
  }

  const requests: ParsedPostmanRequest[] = [];
  let order = 0;
  for (const r of resources) {
    if (r._type !== "request") continue;
    const parentId = String(r.parentId ?? "");
    requests.push({
      name: String(r.name ?? "Request"),
      method: toMethod(r.method),
      url: String(r.url ?? ""),
      params: [],
      headers: parseHeaders(r.headers),
      auth: parseAuth(r.authentication),
      body: parseBody(r.body),
      folderTempId: folderTempIds.get(parentId) ?? null,
      order: order++,
    });
  }

  if (requests.length === 0) {
    throw new InsomniaParseError("No requests found in Insomnia export");
  }
  return { name: workspaceName, folders, requests };
}

export function isInsomniaDocument(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Dict;
  if (d._type === "export" && Array.isArray(d.resources)) return true;
  return (
    typeof d.type === "string" && d.type.startsWith("collection.insomnia.rest/")
  );
}

/**
 * Parses raw Insomnia export text (YAML for v5+, JSON for v4) into the same
 * folders-and-requests shape used by the Postman importer.
 */
export function parseInsomnia(text: string): ParsedPostmanCollection {
  let doc: unknown;
  try {
    doc = yaml.load(text);
  } catch (err) {
    throw new InsomniaParseError(
      err instanceof Error ? err.message : "Failed to parse Insomnia file",
    );
  }

  if (!isInsomniaDocument(doc)) {
    throw new InsomniaParseError("Not a recognized Insomnia export");
  }

  const d = doc as Dict;
  if (d._type === "export") return parseV4(d);
  return parseV5(d);
}
