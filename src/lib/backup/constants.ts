/** Identifier every backup file carries; a file without it is not ours. */
export const BACKUP_APP_ID = "requestr-backup";

/** Bump on a breaking change to the envelope or the `data` layout. */
export const BACKUP_SCHEMA_VERSION = 1;

const BYTES_PER_MB = 1024 * 1024;
const SIZE_WARN_MB = 100;
/** Above this estimated size the export dialog warns before download. */
export const BACKUP_SIZE_WARN_BYTES = SIZE_WARN_MB * BYTES_PER_MB;

export const BACKUP_SECTIONS = [
  "collections",
  "environments",
  "chains",
  "history",
  "settings",
  "preferences",
  "relayThreads",
] as const;

export type BackupSection = (typeof BACKUP_SECTIONS)[number];

/** Sections the user can tick; `preferences` rides along with `settings`. */
export const BACKUP_SELECTABLE_SECTIONS = BACKUP_SECTIONS.filter(
  (section) => section !== "preferences",
);

/** Replaces a blanked secret. */
export const REDACTED_VALUE = "";
