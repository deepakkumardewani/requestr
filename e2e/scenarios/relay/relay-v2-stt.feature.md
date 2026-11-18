# Feature: Relay Grok dictation

Tests in `e2e/qa/relay/relay-v2-stt.spec.ts`. Hermetic: `/api/relay/stt` and `/api/relay/stt/status` are mocked with `page.route`, and Chromium's fake audio device supplies the microphone (flags set for this spec only). Traces STT-02, STT-05, STT-06, STT-07, STT-08.

---

@critical
## Scenario: [REL-V2-STT-01] with the status route mocked as configured and the Grok engine chosen, recording then stopping lands the mocked text at the composer caret and does not send

@high
## Scenario: [REL-V2-STT-02] the engine label is visible on the mic button

@critical
## Scenario: [REL-V2-STT-03] with status mocked as unconfigured the Grok option is disabled with the hint and a stored grok falls back to browser

@high
## Scenario: [REL-V2-STT-04] a mocked 401 shows the not-set-up message and a mocked 429 shows the busy message, and Retry resends the kept recording

@high
## Scenario: [REL-V2-STT-05] denied microphone permission shows the inline error and sends no request

@medium
## Scenario: [REL-V2-STT-06] a recording under half a second shows "Didn't catch that" and sends no request

@high
## Scenario: [REL-V2-STT-07] the mic is disabled while transcribing and closing the dock mid-transcription inserts nothing

@high
## Scenario: [REL-V2-STT-08] the uploaded request is audio/wav and carries the mapped language
