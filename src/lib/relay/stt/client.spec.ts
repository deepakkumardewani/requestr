import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SttRequestError } from "./errors";
import { transcribeAudio } from "./client";

const audio = new Blob(["wav"], { type: "audio/wav" });
const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

async function kindOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => "resolved",
    (error: unknown) => (error instanceof SttRequestError ? error.kind : error)
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("transcribeAudio", () => {
  it("posts the audio and language and returns the text", async () => {
    fetchMock.mockResolvedValue(json({ text: "hello" }));
    const signal = new AbortController().signal;

    await expect(
      transcribeAudio(audio, { language: "en", signal })
    ).resolves.toBe("hello");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/relay/stt");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(signal);
    const body = init.body as FormData;
    expect(body.get("language")).toBe("en");
    expect((body.get("audio") as File).name).toBe("audio.wav");
  });

  it("omits language when not given", async () => {
    fetchMock.mockResolvedValue(json({ text: "" }));
    await expect(transcribeAudio(audio)).resolves.toBe("");
    expect((fetchMock.mock.calls[0][1].body as FormData).has("language")).toBe(
      false
    );
  });

  it.each([
    ["bad_audio", "badAudio"],
    ["upstream_auth", "upstreamAuth"],
    ["too_large", "tooLarge"],
    ["rate_limited", "busy"],
    ["not_configured", "unavailable"],
    ["mystery", "unavailable"],
  ])("maps route error %s to %s", async (code, kind) => {
    fetchMock.mockResolvedValue(json({ error: code }, 400));
    expect(await kindOf(transcribeAudio(audio))).toBe(kind);
  });

  it("maps a non-JSON error body to unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 502 }));
    expect(await kindOf(transcribeAudio(audio))).toBe("unavailable");
  });

  it("maps a success body without text to unavailable", async () => {
    fetchMock.mockResolvedValue(json({ text: 5 }));
    expect(await kindOf(transcribeAudio(audio))).toBe("unavailable");
    fetchMock.mockResolvedValue(new Response("nope", { status: 200 }));
    expect(await kindOf(transcribeAudio(audio))).toBe("unavailable");
  });

  it("maps a network failure to network", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await kindOf(transcribeAudio(audio))).toBe("network");
  });

  it("rethrows the abort error when the signal was aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("aborted", "AbortError");
    fetchMock.mockRejectedValue(abortError);

    await expect(
      transcribeAudio(audio, { signal: controller.signal })
    ).rejects.toBe(abortError);
  });
});
