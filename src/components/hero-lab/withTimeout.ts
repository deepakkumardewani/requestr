/** Target for a hero request to land before the recorded fallback takes over. */
export const HERO_REQUEST_TIMEOUT_MS = 2_500;

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Runs `task` with an AbortSignal that fires after `timeoutMs`, rejecting with
 * a TimeoutError when the deadline wins. The task is aborted on timeout so the
 * underlying request does not linger.
 */
export async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = HERO_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
