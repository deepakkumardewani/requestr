const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** `Ns` under a minute, `Nm Ns` under an hour, `Nh Nm` above; shared by the live header and the group. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m ${seconds % SECONDS_PER_MINUTE}s`;
  }
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${Math.floor(seconds / SECONDS_PER_HOUR)}h ${minutes}m`;
}
