import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SIZE_WARN_BYTES,
  type BackupSection,
} from "./constants";
import type { BackupError } from "./errors";
import { type ListKey, SECTION_LISTS } from "./exporter";
import { migrateBackup } from "./migrations";
import { type BackupEnvelope, backupEnvelopeSchema } from "./schema";

export type BackupWarning = "largeFile";

export type ValidationResult =
  | { ok: true; envelope: BackupEnvelope; warnings: BackupWarning[] }
  | { ok: false; error: BackupError };

type Rec = Record<string, unknown>;

/** The field IndexedDB uses as the record key; a record without it cannot be written. */
const RECORD_KEY_FIELD: Record<ListKey, string> = {
  collections: "id",
  folders: "id",
  requests: "id",
  chainConfigs: "collectionId",
  environments: "id",
  chains: "id",
  history: "id",
  chainRuns: "id",
  relayThreads: "id",
  relayChanges: "id",
};

const fail = (error: BackupError): ValidationResult => ({ ok: false, error });

const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function hasKeyField(item: unknown, field: string): boolean {
  return isRec(item) && typeof item[field] === "string" && item[field] !== "";
}

/** Which section owns a `data` key, or undefined for a key no section owns. */
function sectionOfKey(key: string): BackupSection | undefined {
  if (key === "settings" || key === "preferences") return key;
  return (Object.keys(SECTION_LISTS) as BackupSection[]).find((section) =>
    SECTION_LISTS[section]?.some(({ dataKey }) => dataKey === key),
  );
}

function keysOfSection(section: BackupSection): string[] {
  if (section === "settings" || section === "preferences") return [section];
  return (SECTION_LISTS[section] ?? []).map(({ dataKey }) => dataKey);
}

/** The first section whose data is missing, foreign to `sections`, or holds unwritable records. */
function findDamagedSection(envelope: BackupEnvelope): BackupSection | null {
  const listed = new Set(envelope.sections);
  const data = envelope.data as Rec;
  for (const key of Object.keys(data)) {
    const owner = sectionOfKey(key);
    if (!owner || !listed.has(owner)) return owner ?? envelope.sections[0];
  }
  for (const section of envelope.sections) {
    if (!keysOfSection(section).every((key) => key in data)) return section;
    const bad = (SECTION_LISTS[section] ?? []).some(
      ({ dataKey }) =>
        !(data[dataKey] as unknown[]).every((item) =>
          hasKeyField(item, RECORD_KEY_FIELD[dataKey]),
        ),
    );
    if (bad) return section;
  }
  return null;
}

/** The section a zod issue on `data.<key>` points at. */
function sectionOfIssuePath(path: PropertyKey[]): BackupSection | undefined {
  return path[0] === "data" ? sectionOfKey(String(path[1])) : undefined;
}

function checkVersion(raw: Rec): ValidationResult | Rec {
  const version = raw.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    return fail({ code: "invalidFile" });
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    return fail({ code: "newerVersion", schemaVersion: version });
  }
  if (version === BACKUP_SCHEMA_VERSION) return raw;
  return migrateBackup(raw, version) ?? fail({ code: "unsupportedVersion" });
}

function checkEnvelope(raw: Rec): ValidationResult | BackupEnvelope {
  const parsed = backupEnvelopeSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const section = sectionOfIssuePath(parsed.error.issues[0].path);
  return section
    ? fail({ code: "damagedSection", section })
    : fail({ code: "invalidFile" });
}

const isResult = (value: unknown): value is ValidationResult =>
  isRec(value) && "ok" in value;

/**
 * Parses and checks backup text without touching any store. Files over
 * `BACKUP_SIZE_WARN_BYTES` still validate and carry a warning; pass the file's
 * byte size, since a string's length undercounts multi-byte text.
 */
export function validateBackup(
  text: string,
  sizeBytes: number = text.length,
): ValidationResult {
  const raw = parseJson(text);
  if (raw === undefined) return fail({ code: "invalidJson" });
  if (!isRec(raw) || raw.app !== BACKUP_APP_ID) {
    return fail({ code: "foreignFile" });
  }

  const versioned = checkVersion(raw);
  if (isResult(versioned)) return versioned;

  const envelope = checkEnvelope(versioned);
  if (isResult(envelope)) return envelope;

  const damaged = findDamagedSection(envelope);
  if (damaged) return fail({ code: "damagedSection", section: damaged });

  const warnings: BackupWarning[] =
    sizeBytes > BACKUP_SIZE_WARN_BYTES ? ["largeFile"] : [];
  return { ok: true, envelope, warnings };
}
