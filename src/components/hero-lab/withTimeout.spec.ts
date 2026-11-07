import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HERO_REQUEST_TIMEOUT_MS,
  TimeoutError,
  withTimeout,
} from "./withTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the task value when it finishes first", async () => {
    await expect(withTimeout(async () => "ok", 100)).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates task rejections unchanged", async () => {
    await expect(
      withTimeout(async () => {
        throw new Error("boom");
      }, 100),
    ).rejects.toThrow("boom");
  });

  it("rejects with TimeoutError and aborts the signal when the deadline wins", async () => {
    let captured: AbortSignal | undefined;
    const result = withTimeout((signal) => {
      captured = signal;
      return new Promise<string>(() => {});
    }, 500);
    const assertion = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Timed out after 500ms",
    });
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(captured?.aborted).toBe(true);
  });

  it("does not abort before the deadline", async () => {
    let captured: AbortSignal | undefined;
    void withTimeout((signal) => {
      captured = signal;
      return new Promise<string>(() => {});
    }, 500).catch(() => {});
    await vi.advanceTimersByTimeAsync(499);
    expect(captured?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(captured?.aborted).toBe(true);
  });

  it("defaults to the hero request timeout", async () => {
    const result = withTimeout(() => new Promise<string>(() => {}));
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(HERO_REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
