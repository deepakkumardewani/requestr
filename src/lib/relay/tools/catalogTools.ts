import {
  announceSlugChange,
  buildHubModels,
  fetchHubFiles,
  isValidHubSlug,
  markSlugImported,
} from "@/lib/hub";
import { downloadPostmanCollection } from "@/lib/postmanExporter";
import { commitChange } from "../changeLog";
import type { ConfirmPreview, ToolImpl, ToolOutcome } from "./registry";

/**
 * Catalog tools (TOOL-04): a Postman export of one collection, and an import
 * from the API hub. The import asks first and is logged so Undo removes it.
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

const importApiCatalog: ToolImpl<"import_api_catalog"> = {
  name: "import_api_catalog",
  describe: ({ slug }): ConfirmPreview => ({
    action: "change",
    severity: "caution",
    targets: [slug],
    count: 1,
  }),
  run: async ({ slug }, { write }) => {
    if (!isValidHubSlug(slug)) return fail(BAD_SLUG(slug));
    const files = await fetchHubFiles(slug).catch((error: unknown) => {
      console.warn("[relay] reading a catalog provider failed", {
        slug,
        error,
      });
      return null;
    });
    if (!files) return fail(BAD_SLUG(slug));
    const { collection, requests, environment } = buildHubModels(
      files.collection,
      files.environment,
      files.meta,
    );
    const added = await commitChange(
      write,
      {
        entity: "tree",
        entityId: collection.id,
        summary: `Imported "${files.meta.name}" from the API catalog`,
        before: null,
        hubSlug: slug,
        mutate: () => {
          write?.writer.put("collection", collection);
          for (const request of requests) write?.writer.put("request", request);
        },
      },
      { collectionId: collection.id, createdIds: [collection.id] },
    );
    if (!added.ok) return added;
    const withEnvironment = await commitChange(write, {
      entity: "environment",
      entityId: environment.id,
      summary: `Added the "${environment.name}" environment`,
      before: null,
      mutate: () => write?.writer.put("environment", environment),
    });
    if (!withEnvironment.ok) return withEnvironment;
    markSlugImported(slug);
    announceSlugChange();
    return {
      ok: true,
      data: {
        ...added.data,
        changeIds: [added.data.changeId, withEnvironment.data.changeId],
        environmentId: environment.id,
        requestCount: requests.length,
      },
    };
  },
};

export const catalogTools = [exportPostman, importApiCatalog] as const;
