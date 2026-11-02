export type StreamAnalyser = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
};

/** Connects a microphone stream to a fresh analyser; the caller owns the stream and context lifecycle. */
export function createAnalyserFromStream(
  context: AudioContext,
  stream: MediaStream,
): StreamAnalyser {
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  source.connect(analyser);
  return { source, analyser };
}
