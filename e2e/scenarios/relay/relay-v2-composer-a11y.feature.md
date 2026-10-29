# Feature: Relay v2 composer accessibility and request budget

Tests in `e2e/qa/relay/relay-v2-composer-a11y.spec.ts`. Covers COMP-01 (editor semantics) and COMP-06 (the 256 KB request body budget). The model is always mocked through `installRelayRoutes`.

---

@critical
## Scenario: [REL-V2-COMPA11Y-01] the editor exposes role textbox with an accessible label and pills have accessible names
# evidence: PromptEditor.tsx editorProps attributes (role textbox, aria-label), AttachmentPillNode.tsx (role img, aria-label)

@high
## Scenario: [REL-V2-COMPA11Y-02] keyboard only: type, open the picker, pick with arrows and Enter, and send
# evidence: PromptEditor.tsx onKeyDown, MentionMenu.tsx listbox/options, relay-improvements-a11y-keyboard.spec.ts

@high
## Scenario: [REL-V2-COMPA11Y-03] axe reports no serious or critical violations on the composer
# evidence: relay-improvements-a11y-axe.spec.ts scanElements

@high
## Scenario: [REL-V2-COMPA11Y-04] with 10 large attachments and a long history the captured request body stays under 256 KB and the turn is sent
# evidence: tokenBudget.ts RELAY_MAX_BODY_BYTES, attachments.ts RELAY_ATTACHMENT_DETAIL_MAX_CHARS, route.ts readBody
