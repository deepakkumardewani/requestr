// Frame timeline for the demo video, derived from the recorder's manifest.
// The clips and manifest are build output (gitignored), so they are loaded with
// `require`: webpack bundles them for Remotion while the type checker never needs them.

export const FPS = 30;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const TITLE_SECONDS = 5;
export const END_SECONDS = 6;
export const TITLE_FRAMES = TITLE_SECONDS * FPS;
export const END_FRAMES = END_SECONDS * FPS;
export const CARD_FADE_FRAMES = 15;
export const CAPTION_FADE_FRAMES = 12;
export const ZOOM_IN_FRAMES = 45;
export const PRODUCT_NAME = "Requestr";
export const PRODUCT_TAGLINE = "Send requests. Chain them. Let Relay build.";
export const END_URL = "https://relayrequest.dev/";
const MS_PER_SECOND = 1000;
const FAST_RATE = 3;

export type Focus = { x: number; y: number; zoom: number };
export type Ramp = { fromMs: number; toMs: number; rate: number };
type ManifestScene = {
  id: string;
  title: string;
  caption: string;
  focus: Focus;
  clip: string;
  /** Clip time where page load ends; earlier footage is skipped. */
  trimMs: number;
  durationMs: number;
  ramps: Ramp[];
};
export type Manifest = {
  viewport: { width: number; height: number };
  scenes: ManifestScene[];
};

/** One stretch of a clip played at a constant speed. */
export type Segment = {
  /** Frame (at FPS) of the source clip where this stretch starts. */
  sourceStartFrame: number;
  /** Frames this stretch occupies in the final video. */
  frames: number;
  rate: number;
};

export type DemoScene = {
  id: string;
  title: string;
  caption: string;
  focus: Focus;
  src: string;
  /** First frame of the scene in the final video. */
  from: number;
  frames: number;
  segments: Segment[];
};

const CLIP_SOURCES: Record<string, string> = {
  "send-request": require("./out/clips/send-request.webm"),
  "chain-run": require("./out/clips/chain-run.webm"),
  "relay-build": require("./out/clips/relay-build.webm"),
  "encrypted-share": require("./out/clips/encrypted-share.webm"),
};

export const loadManifest = (): Manifest => require("./out/manifest.json");

const msToFrames = (ms: number) => Math.round((ms / MS_PER_SECOND) * FPS);

/** Fills any gap between recorded ramps with fast playback, so the clip is covered end to end. */
function coverClip(scene: ManifestScene): Ramp[] {
  const covered: Ramp[] = [];
  let cursor = scene.trimMs;
  for (const ramp of scene.ramps) {
    if (ramp.fromMs > cursor) {
      covered.push({ fromMs: cursor, toMs: ramp.fromMs, rate: FAST_RATE });
    }
    covered.push(ramp);
    cursor = ramp.toMs;
  }
  if (scene.durationMs > cursor) {
    covered.push({ fromMs: cursor, toMs: scene.durationMs, rate: FAST_RATE });
  }
  return covered;
}

const toSegment = (ramp: Ramp): Segment => ({
  sourceStartFrame: msToFrames(ramp.fromMs),
  frames: Math.max(
    1,
    Math.round(msToFrames(ramp.toMs - ramp.fromMs) / ramp.rate),
  ),
  rate: ramp.rate,
});

export function buildScenes(manifest: Manifest): DemoScene[] {
  let from = TITLE_FRAMES;
  return manifest.scenes.map((scene) => {
    const segments = coverClip(scene).map(toSegment);
    const frames = segments.reduce((total, s) => total + s.frames, 0);
    const built = {
      id: scene.id,
      title: scene.title,
      caption: scene.caption,
      focus: scene.focus,
      src: CLIP_SOURCES[scene.id],
      from,
      frames,
      segments,
    };
    from += frames;
    return built;
  });
}

export function totalFrames(scenes: DemoScene[]): number {
  const last = scenes.at(-1);
  return (last ? last.from + last.frames : TITLE_FRAMES) + END_FRAMES;
}

/** Stills worth checking: the title card, each scene's first and last frame, and the end card. */
export function stillFrames(scenes: DemoScene[]): Record<string, number> {
  return {
    title: 0,
    ...Object.fromEntries(
      scenes.flatMap((s) => [
        [`${s.id}-start`, s.from],
        [`${s.id}-payoff`, s.from + s.frames - 1],
      ]),
    ),
    end: totalFrames(scenes) - END_FRAMES,
  };
}
