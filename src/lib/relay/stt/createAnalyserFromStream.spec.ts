import { describe, expect, it, vi } from "vitest";
import { createAnalyserFromStream } from "./createAnalyserFromStream";

function fakeContext() {
  const source = { connect: vi.fn() };
  const analyser = { id: "analyser" };
  const context = {
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
  };
  return { context, source, analyser };
}

describe("createAnalyserFromStream", () => {
  it("[success] wires the stream source into a fresh analyser and returns both", () => {
    const { context, source, analyser } = fakeContext();
    const stream = { id: "stream" } as unknown as MediaStream;

    const result = createAnalyserFromStream(context as unknown as AudioContext, stream);

    expect(context.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(source.connect).toHaveBeenCalledWith(analyser);
    expect(result).toEqual({ source, analyser });
  });

  it("[invalid] propagates a failure from the audio context", () => {
    const { context } = fakeContext();
    context.createMediaStreamSource.mockImplementation(() => {
      throw new Error("closed context");
    });

    expect(() =>
      createAnalyserFromStream(context as unknown as AudioContext, {} as MediaStream),
    ).toThrow("closed context");
  });
});
