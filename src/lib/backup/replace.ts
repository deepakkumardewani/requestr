import {
  getLooseDB,
  type LooseTransaction,
  runInTransaction,
  type StoreName,
} from "../idb";
import type { BackupSection } from "./constants";
import { SECTION_LISTS, SETTINGS_RECORD_KEY, SETTINGS_STORE } from "./exporter";
import { writePreferences } from "./preferences";
import type { BackupEnvelope } from "./schema";
import type { SectionCounts } from "./sizeEstimate";

type Rec = Record<string, unknown>;

/** Stores a section owns; `preferences` lives in localStorage and owns none. */
function storesOf(section: BackupSection): StoreName[] {
  if (section === "preferences") return [];
  if (section === "settings") return [SETTINGS_STORE];
  return (SECTION_LISTS[section] ?? []).map(({ store }) => store);
}

function storesToWrite(sections: readonly BackupSection[]): StoreName[] {
  return [...new Set(sections.flatMap(storesOf))];
}

/** Records Replace would delete per section, for the confirmation dialog. */
export async function countReplaceDeletes(
  sections: readonly BackupSection[],
): Promise<SectionCounts> {
  const db = await getLooseDB();
  const counts: SectionCounts = {};
  for (const section of sections) {
    if (section === "preferences") continue;
    if (section === "settings") {
      const record = await db.get(SETTINGS_STORE, SETTINGS_RECORD_KEY);
      counts.settings = record ? 1 : 0;
      continue;
    }
    const [primary] = storesOf(section);
    counts[section] = await db.count(primary);
  }
  return counts;
}

/** Every request the replacement needs, queued in order: clears first, then writes. */
function queueReplacement(
  tx: LooseTransaction,
  envelope: BackupEnvelope,
): Promise<unknown>[] {
  const data = envelope.data as Record<string, unknown>;
  const ops: Promise<unknown>[] = [];
  try {
    queueRequests(tx, envelope, data, ops);
  } catch (error) {
    // A synchronous throw abandons the already-queued requests; mark them
    // handled so the abort rolling them back is not reported as unhandled.
    for (const op of ops) op.catch(() => undefined);
    throw error;
  }
  return ops;
}

function queueRequests(
  tx: LooseTransaction,
  envelope: BackupEnvelope,
  data: Record<string, unknown>,
  ops: Promise<unknown>[],
): void {
  for (const store of storesToWrite(envelope.sections)) {
    ops.push(
      store === SETTINGS_STORE
        ? tx.objectStore(store).delete(SETTINGS_RECORD_KEY)
        : tx.objectStore(store).clear(),
    );
  }
  for (const section of envelope.sections) {
    for (const { dataKey, store } of SECTION_LISTS[section] ?? []) {
      for (const record of (data[dataKey] ?? []) as Rec[]) {
        ops.push(tx.objectStore(store).put(record));
      }
    }
  }
  const settings = data.settings as Rec | undefined;
  if (settings && Object.keys(settings).length > 0) {
    ops.push(tx.objectStore(SETTINGS_STORE).put(settings, SETTINGS_RECORD_KEY));
  }
}

/**
 * Clears the stores of the sections in the file, then writes the incoming
 * records, all in one transaction. localStorage preferences are written only
 * after the commit, so a failed restore leaves them untouched too.
 */
export async function replaceBackup(envelope: BackupEnvelope): Promise<void> {
  const stores = storesToWrite(envelope.sections);
  // IndexedDB rejects a transaction with an empty scope (preferences-only file).
  if (stores.length > 0) {
    await runInTransaction(stores, async (tx) => {
      await Promise.all(queueReplacement(tx, envelope));
    });
  }
  if (envelope.data.preferences) writePreferences(envelope.data.preferences);
}
