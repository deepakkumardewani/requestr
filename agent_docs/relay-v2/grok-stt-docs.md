# xAI Grok Speech-to-Text — reference (pasted by user 2026-10-26)

## REST (batch) — POST https://api.x.ai/v1/stt
- Auth: `Authorization: Bearer $XAI_API_KEY` (server-side only; never expose to client)
- multipart/form-data; option fields MUST precede `file` (file must be last field)
- Fields: `file` (≤500 MB) or `url`; `model` (default `grok-voice-transcribe-2.0`); `language` (optional, e.g. en, fr, de, ja; auto-detected otherwise); `format` (bool, ITN — requires `language`); `keyterm` (repeatable, ≤100 terms × 50 chars); `filler_words` (bool, default false); `diarize`; `multichannel`; `channels`; `audio_format` (pcm|mulaw|alaw raw only) + `sample_rate` (8000/16000/22050/24000/44100/48000); `vad_threshold` (0–1, default 0.5)
- Container formats auto-detected: wav, mp3, ogg, opus, flac, aac, mp4, m4a, mkv. (NOTE: webm is NOT listed — Chrome MediaRecorder default is webm/opus; verify or record WAV/PCM.)
- Response: `{ text, language, duration, words: [{text,start,end,speaker?}], channels? }`
- Errors: 400 bad request, 401 bad key, 413 too large, 429 rate limited (backoff), 502 url download failed, 503 unavailable (retry)

## Streaming — wss://api.x.ai/v1/stt
- Query params: sample_rate (16000 default), encoding (pcm|mulaw|alaw|opus), interim_results, endpointing (ms), language, format, model, diarize, filler_words, multichannel, channels, keyterm, smart_turn, smart_turn_timeout, vad_threshold
- Server events: transcript.created (ready) → transcript.partial {text, words, is_final, speech_final, start, duration} → transcript.done; error
- Client: binary audio frames (~100 ms chunks; 3200 bytes @16kHz PCM16); `{"type":"finalize"}` (PTT); `{"type":"audio.done"}` ends
- Docs warn: never expose key client-side; proxy WS through backend.

## Supported languages (38+), incl. en, fr, ja, de, es, pt, ar, zh, hi, ... ; `format=true` works for ar, zh, en, fr, de, ja, pt, ru, es, sv, vi.
