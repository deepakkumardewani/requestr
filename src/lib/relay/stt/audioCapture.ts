import {
  STT_MAX_RECORDING_MS,
  STT_SAMPLE_RATE,
  STT_WORKLET_NAME,
  STT_WORKLET_URL,
} from "@/lib/relay/constants";
import { encodeWav, resample } from "./wavEncoder";

const WAV_MIME = "audio/wav";
const SCRIPT_PROCESSOR_BUFFER = 4096;
const MS_PER_SECOND = 1000;

export type CaptureResult = { blob: Blob; durationMs: number };

export type CaptureSession = {
  /** Feeds the level meter; connected to the microphone source. */
  analyser: AnalyserNode;
  /** Ends recording and resolves with the WAV. */
  stop: () => Promise<CaptureResult>;
  /** Ends recording and discards everything. */
  abort: () => void;
};

export type CaptureOptions = {
  /** Fired when the recording cap is hit; the audio is still delivered via `stop`. */
  onLimit: () => void;
};

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const scoped = window as unknown as { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? scoped.webkitAudioContext;
}

/** Whether this browser can capture microphone audio for WAV encoding. */
export function isCaptureSupported(): boolean {
  const Ctor = audioContextCtor();
  if (!Ctor || !navigator.mediaDevices?.getUserMedia) return false;
  const hasWorklet = typeof AudioWorkletNode !== "undefined";
  return (
    hasWorklet || typeof Ctor.prototype.createScriptProcessor === "function"
  );
}

type ChunkSink = (chunk: Float32Array) => void;

/** Routes mic frames to `sink` via a worklet, or a ScriptProcessor when none exists. */
async function attachProcessor(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  sink: ChunkSink,
): Promise<() => void> {
  if (typeof AudioWorkletNode !== "undefined" && context.audioWorklet) {
    await context.audioWorklet.addModule(STT_WORKLET_URL);
    const node = new AudioWorkletNode(context, STT_WORKLET_NAME);
    node.port.onmessage = (event: MessageEvent<Float32Array>) =>
      sink(event.data);
    source.connect(node);
    return () => node.disconnect();
  }
  const node = context.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER, 1, 1);
  node.onaudioprocess = (event) =>
    sink(new Float32Array(event.inputBuffer.getChannelData(0)));
  source.connect(node);
  // A ScriptProcessor only runs while connected to a destination.
  node.connect(context.destination);
  return () => node.disconnect();
}

function concatChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Requests the microphone first, so a denied permission rejects before any
 * audio graph exists. Rejections are the browser's own DOMException.
 */
export async function startCapture({
  onLimit,
}: CaptureOptions): Promise<CaptureSession> {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new Error("Web Audio is not available");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new Ctor();
  const chunks: Float32Array[] = [];
  let ended = false;

  const release = (detach: () => void) => {
    if (ended) return;
    ended = true;
    clearTimeout(limitTimer);
    detach();
    for (const track of stream.getTracks()) track.stop();
    void context.close();
  };

  let detach = () => {};
  let limitTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    source.connect(analyser);
    detach = await attachProcessor(context, source, (chunk) => {
      if (!ended) chunks.push(chunk);
    });
    limitTimer = setTimeout(onLimit, STT_MAX_RECORDING_MS);

    return {
      analyser,
      abort: () => release(detach),
      stop: async () => {
        const rate = context.sampleRate;
        release(detach);
        const samples = resample(concatChunks(chunks), rate);
        const wav = encodeWav(samples, STT_SAMPLE_RATE);
        return {
          blob: new Blob([wav], { type: WAV_MIME }),
          durationMs: (samples.length / STT_SAMPLE_RATE) * MS_PER_SECOND,
        };
      },
    };
  } catch (error) {
    release(detach);
    throw error;
  }
}
