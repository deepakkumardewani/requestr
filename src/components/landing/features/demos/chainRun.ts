export type NodeRunState = "idle" | "running" | "done";

/**
 * Where one node stands in a run that has finished `completed` nodes. Only the
 * node right after the finished ones is running, and only while the run is.
 */
export function nodeRunState(
  index: number,
  completed: number,
  running: boolean,
): NodeRunState {
  if (index < completed) return "done";
  if (running && index === completed) return "running";
  return "idle";
}
