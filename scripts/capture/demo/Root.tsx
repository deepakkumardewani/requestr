import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import {
  buildScenes,
  FPS,
  loadManifest,
  totalFrames,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./scenes";

export const COMPOSITION_ID = "DemoVideo";

/** Length follows the recorded scene timings, so re-recording never needs a code change. */
const calculateMetadata = () => ({
  durationInFrames: totalFrames(buildScenes(loadManifest())),
});

export function Root() {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={DemoVideo}
      durationInFrames={1}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      calculateMetadata={calculateMetadata}
    />
  );
}
