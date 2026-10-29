/** Old id to new id for every record Merge had to rename. */
export type IdRemap = Map<string, string>;

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Rewrites every string value and object key equal to a remapped id. Ids are
 * random UUIDs, so an exact match is a reference (folder to collection,
 * request to collection or folder, chain node, chain edge, chainConfigs
 * `collectionId`, chainRuns to chain, `pinnedRequestIds`) and never prose.
 */
export function rewriteReferences<T>(value: T, remap: IdRemap): T {
  if (remap.size === 0) return value;
  return rewrite(value, remap) as T;
}

function rewrite(value: unknown, remap: IdRemap): unknown {
  if (typeof value === "string") return remap.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => rewrite(item, remap));
  if (!isRec(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      remap.get(key) ?? key,
      rewrite(item, remap),
    ]),
  );
}

/** JSON preference values (a list of folder ids) are parsed so the ids inside are remapped. */
function parseStructured(value: string): unknown {
  if (!value.startsWith("[") && !value.startsWith("{")) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    // Not JSON after all: the caller keeps the original text untouched.
    return undefined;
  }
}

function rewritePreference(value: string, remap: IdRemap): string {
  const direct = remap.get(value);
  if (direct) return direct;
  const parsed = parseStructured(value);
  return parsed === undefined ? value : JSON.stringify(rewrite(parsed, remap));
}

/** Remaps ids inside preference values such as the active environment and collapsed folders. */
export function remapPreferences(
  preferences: Record<string, string>,
  remap: IdRemap,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(preferences).map(([key, value]) => [
      key,
      rewritePreference(value, remap),
    ]),
  );
}

/**
 * Orders records so each one follows the in-list records it references, which
 * lets a parent's new id be known before its children are rewritten. A
 * reference cycle is broken at the point it is first met.
 */
export function dependencyOrder(
  records: Rec[],
  idField: string,
  referencesOf: (record: Rec) => string[],
): Rec[] {
  const byId = new Map(
    records.map((record) => [String(record[idField]), record]),
  );
  const visited = new Set<Rec>();
  const ordered: Rec[] = [];

  const visit = (record: Rec) => {
    if (visited.has(record)) return;
    visited.add(record);
    for (const ref of referencesOf(record)) {
      const target = byId.get(ref);
      if (target) visit(target);
    }
    ordered.push(record);
  };
  records.forEach(visit);
  return ordered;
}
