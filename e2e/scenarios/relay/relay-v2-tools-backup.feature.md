# Feature: Relay v2 backup tools (export_backup, import_backup)

Tests in `e2e/qa/relay/relay-v2-tools-backup.spec.ts`. Covers TOOL-03 in a real browser: a mocked agent calls the real backup tools, the approval cards are driven, and the tool results sent back to the model are inspected. Empty and persistence cases are covered by the backup specs; the file picker error path by the import dialog spec.

---

@critical
## Scenario: [REL-V2-TOOLBAK-01] export_backup shows an approval card with sections and counts and nothing downloads until approved
# evidence: src/components/relay/ExportBackupConfirm.tsx, src/lib/relay/tools/backupTools.ts

@critical
## Scenario: [REL-V2-TOOLBAK-02] with includeSecrets true the card shows the secrets warning
# evidence: src/components/relay/ExportBackupConfirm.tsx secretsWarning

@high
## Scenario: [REL-V2-TOOLBAK-03] after approval the downloaded file matches the card's sections
# evidence: src/lib/relay/tools/backupTools.ts exportBackup.run

@critical
## Scenario: [REL-V2-TOOLBAK-04] import_backup shows Choose file, then the preview after the file is picked, offers Merge only, and the tool result sent back has counts and no file content
# evidence: src/components/relay/ImportBackupConfirm.tsx, backupTools.ts importBackup.run

@high
## Scenario: [REL-V2-TOOLBAK-05] declining or cancelling returns "cancelled" and writes nothing
# evidence: src/lib/relay/tools/schemas.ts declinedError, ImportBackupConfirm.tsx decline
