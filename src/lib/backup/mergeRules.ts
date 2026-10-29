import { type IdRemap, rewriteReferences } from "./remap";

export type Rec = Record<string, unknown>;

/** Appended to the name of an incoming collection, environment, chain or request that collides. */
export const IMPORTED_SUFFIX = " (imported)";

/** Volatile: ignored when deciding whether two records are the same. */
const IGNORED_FIELD = "updatedAt";

const HASH_RADIX = 36;
const HASH_SEED = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

export type ListMergeSpec = {
  /** The record's IDB key field (`id`, or `collectionId` for chainConfigs). */
  keyField: string;
  /** Collisions rename the incoming record with `IMPORTED_SUFFIX`. */
  named?: boolean;
  /** Collisions keep the existing record and drop the incoming one (the key cannot be re-issued). */
  keepExistingOnCollision?: boolean;
  /** Applied to every record Merge adds, e.g. marking relay changes not undoable. */
  finalize?: (record: Rec) => Rec;
};

export type ListMergeResult = {
  adds: Rec[];
  /** Incoming records already present, equal in content. */
  skipped: number;
  /** Incoming records stored next to a different record with the same id. */
  kept: number;
};

const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => deepEqual(item, b[index]))
    );
  }
  if (!isRec(a) || !isRec(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => key in b && deepEqual(a[key], b[key]))
  );
}

function withoutIgnored(record: Rec): Rec {
  const { [IGNORED_FIELD]: _ignored, ...rest } = record;
  return rest;
}

/** Deep equality of two records, ignoring a top-level `updatedAt`. */
export function recordsEqual(a: Rec, b: Rec): boolean {
  return deepEqual(withoutIgnored(a), withoutIgnored(b));
}

/** FNV-1a over the text, so the same incoming record always gets the same new id. */
function contentHash(text: string): string {
  let hash = HASH_SEED;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, HASH_PRIME);
  }
  return (hash >>> 0).toString(HASH_RADIX);
}

/**
 * The id a colliding record is stored under. Deriving it from the record
 * (not random) makes importing the same file twice a no-op.
 */
function collisionId(original: Rec, keyField: string): string {
  return `${String(original[keyField])}-i${contentHash(JSON.stringify(original))}`;
}

function renamed(record: Rec, newId: string, spec: ListMergeSpec): Rec {
  const next: Rec = { ...record, [spec.keyField]: newId };
  if (spec.named && typeof next.name === "string") {
    next.name = `${next.name}${IMPORTED_SUFFIX}`;
  }
  return spec.finalize ? spec.finalize(next) : next;
}

/**
 * Merges one list. Incoming references are rewritten through `remap` first, so
 * a child of a renamed parent is compared (and stored) against its new parent.
 * New ids are recorded in `remap` for the lists processed after this one.
 * Existing records are never changed.
 */
export function mergeList(
  existing: Rec[],
  incoming: Rec[],
  remap: IdRemap,
  spec: ListMergeSpec,
): ListMergeResult {
  const finalize = spec.finalize ?? ((record: Rec) => record);
  const byKey = new Map(
    existing.map((record) => [String(record[spec.keyField]), record]),
  );
  const result: ListMergeResult = { adds: [], skipped: 0, kept: 0 };

  for (const original of incoming) {
    const record = rewriteReferences(original, remap);
    const key = String(record[spec.keyField]);
    const current = byKey.get(key);

    if (!current) {
      const added = finalize(record);
      result.adds.push(added);
      byKey.set(key, added);
      continue;
    }
    const unchanged =
      recordsEqual(current, record) || recordsEqual(current, finalize(record));
    if (unchanged || spec.keepExistingOnCollision) {
      result.skipped++;
      continue;
    }

    let newId = collisionId(original, spec.keyField);
    let candidate = renamed(record, newId, spec);
    while (
      byKey.has(newId) &&
      !recordsEqual(byKey.get(newId) as Rec, candidate)
    ) {
      newId = `${newId}x`;
      candidate = renamed(record, newId, spec);
    }
    remap.set(key, newId);
    if (byKey.has(newId)) {
      result.skipped++;
      continue;
    }
    result.adds.push(candidate);
    byKey.set(newId, candidate);
    result.kept++;
  }
  return result;
}

/** Existing values win; only keys absent locally are added. */
export function mergeKeepingExisting<T extends Rec>(
  existing: T,
  incoming: T,
): T {
  return { ...incoming, ...existing };
}
