import { z } from "zod";
import { BACKUP_APP_ID, BACKUP_SECTIONS } from "./constants";

const recordList = z.array(z.unknown());

/** Keys appear only for sections the file includes, so every key is optional. */
const backupDataSchema = z.object({
  collections: recordList.optional(),
  folders: recordList.optional(),
  requests: recordList.optional(),
  chainConfigs: recordList.optional(),
  environments: recordList.optional(),
  chains: recordList.optional(),
  history: recordList.optional(),
  chainRuns: recordList.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  preferences: z.record(z.string(), z.string()).optional(),
  relayThreads: recordList.optional(),
  relayChanges: recordList.optional(),
});

/**
 * The file envelope. `schemaVersion` is any integer here: version handling
 * (too new, migrations) belongs to validation, which needs to report it.
 */
export const backupEnvelopeSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  schemaVersion: z.number().int().positive(),
  idbVersion: z.number().int().positive(),
  exportedAt: z.iso.datetime(),
  appVersion: z.string(),
  includesSecrets: z.boolean(),
  sections: z.array(z.enum(BACKUP_SECTIONS)),
  data: backupDataSchema,
});

export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;
export type BackupData = BackupEnvelope["data"];
