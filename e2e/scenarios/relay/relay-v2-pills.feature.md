# Feature: Relay v2 neutral pills (entity pills and inline code carry no accent colour)

Tests in `e2e/qa/relay/relay-v2-pills.spec.ts`. Covers CONV-07 (neutral pills, only HTTP method badges keep colour) and CONV-10 (inline code). Colours are compared as computed `rgb()` values against a `var(--primary)` probe resolved in the same theme, never against the raw variable. The model is always mocked through `installRelayRoutes`; the theme is set through next-themes' `theme` storage key before load.

---

@critical
## Scenario: [REL-V2-PILLS-01] light theme: the computed color of every [data-relay-pill] and inline code differs from a var(--primary) probe
# evidence: EntityPill.tsx ENTITY_ACCENT_CLASS, RelayMarkdown.tsx INLINE_CODE_CLASS

@critical
## Scenario: [REL-V2-PILLS-02] dark theme: the same comparison holds
# evidence: EntityPill.tsx ENTITY_ACCENT_CLASS, RelayMarkdown.tsx INLINE_CODE_CLASS

@high
## Scenario: [REL-V2-PILLS-03] contrast of pill text against its background is at least 4.5:1 in both themes
# evidence: EntityPill.tsx PILL_CLASS (bg-muted, text-foreground)

@medium
## Scenario: [REL-V2-PILLS-04] the user bubble attachment pills are neutral and method badges keep their colour
# evidence: AttachmentPillRow.tsx, EntityPill.tsx MethodBadge, constants.ts METHOD_BADGE_CLASSES
