# Feature: Relay v2 workspace backup export (Settings, Data)

Tests in `e2e/qa/relay/relay-v2-backup-export.spec.ts`. Covers BAK-01, BAK-02, BAK-03 and BAK-07 (export side) in a real browser. Sentinel secrets come from `e2e/fixtures/seed/relay-v2-backup-export.json`; the downloaded file is read with `downloadCapture`. Error and deep-link cases do not apply to export.

---

@critical
## Scenario: [REL-V2-BAKEXP-01] Settings, Data shows Export backup and Import backup
# evidence: src/components/settings/DataSection.tsx

@critical
## Scenario: [REL-V2-BAKEXP-02] exporting everything with secrets off downloads a file with app requestr-backup, includesSecrets false and every seeded secret sentinel blank
# evidence: src/lib/backup/secrets.ts applySecretPolicy, useBackupExport.ts

@critical
## Scenario: [REL-V2-BAKEXP-03] turning Include secret values on shows the warning and the downloaded file contains the sentinels with includesSecrets true
# evidence: ExportBackupDialog.tsx SecretsToggle

@high
## Scenario: [REL-V2-BAKEXP-04] Choose mode with one collection selected exports only that collection with its folders and requests, and shows per-section counts before download
# evidence: BackupSectionPicker.tsx, lib/backup/selection.ts

@medium
## Scenario: [REL-V2-BAKEXP-05] Relay threads are unticked by default and show the conversations note
# evidence: useBackupExport.ts DEFAULT_SECTIONS, BackupSectionPicker.tsx

@high
## Scenario: [REL-V2-BAKEXP-06] the exported file does not include excluded preferences such as rq_anon_id
# evidence: src/lib/backup/preferences.ts BACKUP_PREFERENCE_KEYS
