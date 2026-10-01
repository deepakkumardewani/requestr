import { describe, expect, it } from "vitest";
import en from "../../../messages/en";
import fr from "../../../messages/fr";
import ja from "../../../messages/ja";
import {
  CHAIN_ERROR_CODE,
  chainError,
  formatFallbackMessage,
  isChainErrorCode,
} from "./errorCodes";

describe("chainError", () => {
  it("returns the code with its English fallback and params", () => {
    expect(
      chainError(CHAIN_ERROR_CODE.DISPLAY_EXTRACT_FAILED, { path: "$.a" }),
    ).toEqual({
      error: 'Could not extract "$.a" from source response',
      errorCode: "displayExtractFailed",
      errorParams: { path: "$.a" },
    });
  });

  it("omits errorParams when none are given", () => {
    expect(chainError(CHAIN_ERROR_CODE.RUN_STOPPED)).toEqual({
      error: "Run stopped",
      errorCode: "runStopped",
    });
  });

  it("leaves unknown placeholders intact", () => {
    expect(formatFallbackMessage(CHAIN_ERROR_CODE.HTTP_STATUS)).toBe(
      "HTTP {status} {statusText}",
    );
  });

  it("recognises only known codes", () => {
    expect(isChainErrorCode("runStopped")).toBe(true);
    expect(isChainErrorCode("nope")).toBe(false);
  });
});

describe("error code translations", () => {
  it.each([
    ["en", en],
    ["fr", fr],
    ["ja", ja],
  ])("%s defines a message for every code", (_locale, messages) => {
    const runError = messages.errors.chain.runError as Record<string, string>;
    expect(Object.keys(runError).sort()).toEqual(
      Object.values(CHAIN_ERROR_CODE).sort(),
    );
  });
});
