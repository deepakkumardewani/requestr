# Feature: Relay v2 backup two-context round trip

Tests in `e2e/qa/relay/relay-v2-backup.spec.ts`. Exports a backup from a seeded profile (context A) and imports it with Replace into a fresh, empty profile (context B), then compares what B holds against A. Empty-store and error cases are covered by the import spec; this file covers the persistence round trip and cross-tab behaviour.

# evidence: src/lib/backup/{exporter,replace,secrets,reconcile,broadcast}.ts, src/components/settings/backup/*

---

@critical
## Scenario: [REL-V2-BACKUP-01] export all sections with secrets on in context A, import with Replace in a fresh context B, and every IDB store dump (ids, fields, ordering) plus the data.preferences keys equals the source
Given context A holds the seeded workspace plus a bearer-authed request, a secret environment variable, global settings and preferences
When A exports Everything with Include secrets on and B imports the file with Replace
Then every backed-up IDB store in B equals A record for record, in the same order, and B's localStorage holds A's data.preferences keys

@critical
## Scenario: [REL-V2-BACKUP-02] the same round trip with secrets off differs only in the blanked BAK-08 fields
Given the same source workspace
When A exports with Include secrets off and B imports with Replace
Then the only fields that differ between A and B are the BAK-08 secret fields, each blanked, and no record or field is missing

@high
## Scenario: [REL-V2-BACKUP-03] after Replace the page reloads and a second open tab of the same profile receives the reload message
Given B has a second tab open in the same profile and A has a tab in another profile
When B imports with Replace
Then B's second tab and B's own page reload, and A's tab is untouched

@high
## Scenario: [REL-V2-BACKUP-04] tabs for requests missing after the restore are closed
Given B has one tab for a request that is not in the backup and one for a request that is
When B imports with Replace
Then after the reload only the tab whose request exists remains, in the tab bar and in the persisted tabs store
