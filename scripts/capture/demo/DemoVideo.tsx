import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
} from "remotion";
import {
  buildScenes,
  CAPTION_FADE_FRAMES,
  CARD_FADE_FRAMES,
  type DemoScene,
  END_FRAMES,
  END_URL,
  loadManifest,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  TITLE_FRAMES,
  ZOOM_IN_FRAMES,
} from "./scenes";

const BACKGROUND = "#0b0d12";
const FOREGROUND = "#f4f6fb";
const MUTED = "#9aa3b5";
const ACCENT = "#7c9cff";
const FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";
const NORMAL_RATE = 1;
const CAPTION_BOTTOM_PX = 56;
const CAPTION_RADIUS_PX = 16;
const CAPTION_BACKDROP = "rgba(11, 13, 18, 0.82)";
const SPEED_BADGE_OPACITY = 0.9;

const centered: CSSProperties = {
  backgroundColor: BACKGROUND,
  alignItems: "center",
  justifyContent: "center",
  fontFamily: FONT_FAMILY,
  color: FOREGROUND,
};

/** The title card fades out into the first scene; it starts fully visible so frame 0 is a usable still. */
function useTitleOpacity(): number {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [TITLE_FRAMES - CARD_FADE_FRAMES, TITLE_FRAMES],
    [1, 0],
  );
}

function TitleCard() {
  const opacity = useTitleOpacity();
  return (
    <AbsoluteFill style={{ ...centered, opacity }}>
      <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -3 }}>
        {PRODUCT_NAME}
      </div>
      <div style={{ fontSize: 46, color: MUTED, marginTop: 24 }}>
        {PRODUCT_TAGLINE}
      </div>
    </AbsoluteFill>
  );
}

function EndCard() {
  return (
    <AbsoluteFill style={centered}>
      <div style={{ fontSize: 64, fontWeight: 600 }}>
        Try it in your browser
      </div>
      <div style={{ fontSize: 56, color: ACCENT, marginTop: 28 }}>
        {END_URL}
      </div>
      <div style={{ fontSize: 34, color: MUTED, marginTop: 28 }}>
        Free, local-first, no sign-up.
      </div>
    </AbsoluteFill>
  );
}

/** Slowly pushes in on the scene's active area once the payoff starts. */
function useZoom(scene: DemoScene): { scale: number; origin: string } {
  const frame = useCurrentFrame();
  const payoff = scene.segments.findLast((s) => s.rate === NORMAL_RATE);
  const startsAt = payoff
    ? scene.segments
        .slice(0, scene.segments.indexOf(payoff))
        .reduce((total, s) => total + s.frames, 0)
    : 0;
  const scale = interpolate(
    frame,
    [startsAt, startsAt + ZOOM_IN_FRAMES],
    [1, scene.focus.zoom],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return { scale, origin: `${scene.focus.x * 100}% ${scene.focus.y * 100}%` };
}

function SceneClip({ scene }: { scene: DemoScene }) {
  const { scale, origin } = useZoom(scene);
  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
      <AbsoluteFill
        style={{ transform: `scale(${scale})`, transformOrigin: origin }}
      >
        {scene.segments.map((segment) => {
          const from = offset;
          offset += segment.frames;
          return (
            <Sequence
              key={segment.sourceStartFrame}
              from={from}
              durationInFrames={segment.frames}
            >
              <OffthreadVideo
                src={scene.src}
                startFrom={segment.sourceStartFrame}
                playbackRate={segment.rate}
                muted
                style={{ width: "100%", height: "100%" }}
              />
              {segment.rate !== NORMAL_RATE && (
                <SpeedBadge rate={segment.rate} />
              )}
            </Sequence>
          );
        })}
      </AbsoluteFill>
      <Caption scene={scene} />
    </AbsoluteFill>
  );
}

function SpeedBadge({ rate }: { rate: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 48,
        padding: "8px 18px",
        borderRadius: 999,
        fontFamily: FONT_FAMILY,
        fontSize: 30,
        fontWeight: 600,
        color: BACKGROUND,
        backgroundColor: ACCENT,
        opacity: SPEED_BADGE_OPACITY,
      }}
    >
      {rate}x
    </div>
  );
}

function Caption({ scene }: { scene: DemoScene }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, CAPTION_FADE_FRAMES, scene.frames - CAPTION_FADE_FRAMES, scene.frames],
    [0, 1, 1, 0],
  );
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", opacity }}
    >
      <div
        style={{
          marginBottom: CAPTION_BOTTOM_PX,
          padding: "20px 36px",
          borderRadius: CAPTION_RADIUS_PX,
          backgroundColor: CAPTION_BACKDROP,
          fontFamily: FONT_FAMILY,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700, color: FOREGROUND }}>
          {scene.title}
        </div>
        <div style={{ fontSize: 32, color: MUTED, marginTop: 6 }}>
          {scene.caption}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function DemoVideo() {
  const scenes = buildScenes(loadManifest());
  const last = scenes.at(-1);
  const endFrom = last ? last.from + last.frames : TITLE_FRAMES;
  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
      <Sequence durationInFrames={TITLE_FRAMES}>
        <TitleCard />
      </Sequence>
      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.from}
          durationInFrames={scene.frames}
        >
          <SceneClip scene={scene} />
        </Sequence>
      ))}
      <Sequence from={endFrom} durationInFrames={END_FRAMES}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}
