# Phase 10 builder a1 (P10.1-P10.4)
- P10.1: added `voice` namespace to messages/{en,fr,ja}/relay.json. biome clean, relayMessages.parity 816 pass.
- P10.2: src/hooks/useSpeechDictation.ts (supported/state/interim/start/stop/error + onTranscript option; locale from useSettingsStore via SPEECH_LANG_BY_LOCALE; detection in useEffect).
- P10.3: MicButton.tsx in composer trailing slot; useRelayStore untouched (voice state stays in the hook, NFR-10). Esc stops (window capture keydown while listening); typing during listening stops dictation.
- P10.4: SpeechPrivacyNote.tsx, shown on first start per session (useState, no storage).
- Checks: bun run typecheck clean; BRAND_GREP exit 0; vitest src/components/relay src/i18n 1347 pass.
