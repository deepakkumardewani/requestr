"use client";

import { useEffect, useState } from "react";
import { STT_LEVEL_BARS } from "@/lib/relay/constants";
import { startLevelMeter } from "@/lib/relay/stt/audioLevel";

const SILENT_LEVELS = Array.from({ length: STT_LEVEL_BARS }, () => 0);
const MIN_BAR_PERCENT = 15;
const FULL_PERCENT = 100;

type LevelMeterProps = { analyser: AnalyserNode };

/** Five bars that follow the microphone level while Grok is recording. Decorative: the status text carries the meaning. */
export function LevelMeter({ analyser }: LevelMeterProps) {
  const [levels, setLevels] = useState(SILENT_LEVELS);
  useEffect(() => startLevelMeter(analyser, setLevels), [analyser]);

  return (
    <span
      aria-hidden
      data-testid="relay-mic-meter"
      className="flex h-4 items-center gap-0.5"
    >
      {levels.map((level, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of identical bars
          key={index}
          data-testid="relay-mic-meter-bar"
          className="w-0.5 rounded-full bg-destructive motion-safe:transition-[height] motion-safe:duration-100"
          style={{
            height: `${MIN_BAR_PERCENT + level * (FULL_PERCENT - MIN_BAR_PERCENT)}%`,
          }}
        />
      ))}
    </span>
  );
}
