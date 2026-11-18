import { describe, expect, it } from "vitest";
import { resolveDictationEngine } from "./speechEngine";

describe("resolveDictationEngine", () => {
  it.each([
    [true, true, true, "ai"],
    [true, true, false, "ai"],
    [true, false, true, "browser"],
    [false, true, true, "browser"],
    [null, true, true, "browser"],
    [false, true, false, null],
    [true, false, false, null],
  ] as const)(
    "configured=%s capture=%s browser=%s gives %s",
    (sttConfigured, captureSupported, browserSupported, expected) => {
      expect(
        resolveDictationEngine({ sttConfigured, captureSupported, browserSupported }),
      ).toBe(expected);
    },
  );
});
