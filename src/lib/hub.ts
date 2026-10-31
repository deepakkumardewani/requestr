import { generateId } from "@/lib/utils";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type {
  BodyType,
  CollectionModel,
  EnvironmentModel,
  EnvVariable,
  HttpMethod,
  KVPair,
  RequestModel,
} from "@/types";
import type {
  HubCollection,
  HubEnvironment,
  HubKVPair,
  HubMeta,
  HubRequest,
} from "@/types/hub";

const IMPORTED_SLUGS_KEY = "requestly_imported_hub_slugs";

// Hub uses "x-www-form-urlencoded"; our BodyType uses "urlencoded"
function mapHubBodyType(type: string): BodyType {
  if (type === "x-www-form-urlencoded") return "urlencoded";
  const valid: BodyType[] = [
    "none",
    "json",
    "xml",
    "text",
    "html",
    "form-data",
    "urlencoded",
  ];
  return valid.includes(type as BodyType) ? (type as BodyType) : "none";
}

function mapHubKVPairs(pairs: HubKVPair[]): KVPair[] {
  return pairs.map((p) => ({ id: generateId(), ...p }));
}

function mapHubRequest(hubReq: HubRequest, collectionId: string): RequestModel {
  return {
    id: generateId(),
    collectionId,
    name: hubReq.name,
    method: hubReq.method as HttpMethod,
    url: hubReq.url,
    params: mapHubKVPairs(hubReq.params),
    headers: mapHubKVPairs(hubReq.headers),
    auth: { type: "none" },
    body: {
      type: mapHubBodyType(hubReq.body.type),
      content: hubReq.body.content,
    },
    preScript: "",
    postScript: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function mapHubEnvironment(
  hubEnv: HubEnvironment,
  meta: HubMeta,
): EnvironmentModel {
  const variables: EnvVariable[] = hubEnv.variables.map((v) => ({
    id: generateId(),
    key: v.key,
    initialValue: v.value,
    currentValue: v.value,
    isSecret: v.secret,
  }));

  return {
    id: generateId(),
    name: meta.name,
    variables,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function getImportedSlugs(): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORTED_SLUGS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markSlugImported(slug: string): void {
  const current = getImportedSlugs();
  current.add(slug);
  localStorage.setItem(IMPORTED_SLUGS_KEY, JSON.stringify([...current]));
}

export function unmarkSlugImported(slug: string): void {
  const current = getImportedSlugs();
  current.delete(slug);
  localStorage.setItem(IMPORTED_SLUGS_KEY, JSON.stringify([...current]));
}

/** The hub cards re-read the slug list on a storage event, which a same-tab write never fires. */
export function announceSlugChange(): void {
  window.dispatchEvent(new Event("storage"));
}

export type HubModels = {
  collection: CollectionModel;
  requests: RequestModel[];
  environment: EnvironmentModel;
};

/** Maps a hub provider's files to app models with fresh ids; nothing is stored. */
export function buildHubModels(
  hubCollection: HubCollection,
  hubEnv: HubEnvironment,
  meta: HubMeta,
): HubModels {
  const now = Date.now();
  const collection: CollectionModel = {
    id: generateId(),
    name: meta.name,
    description: hubCollection.description,
    createdAt: now,
    updatedAt: now,
  };
  return {
    collection,
    requests: hubCollection.requests.map((r) =>
      mapHubRequest(r, collection.id),
    ),
    environment: mapHubEnvironment(hubEnv, meta),
  };
}

export function importHubEntry(
  slug: string,
  hubCollection: HubCollection,
  hubEnv: HubEnvironment,
  meta: HubMeta,
): void {
  const { collection, requests, environment } = buildHubModels(
    hubCollection,
    hubEnv,
    meta,
  );
  useCollectionsStore.getState().bulkImportCollection(collection, requests);
  useEnvironmentsStore.getState().importEnv(environment);
  markSlugImported(slug);
}

/** Hub slugs are directory names under `/data/hub`; anything else could escape it. */
const HUB_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

export const isValidHubSlug = (slug: string): boolean =>
  HUB_SLUG_PATTERN.test(slug);

export type HubFiles = {
  collection: HubCollection;
  environment: HubEnvironment;
  meta: HubMeta;
};

async function fetchHubJson<T>(slug: string, file: string): Promise<T> {
  const response = await fetch(`/data/hub/${slug}/${file}.json`);
  if (!response.ok) throw new Error(`hub provider not found: ${slug}`);
  return (await response.json()) as T;
}

/** Reads the three files of one provider; rejects when the provider does not exist. */
export async function fetchHubFiles(slug: string): Promise<HubFiles> {
  const [collection, environment, meta] = await Promise.all([
    fetchHubJson<HubCollection>(slug, "collection"),
    fetchHubJson<HubEnvironment>(slug, "environment"),
    fetchHubJson<HubMeta>(slug, "meta"),
  ]);
  return { collection, environment, meta };
}
