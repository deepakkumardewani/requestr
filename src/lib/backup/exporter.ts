import { version as APP_VERSION } from "../../../package.json";
import { getLooseDB, type StoreName } from "../idb";
import { IDB_VERSION } from "../idbSchema";
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SECTIONS,
  type BackupSection,
} from "./constants";
import { readPreferences } from "./preferences";
import type { BackupData, BackupEnvelope } from "./schema";
import { applySecretPolicy } from "./secrets";
import {
  applySelection,
  type BackupSelection,
  countDanglingReferences,
} from "./selection";
import { type BackupEstimate, estimateBackup } from "./sizeEstimate";

/** A list-valued `data` key and the IDB store it mirrors. */
export type ListKey = Exclude<keyof BackupData, "settings" | "preferences">;
type SectionList = { dataKey: ListKey; store: StoreName };

/** Sections stored as record lists; settings and preferences are special-cased. */
export const SECTION_LISTS: Partial<Record<BackupSection, SectionList[]>> = {
  collections: [
    { dataKey: "collections", store: "collections" },
    { dataKey: "folders", store: "folders" },
    { dataKey: "requests", store: "requests" },
    { dataKey: "chainConfigs", store: "chainConfigs" },
  ],
  environments: [{ dataKey: "environments", store: "environments" }],
  chains: [{ dataKey: "chains", store: "chains" }],
  history: [
    { dataKey: "history", store: "history" },
    { dataKey: "chainRuns", store: "chainRuns" },
  ],
  relayThreads: [
    { dataKey: "relayThreads", store: "relay_threads" },
    { dataKey: "relayChanges", store: "relay_changes" },
  ],
};

/** The `settings` store keeps one out-of-line record under this key. */
export const SETTINGS_STORE: StoreName = "settings";
export const SETTINGS_RECORD_KEY = "app";

export type BackupOptions = {
  sections: readonly BackupSection[];
  selection?: BackupSelection;
  includeSecrets: boolean;
};

export type PreparedBackup = {
  envelope: Omit<BackupEnvelope, "data">;
  data: BackupData;
  estimate: BackupEstimate;
  danglingCount: number;
};

/** Canonical order, with `preferences` riding along exactly when `settings` is in. */
export function normalizeSections(
  sections: readonly BackupSection[],
): BackupSection[] {
  const wanted = new Set(sections);
  return BACKUP_SECTIONS.filter((section) =>
    section === "preferences" ? wanted.has("settings") : wanted.has(section),
  );
}

async function readSectionData(section: BackupSection): Promise<BackupData> {
  if (section === "preferences") return { preferences: readPreferences() };
  if (section === "settings") {
    const db = await getLooseDB();
    const settings = await db.get(SETTINGS_STORE, SETTINGS_RECORD_KEY);
    return { settings: settings ?? {} };
  }
  const data: BackupData = {};
  for (const { dataKey, store } of SECTION_LISTS[section] ?? []) {
    const db = await getLooseDB();
    data[dataKey] = await db.getAll(store);
  }
  return data;
}

/** Raw records of the given sections, unchanged (ids, timestamps, ordering). */
export async function collectBackupData(
  sections: readonly BackupSection[],
): Promise<BackupData> {
  const parts = await Promise.all(
    normalizeSections(sections).map(readSectionData),
  );
  return Object.assign({}, ...parts) as BackupData;
}

/** Reads, narrows by selection and applies the secret policy; nothing is written. */
export async function prepareBackup(
  options: BackupOptions,
  now: Date = new Date(),
): Promise<PreparedBackup> {
  const sections = normalizeSections(options.sections);
  const raw = await collectBackupData(sections);
  const selected = options.selection
    ? applySelection(raw, options.selection)
    : raw;
  const data = applySecretPolicy(selected, {
    includeSecrets: options.includeSecrets,
  });
  return {
    envelope: {
      app: BACKUP_APP_ID,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      idbVersion: IDB_VERSION,
      exportedAt: now.toISOString(),
      appVersion: APP_VERSION,
      includesSecrets: options.includeSecrets,
      sections,
    },
    data,
    estimate: estimateBackup(data),
    // Counted on the pre-policy data: blanking secrets never changes references.
    danglingCount: countDanglingReferences(selected),
  };
}

/** Header, then one Blob part per `data` key, so no single giant string exists. */
export function toBackupBlob({ envelope, data }: PreparedBackup): Blob {
  const header = JSON.stringify(envelope).slice(0, -1);
  const parts: BlobPart[] = [`${header},"data":{`];
  Object.entries(data).forEach(([key, value], index) => {
    parts.push(`${index === 0 ? "" : ","}${JSON.stringify(key)}:`);
    parts.push(JSON.stringify(value));
  });
  parts.push("}}");
  return new Blob(parts, { type: "application/json" });
}
