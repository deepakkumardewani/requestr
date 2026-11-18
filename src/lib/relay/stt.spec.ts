import { describe, expect, it } from "vitest";
import {
  buildUpstreamForm,
  mapUpstreamFailure,
  supportsFormatting,
  toTranscript,
} from "./stt";

describe("supportsFormatting", () => {
  it("accepts supported languages only", () => {
    expect(supportsFormatting("en")).toBe(true);
    expect(supportsFormatting("vi")).toBe(true);
    expect(supportsFormatting("hi")).toBe(false);
    expect(supportsFormatting("")).toBe(false);
    expect(supportsFormatting(undefined)).toBe(false);
  });
});

describe("buildUpstreamForm", () => {
  const audio = new Blob(["x"], { type: "audio/wav" });

  it("puts options first and the file last", () => {
    const keys = [...buildUpstreamForm(audio, "en").keys()];
    expect(keys).toEqual(["model", "language", "format", "file"]);
  });

  it("omits format for unsupported languages", () => {
    const form = buildUpstreamForm(audio, "hi");
    expect([...form.keys()]).toEqual(["model", "language", "file"]);
    expect(form.get("format")).toBeNull();
  });

  it("omits language and format when none is given", () => {
    const form = buildUpstreamForm(audio);
    expect([...form.keys()]).toEqual(["model", "file"]);
    expect((form.get("file") as File).name).toBe("audio.wav");
  });
});

describe("mapUpstreamFailure", () => {
  it.each([200, 204, 299])("returns null for %i", (status) => {
    expect(mapUpstreamFailure(status, null)).toBeNull();
  });

  it.each([
    [400, { code: "bad_audio", status: 400 }],
    [401, { code: "upstream_auth", status: 502 }],
    [413, { code: "too_large", status: 413 }],
    [429, { code: "rate_limited", status: 429, retryAfter: "7" }],
    [502, { code: "unavailable", status: 503 }],
    [503, { code: "unavailable", status: 503 }],
    [500, { code: "unavailable", status: 503 }],
    [300, { code: "unavailable", status: 503 }],
  ])("maps upstream %i", (status, expected) => {
    expect(mapUpstreamFailure(status, "7")).toEqual(expected);
  });
});

describe("toTranscript", () => {
  it("keeps only text, language and duration", () => {
    expect(
      toTranscript(
        { text: "hi", language: "fr", duration: 2, words: [1] },
        "en"
      )
    ).toEqual({ text: "hi", language: "fr", duration: 2 });
  });

  it("falls back to the requested language and zero duration", () => {
    expect(toTranscript({ text: "hi" }, "en")).toEqual({
      text: "hi",
      language: "en",
      duration: 0,
    });
    expect(toTranscript({ text: "" }, undefined)).toEqual({
      text: "",
      language: "",
      duration: 0,
    });
  });

  it.each([null, undefined, "str", 4, {}, { text: 3 }])(
    "returns null for %j",
    (payload) => {
      expect(toTranscript(payload, "en")).toBeNull();
    }
  );
});
