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

/** Where an import lands: the app stores by default, Relay's change writer when it must be undoable. */
export type HubImportSink = {
  putCollection: (
    collection: CollectionModel,
    requests: RequestModel[],
  ) => void;
  putEnvironment: (environment: EnvironmentModel) => void;
};

const storeSink: HubImportSink = {
  putCollection: (collection, requests) =>
    useCollectionsStore.getState().bulkImportCollection(collection, requests),
  putEnvironment: (environment) =>
    useEnvironmentsStore.getState().importEnv(environment),
};

/** Writes already-built models and marks the slug only after both writes landed. */
export function importHubModels(
  slug: string,
  models: HubModels,
  sink: HubImportSink = storeSink,
): void {
  sink.putCollection(models.collection, models.requests);
  sink.putEnvironment(models.environment);
  markSlugImported(slug);
}

/** The one import path for the Hub card; Relay uses `importHubModels` with its own sink. */
export function importHubEntry(
  slug: string,
  hubCollection: HubCollection,
  hubEnv: HubEnvironment,
  meta: HubMeta,
): void {
  importHubModels(slug, buildHubModels(hubCollection, hubEnv, meta));
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

export type HubIndexEntry = { slug: string; meta: HubMeta };

let hubIndexCache: HubIndexEntry[] | null = null;

/** The providers read so far, or null before the first successful read; lets sync checks run without the network. */
export const getCachedHubIndex = (): readonly HubIndexEntry[] | null =>
  hubIndexCache;

/** Test seam: forgets the cached index. */
export function resetHubIndexCache(): void {
  hubIndexCache = null;
}

/** Reads the provider list and each provider's meta once; a failed read is not cached. */
export async function fetchHubIndex(): Promise<HubIndexEntry[]> {
  if (hubIndexCache) return [...hubIndexCache];
  const indexResponse = await fetch("/api/hub");
  if (!indexResponse.ok) throw new Error("Failed to fetch hub index");
  const { slugs } = (await indexResponse.json()) as { slugs: string[] };
  const entries = await Promise.all(
    slugs.filter(isValidHubSlug).map(async (slug) => {
      const response = await fetch(`/data/hub/${slug}/meta.json`);
      if (!response.ok) return null;
      return { slug, meta: (await response.json()) as HubMeta };
    }),
  );
  hubIndexCache = entries.filter(
    (entry): entry is HubIndexEntry => entry !== null,
  );
  return [...hubIndexCache];
}
