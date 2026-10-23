# Phase 6 builder report (attempt a2)

Verifier a1 fixes for P6.9, P6.13–P6.16.

## P6.9
- Fixed `MentionMenu.spec.tsx` hover/mousedown tests (inactive request row, preventDefault).
- `bunx vitest run … MentionMenu.spec.tsx … --coverage`: 126 passed; MentionMenu funcs 100%.

## P6.13
- `relay-improvements-picker.spec.ts`: REL-PICK-01 uses `@Improvements` (no spaces in query) + filter env row; asserts `environment` in payload.

## P6.14
- `relay-polish-composer.spec.ts`: stronger 01/02/03/04/08/09; dock resize via handle; locale via IDB; COMPOSER-08 mouse away before stop focus; `--repeat-each=3`: 36/36.

## P6.15
- `relay-polish-mention.feature.md`: `## Scenario: [REL-POL-MENTION-nn]` headings.
- `relay-polish-mention.spec.ts`: full scenario assertions; `--repeat-each=3`: 42/42.

## P6.16 gate
- vitest relay scope: pass
- composer+mention `--repeat-each=3 --retries=0`: **78 passed**
- composer+mention `--repeat-each=2`: pass
- legacy 9 relay e2e: 49 passed
- `check-ids.sh`: OK
- lint, typecheck, brandGuard, legacy grep: pass

## Decisions
- Mention `@` queries avoid spaces (findActiveMention stops at whitespace).
- Dock widths 320/400/480 use viewports 900/1200/1440 where min/max allow those dock sizes.
