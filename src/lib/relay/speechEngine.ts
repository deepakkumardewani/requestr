export type DictationEngine = "ai" | "browser";

type ResolveDictationEngineInput = {
  /** Server transcription status; null while it is loading. */
  sttConfigured: boolean | null;
  captureSupported: boolean;
  browserSupported: boolean;
};

/** Picks the dictation engine automatically; null when neither can work. */
export function resolveDictationEngine({
  sttConfigured,
  captureSupported,
  browserSupported,
}: ResolveDictationEngineInput): DictationEngine | null {
  if (sttConfigured === true && captureSupported) return "ai";
  return browserSupported ? "browser" : null;
}
