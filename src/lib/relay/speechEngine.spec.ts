import { describe, expect, it } from "vitest";
import {
  getEffectiveSpeechEngine,
  isSpeechEngine,
  SPEECH_ENGINE_OPTIONS,
} from "./speechEngine";

describe("SPEECH_ENGINE_OPTIONS", () => {
  it("lists browser first so it is the default", () => {
    expect(SPEECH_ENGINE_OPTIONS).toEqual(["browser", "grok"]);
  });
});

describe("isSpeechEngine", () => {
  it.each(["browser", "grok"])("accepts %s", (value) => {
    expect(isSpeechEngine(value)).toBe(true);
  });

  it.each([["whisper"], [""], [null], [undefined], [1], ["GROK"]])(
    "rejects %s",
    (value) => {
      expect(isSpeechEngine(value)).toBe(false);
    },
  );
});

describe("getEffectiveSpeechEngine", () => {
  it("uses grok when stored grok is configured", () => {
    expect(getEffectiveSpeechEngine("grok", true)).toBe("grok");
  });

  it("falls back to browser when grok is not configured", () => {
    expect(getEffectiveSpeechEngine("grok", false)).toBe("browser");
  });

  it("falls back to browser while the status is loading", () => {
    expect(getEffectiveSpeechEngine("grok", null)).toBe("browser");
  });

  it.each([true, false, null])(
    "keeps browser when stored browser and configured is %s",
    (configured) => {
      expect(getEffectiveSpeechEngine("browser", configured)).toBe("browser");
    },
  );
});
