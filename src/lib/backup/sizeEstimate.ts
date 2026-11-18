import type { BackupSection } from "./constants";
import type { BackupData } from "./schema";

export type SectionCounts = Partial<Record<BackupSection, number>>;

export type BackupEstimate = {
  bytes: number;
  counts: SectionCounts;
};

/** The data key whose length is the section's record count. */
const PRIMARY_KEY: Record<BackupSection, keyof BackupData> = {
  collections: "collections",
  environments: "environments",
  chains: "chains",
  history: "history",
  settings: "settings",
  preferences: "preferences",
  relayThreads: "relayThreads",
};

function countOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

/** Records per included section; a section the data has no key for is omitted. */
export function countSections(data: BackupData): SectionCounts {
  const counts: SectionCounts = {};
  for (const [section, key] of Object.entries(PRIMARY_KEY)) {
    if (key in data) counts[section as BackupSection] = countOf(data[key]);
  }
  return counts;
}

/** Bytes the serialised `data` will occupy, measured per key so no giant string is held. */
export function estimateBytes(data: BackupData): number {
  let bytes = 0;
  for (const value of Object.values(data)) {
    bytes += new Blob([JSON.stringify(value)]).size;
  }
  return bytes;
}

export function estimateBackup(data: BackupData): BackupEstimate {
  return { bytes: estimateBytes(data), counts: countSections(data) };
}
