# Feature: Relay voice dictation

As a user who prefers talking to typing
I want a mic button in the Relay composer that fills the textfield with what I say
So that I can dictate a prompt, review it, and send it myself

Tests live in `e2e/qa/relay/relay-improvements-voice.spec.ts`. The browser recognizer is replaced by a controllable fake from `e2e/fixtures/speechStub.ts`, so no real microphone is used. Real-browser speech stays a manual check.

---

## Scenario: [REL-VOICE-01] With the stub the mic shows, interim text streams into the textfield and nothing is sent (AC-15)

Given the browser supports speech recognition
When I start dictation and the recognizer reports interim then final text
Then the mic shows as listening and the words appear in the composer
And no message is sent

---

## Scenario: [REL-VOICE-02] Permission denied shows the inline error and the button returns to idle (AC-15)

Given dictation is listening
When the recognizer reports that microphone access was denied
Then an inline error is shown
And the mic button is idle again

---

## Scenario: [REL-VOICE-03] With both globals removed no mic is rendered (AC-15)

Given the browser has neither SpeechRecognition nor webkitSpeechRecognition
When I open Relay
Then the composer has no mic button

---

## Scenario: [REL-VOICE-04] The first-use note appears once and names no vendor (FR-173)

Given I have not used dictation in this session
When I start dictation for the first time
Then a privacy note appears that names no browser vendor
When I stop and start dictation again
Then the note does not appear again

---

## Scenario: [REL-VOICE-05] Esc stops dictation and keeps the dictated text unsent (FR-172)

Given dictation is listening and text has been dictated
When I press Escape
Then dictation stops and the mic is idle
And the dictated text stays in the composer, unsent
