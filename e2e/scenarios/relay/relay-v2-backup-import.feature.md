# Feature: Backup import (file validation, preview, Merge and Replace, reconciliation, Import page entry)

Tests in `e2e/qa/relay/relay-v2-backup-import.spec.ts`. Covers BAK-04 (validation errors write nothing, preview with counts, Merge default, Merge idempotent, Replace confirmation), BAK-05 (Replace reconciliation reports dangling links and the chain page shows the placeholder), BAK-07 (Import page card) and BAK-09 (error copy). Files are built in the spec and fed through `setInputFiles` on the dialog's hidden file input. The 100 MB warning is covered by unit tests.

---

@critical
## Scenario: [REL-V2-BAKIMP-01] a non-JSON file shows "This file is not valid JSON." and writes nothing
# evidence: validate.ts parseJson, ImportBackupDialog ErrorNotice

@critical
## Scenario: [REL-V2-BAKIMP-02] a Postman collection file shows the not-a-Requestr-backup message with a link to /import
# evidence: validate.ts foreignFile, ErrorNotice backup-import-link

@high
## Scenario: [REL-V2-BAKIMP-03] a newer schemaVersion shows the update-the-app message
# evidence: validate.ts checkVersion newerVersion

@high
## Scenario: [REL-V2-BAKIMP-04] a damaged section shows "The backup is damaged" and writes nothing
# evidence: validate.ts findDamagedSection

@critical
## Scenario: [REL-V2-BAKIMP-05] a valid file shows the preview with counts, exportedAt and includesSecrets, and Merge is the default
# evidence: BackupPreview.tsx, ModeChoice default merge

@critical
## Scenario: [REL-V2-BAKIMP-06] Merge of the same file twice changes nothing the second time and colliding records are kept as " (imported)"
# evidence: mergeRules.ts collisionId deterministic, IMPORTED_SUFFIX

@critical
## Scenario: [REL-V2-BAKIMP-07] Replace requires the confirmation that lists counts and Cancel changes nothing
# evidence: ReplaceConfirmDialog.tsx, useBackupImport.cancelReplace

@critical
## Scenario: [REL-V2-BAKIMP-08] Replace with a backup missing a request that a chain node references: the chain page renders the placeholder and the restore summary reports the dangling count
# evidence: reconcile.ts countDanglingReferences, ChainNode.tsx MissingRequestNode

@medium
## Scenario: [REL-V2-BAKIMP-09] the Import page shows the "Restore a Requestr backup" card which opens the restore flow
# evidence: RestoreBackupCard.tsx
