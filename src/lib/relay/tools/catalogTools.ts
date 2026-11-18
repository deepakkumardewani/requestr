import {
  announceSlugChange,
  buildHubModels,
  fetchHubFiles,
  fetchHubIndex,
  getCachedHubIndex,
  getImportedSlugs,
  type HubIndexEntry,
  importHubModels,
  isValidHubSlug,
  unmarkSlugImported,
} from "@/lib/hub";
import { downloadPostmanCollection } from "@/lib/postmanExporter";
import { commitChange } from "../changeLog";
import type { ConfirmPreview, ToolImpl, ToolOutcome } from "./registry";

/**
 * Catalog tools (TOOL-04): a Postman export of one collection, a listing of the
 * API hub, and an import from it. The import asks first, checks the slug before
 * any card shows, and lands as one logged change so Undo removes it.
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const exportPostman: ToolImpl<"export_postman"> = {
  name: "export_postman",
  refs: ({ collectionId }) => [{ kind: "collection", id: collectionId }],
  run: ({ collectionId }, { store }) => {
    const collection = store
      .collections()
      .find((item) => item.id === collectionId);
    if (!collection) return fail(`collection not found: ${collectionId}`);
    const requests = store
      .requests()
      .filter((request) => request.collectionId === collectionId);
    const folders = store
      .folders()
      .filter((folder) => folder.collectionId === collectionId);
    downloadPostmanCollection(collection, [...requests], [...folders]);
    return {
      ok: true,
      data: {
        summary: `Exported "${collection.name}" for Postman`,
        requestCount: requests.length,
      },
    };
  },
};

const BAD_SLUG = (slug: string) => `not a catalog provider: ${slug}`;
const ALREADY_IMPORTED = (slug: string) => `already imported: ${slug}`;
const CATALOG_UNAVAILABLE = "the API catalog could not be loaded";
const CATALOG_PAGE_DEFAULT = 20;

const matchesQuery = ({ slug, meta }: HubIndexEntry, query: string): boolean =>
  [slug, meta.name, meta.description, meta.category].some((field) =>
    field?.toLowerCase().includes(query),
  );

const listApiCatalog: ToolImpl<"list_api_catalog"> = {
  name: "list_api_catalog",
  run: async ({ query, offset, limit }) => {
    const index = await fetchHubIndex().catch((error: unknown) => {
      console.warn("[relay] reading the API catalog failed", { error });
      return null;
    });
    if (!index) return fail(CATALOG_UNAVAILABLE);
    const needle = query?.trim().toLowerCase();
    const matches = needle
      ? index.filter((entry) => matchesQuery(entry, needle))
      : index;
    const start = offset ?? 0;
    const page = matches.slice(start, start + (limit ?? CATALOG_PAGE_DEFAULT));
    const imported = getImportedSlugs();
    const next = start + page.length;
    return {
      ok: true,
      data: {
        total: matches.length,
        providers: page.map(({ slug, meta }) => ({
          slug,
          name: meta.name,
          description: meta.description,
          category: meta.category,
          requestCount: meta.requestCount ?? null,
          imported: imported.has(slug),
        })),
        nextOffset: next < matches.length ? next : null,
      },
    };
  },
};

function checkAgainstIndex(
  slug: string,
  index: readonly HubIndexEntry[],
): string | null {
  return index.some((entry) => entry.slug === slug) ? null : BAD_SLUG(slug);
}

/**
 * Cheap checks run first and synchronously, so the card can be vetoed without
 * the network. A cold index is awaited by the registry; if it cannot be read,
 * `run` reports the failure itself.
 */
function validateSlug(slug: string): string | null | Promise<string | null> {
  if (!isValidHubSlug(slug)) return BAD_SLUG(slug);
  if (getImportedSlugs().has(slug)) return ALREADY_IMPORTED(slug);
  const cached = getCachedHubIndex();
  if (cached) return checkAgainstIndex(slug, cached);
  return fetchHubIndex().then(
    (index) => checkAgainstIndex(slug, index),
    () => null,
  );
}

const importApiCatalog: ToolImpl<"import_api_catalog"> = {
  name: "import_api_catalog",
  validate: ({ slug }) => validateSlug(slug),
  describe: ({ slug }): ConfirmPreview => ({
    action: "change",
    severity: "caution",
    targets: [slug],
    count: 1,
  }),
  run: async ({ slug }, { write }) => {
    const problem = await validateSlug(slug);
    if (problem) return fail(problem);
    const files = await fetchHubFiles(slug).catch((error: unknown) => {
      console.warn("[relay] reading a catalog provider failed", {
        slug,
        error,
      });
      return null;
    });
    if (!files) return fail(BAD_SLUG(slug));
    const models = buildHubModels(
      files.collection,
      files.environment,
      files.meta,
    );
    const { collection, requests, environment } = models;
    const added = await commitChange(
      write,
      {
        entity: "tree",
        entityId: collection.id,
        summary: `Imported "${files.meta.name}" from the API catalog`,
        before: null,
        hubSlug: slug,
        hubEnvironmentId: environment.id,
        mutate: () => {
          try {
            importHubModels(slug, models, {
              putCollection: () => {
                write?.writer.put("collection", collection);
                for (const request of requests) {
                  write?.writer.put("request", request);
                }
              },
              putEnvironment: () =>
                write?.writer.put("environment", environment),
            });
          } catch (error) {
            // The rollback restores the tree only; the environment is ours to drop.
            write?.writer.remove("environment", environment.id);
            throw error;
          }
        },
      },
      { collectionId: collection.id, createdIds: [collection.id] },
    );
    if (!added.ok) {
      unmarkSlugImported(slug);
      return added;
    }
    announceSlugChange();
    return {
      ok: true,
      data: {
        ...added.data,
        environmentId: environment.id,
        requestCount: requests.length,
      },
    };
  },
};

export const catalogTools = [
  exportPostman,
  listApiCatalog,
  importApiCatalog,
] as const;
