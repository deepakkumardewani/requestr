# Feature: Relay v2 composer editing with inline pills

Tests in `e2e/qa/relay/relay-v2-composer.spec.ts`. Covers COMP-01 (inline pills at the caret), COMP-02 (a pill deletes as one unit together with its attachment), COMP-03 (slash command pills mid-sentence), COMP-04 (target pill after a command pill) and COMP-07 (send rules). IME composition is covered by the unit tests because Playwright cannot drive a real IME. The model is mocked through `installRelayRoutes` and dictation through the speech stub.

---

@critical
## Scenario: [REL-V2-COMPOSER-01] @ opens the picker and choosing a request inserts an inline pill at the caret
# evidence: PromptEditor.tsx, AttachmentPillNode.tsx, MentionMenu.tsx

@critical
## Scenario: [REL-V2-COMPOSER-02] Backspace right after a pill deletes the whole pill and the attachment
# evidence: AttachmentPillNode.tsx removePillBeforeCaret

@critical
## Scenario: [REL-V2-COMPOSER-03] a slash command inserts a command pill mid-sentence
# evidence: CommandPillNode.tsx, SlashMenu.tsx

@high
## Scenario: [REL-V2-COMPOSER-04] a target-needing command opens the picker and the chosen target pill follows the command pill
# evidence: RelayComposer.tsx targetPickOpen, useSlashCommandRunner.ts

@critical
## Scenario: [REL-V2-COMPOSER-05] Enter sends and Shift+Enter inserts a newline
# evidence: PromptEditor.tsx handleKeyDown

@high
## Scenario: [REL-V2-COMPOSER-06] whitespace-only content cannot be sent but a lone pill can
# evidence: editorSerializer.ts isSendable

@medium
## Scenario: [REL-V2-COMPOSER-07] a pasted rich-text snippet arrives as plain text
# evidence: PromptEditor.tsx pastePlainText

@high
## Scenario: [REL-V2-COMPOSER-08] dictated text (mocked) lands at the caret without disturbing the pills
# evidence: PromptEditor.tsx insertTextAtCaret, useSpeechDictation.ts

@medium
## Scenario: [REL-V2-COMPOSER-09] a pill whose request was deleted renders as deleted
# evidence: AttachmentPillNode.tsx usePillState
