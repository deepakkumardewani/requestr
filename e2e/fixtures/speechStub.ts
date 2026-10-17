/**
 * Controllable fake `SpeechRecognition` for the Relay dictation specs. No real microphone or
 * recognizer is involved; the test drives results, errors and end through `window.__speechStub`.
 */
import type { Page } from "@playwright/test";

export type StubResult = { transcript: string; isFinal: boolean };

/** Installs the fake constructor on `window.SpeechRecognition` before any page script runs. */
export async function installSpeechStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Handler = ((event: unknown) => void) | null;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      active = false;
      results: { isFinal: boolean; 0: { transcript: string } }[] = [];
      constructor() {
        const w = window as unknown as {
          __speechStub: Record<string, unknown>;
        };
        const stub = w.__speechStub as { instances: FakeRecognition[] };
        stub.instances.push(this);
      }
      start() {
        this.active = true;
      }
      stop() {
        this.finish();
      }
      abort() {
        this.active = false;
      }
      finish() {
        if (!this.active) return;
        this.active = false;
        this.onend?.();
      }
    }
    const w = window as unknown as Record<string, unknown>;
    const last = () => {
      const list = (w.__speechStub as { instances: FakeRecognition[] })
        .instances;
      return list[list.length - 1];
    };
    w.__speechStub = {
      instances: [] as FakeRecognition[],
      isActive: () => Boolean(last()?.active),
      lang: () => last()?.lang ?? "",
      emit: (results: { transcript: string; isFinal: boolean }[]) => {
        const rec = last();
        rec.results = results.map((r) => ({
          isFinal: r.isFinal,
          0: { transcript: r.transcript },
        }));
        rec.onresult?.({ resultIndex: 0, results: rec.results });
      },
      fail: (error: string) => {
        const rec = last();
        rec.onerror?.({ error });
        rec.finish();
      },
      end: () => last()?.finish(),
    };
    w.SpeechRecognition = FakeRecognition;
  });
}

/** Makes the browser look like one with no speech recognition at all. */
export async function removeSpeechGlobals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(w, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(w, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
}

/** Pushes recognizer results (cumulative for the session) into the active fake. */
export async function emitSpeech(
  page: Page,
  results: StubResult[],
): Promise<void> {
  await page.evaluate(
    (r) =>
      (
        window as unknown as {
          __speechStub: { emit: (x: StubResult[]) => void };
        }
      ).__speechStub.emit(r),
    results,
  );
}

/** Raises a recognizer error code (e.g. "not-allowed"); the fake then ends like a real one. */
export async function failSpeech(page: Page, code: string): Promise<void> {
  await page.evaluate(
    (c) =>
      (
        window as unknown as { __speechStub: { fail: (x: string) => void } }
      ).__speechStub.fail(c),
    code,
  );
}

/** Whether the fake recognizer is currently started. */
export async function speechActive(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    (
      window as unknown as { __speechStub: { isActive: () => boolean } }
    ).__speechStub.isActive(),
  );
}
