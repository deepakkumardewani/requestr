import { type ReadSegmentKey, readSegmentFor } from "./stepLabels";

/** What the summary needs of a step: its id and, for tool steps, the tool. */
export type SummarisableStep = { id: string; toolName?: string };

export type ReadSegment = { key: ReadSegmentKey; count: number };

export type SummaryLine<Step extends SummarisableStep> =
  | { kind: "reads"; segments: ReadSegment[]; steps: Step[] }
  | { kind: "step"; step: Step };

function addToSegments(
  segments: ReadSegment[],
  key: ReadSegmentKey,
): ReadSegment[] {
  const existing = segments.find((segment) => segment.key === key);
  if (!existing) return [...segments, { key, count: 1 }];
  return segments.map((segment) =>
    segment === existing ? { ...segment, count: segment.count + 1 } : segment,
  );
}

/**
 * Collapses each run of consecutive read steps into one line with per-class
 * counts ("Read 3 requests, searched 2 times"). Anything else, including a
 * write, stays its own line, and order is preserved. Labels are i18n keys.
 */
export function summariseSteps<Step extends SummarisableStep>(
  steps: readonly Step[],
): SummaryLine<Step>[] {
  const lines: SummaryLine<Step>[] = [];
  for (const step of steps) {
    const key = step.toolName ? readSegmentFor(step.toolName) : null;
    const last = lines.at(-1);
    if (key && last?.kind === "reads") {
      last.segments = addToSegments(last.segments, key);
      last.steps.push(step);
    } else if (key) {
      lines.push({
        kind: "reads",
        segments: [{ key, count: 1 }],
        steps: [step],
      });
    } else {
      lines.push({ kind: "step", step });
    }
  }
  return lines;
}
