// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SttRequestError } from "@/lib/relay/stt/errors";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useGrokDictation } from "./useGrokDictation";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const capture = vi.hoisted(() => ({
  isCaptureSupported: vi.fn(),
  startCapture: vi.fn(),
}));
const client = vi.hoisted(() => ({ transcribeAudio: vi.fn() }));

vi.mock("@/lib/relay/stt/audioCapture", () => capture);
vi.mock("@/lib/relay/stt/client", () => client);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const BLOB = new Blob(["wav"], { type: "audio/wav" });
const analyser = {} as AnalyserNode;

function makeSession(durationMs = 2000) {
  return {
    analyser,
    stop: vi.fn().mockResolvedValue({ blob: BLOB, durationMs }),
    abort: vi.fn(),
  };
}

function setup() {
  const onText = vi.fn();
  const hook = renderHook(() => useGrokDictation({ onText }));
  return { onText, ...hook };
}

async function record(
  result: ReturnType<typeof setup>["result"],
  session = makeSession(),
) {
  capture.startCapture.mockResolvedValueOnce(session);
  await act(async () => {
    await result.current.start();
  });
  return session;
}

beforeEach(() => {
  capture.isCaptureSupported.mockReturnValue(true);
  useRelayStore.setState({ activeThreadId: "t1", enabled: true });
  useSettingsStore.setState({ locale: "en" } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useGrokDictation", () => {
  it("reports support from the capture check", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.supported).toBe(true));
    expect(result.current.state).toBe("idle");
  });

  it("reports unsupported when capture is unavailable", () => {
    capture.isCaptureSupported.mockReturnValue(false);
    const { result } = setup();
    expect(result.current.supported).toBe(false);
  });

  it("records, transcribes and hands back trimmed text once", async () => {
    client.transcribeAudio.mockResolvedValue("  hello world  ");
    const { result, onText } = setup();
    await record(result);
    expect(result.current.state).toBe("recording");
    expect(result.current.analyser).toBe(analyser);

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.analyser).toBeNull();
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith("hello world");
    expect(client.transcribeAudio).toHaveBeenCalledWith(
      BLOB,
      expect.objectContaining({ language: "en" }),
    );
  });

  it("is in transcribing state while the upload is pending", async () => {
    const pending = deferred<string>();
    client.transcribeAudio.mockReturnValue(pending.promise);
    const { result } = setup();
    await record(result);

    let stopping!: Promise<void>;
    act(() => {
      stopping = result.current.stop();
    });
    await waitFor(() => expect(result.current.state).toBe("transcribing"));

    await act(async () => {
      pending.resolve("done");
      await stopping;
    });
    expect(result.current.state).toBe("idle");
  });

  it("ignores start while recording or transcribing", async () => {
    const { result } = setup();
    await record(result);
    await act(async () => {
      await result.current.start();
    });
    expect(capture.startCapture).toHaveBeenCalledTimes(1);
  });

  it("ignores stop when nothing is recording", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.stop();
    });
    expect(client.transcribeAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });

  it("flags a recording under the minimum as tooShort without uploading", async () => {
    const { result, onText } = setup();
    await record(result, makeSession(499));
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("tooShort");
    expect(client.transcribeAudio).not.toHaveBeenCalled();
    expect(onText).not.toHaveBeenCalled();
    expect(result.current.canRetry).toBe(false);
  });

  it("uploads a recording of exactly the minimum", async () => {
    client.transcribeAudio.mockResolvedValue("ok");
    const { result, onText } = setup();
    await record(result, makeSession(500));
    await act(async () => {
      await result.current.stop();
    });
    expect(onText).toHaveBeenCalledWith("ok");
  });

  it("reports tooShort when the transcript is blank", async () => {
    client.transcribeAudio.mockResolvedValue("   ");
    const { result, onText } = setup();
    await record(result);
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.error).toBe("tooShort");
    expect(onText).not.toHaveBeenCalled();
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["NotFoundError", "noMic"],
  ])("maps mic failure %s to %s without uploading", async (name, kind) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    capture.startCapture.mockRejectedValueOnce(new DOMException("x", name));
    const { result } = setup();
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe(kind);
    expect(client.transcribeAudio).not.toHaveBeenCalled();
  });

  it("surfaces the request error kind and keeps the blob for retry", async () => {
    client.transcribeAudio.mockRejectedValueOnce(new SttRequestError("busy"));
    const { result, onText } = setup();
    await record(result);
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.error).toBe("busy");
    expect(result.current.canRetry).toBe(true);

    client.transcribeAudio.mockResolvedValueOnce("second try");
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(onText).toHaveBeenCalledWith("second try"));
    expect(client.transcribeAudio).toHaveBeenLastCalledWith(
      BLOB,
      expect.anything(),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.state).toBe("idle");
    expect(capture.startCapture).toHaveBeenCalledTimes(1);
  });

  it("treats an unknown upload failure as unavailable", async () => {
    client.transcribeAudio.mockRejectedValueOnce(new TypeError("offline"));
    const { result } = setup();
    await record(result);
    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.error).toBe("unavailable");
  });

  it("retry does nothing without a kept blob", async () => {
    const { result } = setup();
    act(() => result.current.retry());
    expect(client.transcribeAudio).not.toHaveBeenCalled();
  });

  it("dismissError clears the error and the kept blob", async () => {
    client.transcribeAudio.mockRejectedValueOnce(new SttRequestError("network"));
    const { result } = setup();
    await record(result);
    await act(async () => {
      await result.current.stop();
    });
    act(() => result.current.dismissError());
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
    act(() => result.current.retry());
    expect(client.transcribeAudio).toHaveBeenCalledTimes(1);
  });

  it("starting a new recording drops the kept blob", async () => {
    client.transcribeAudio.mockRejectedValueOnce(new SttRequestError("busy"));
    const { result } = setup();
    await record(result);
    await act(async () => {
      await result.current.stop();
    });
    await record(result);
    expect(result.current.error).toBeNull();
    expect(result.current.canRetry).toBe(false);
  });

  it("stops and flags limitReached when the recording cap fires", async () => {
    client.transcribeAudio.mockResolvedValue("capped");
    const { result, onText } = setup();
    await record(result);
    const { onLimit } = capture.startCapture.mock.calls[0][0];
    await act(async () => {
      onLimit();
    });
    await waitFor(() => expect(onText).toHaveBeenCalledWith("capped"));
    expect(result.current.limitReached).toBe(true);
  });

  it("clears limitReached on the next start", async () => {
    client.transcribeAudio.mockResolvedValue("x");
    const { result } = setup();
    await record(result);
    const { onLimit } = capture.startCapture.mock.calls[0][0];
    await act(async () => {
      onLimit();
    });
    await waitFor(() => expect(result.current.state).toBe("idle"));
    await record(result);
    expect(result.current.limitReached).toBe(false);
  });

  describe("abort and discard", () => {
    it("aborts the recording when the thread switches and inserts nothing", async () => {
      const { result, onText } = setup();
      const session = await record(result);
      act(() => useRelayStore.setState({ activeThreadId: "t2" }));
      expect(session.abort).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe("idle");
      expect(result.current.analyser).toBeNull();
      expect(onText).not.toHaveBeenCalled();
    });

    it("aborts the recording when Relay is disabled", async () => {
      const { result } = setup();
      const session = await record(result);
      act(() => useRelayStore.setState({ enabled: false }));
      expect(session.abort).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe("idle");
    });

    it("aborts the recording on unmount (dock close)", async () => {
      const { result, unmount } = setup();
      const session = await record(result);
      unmount();
      expect(session.abort).toHaveBeenCalledTimes(1);
    });

    it("aborts the request and ignores its late result on thread switch", async () => {
      const pending = deferred<string>();
      client.transcribeAudio.mockReturnValue(pending.promise);
      const { result, onText } = setup();
      await record(result);
      let stopping!: Promise<void>;
      act(() => {
        stopping = result.current.stop();
      });
      await waitFor(() => expect(result.current.state).toBe("transcribing"));
      const { signal } = client.transcribeAudio.mock.calls[0][1];

      act(() => useRelayStore.setState({ activeThreadId: "t2" }));
      expect(signal.aborted).toBe(true);
      expect(result.current.state).toBe("idle");

      await act(async () => {
        pending.resolve("late");
        await stopping;
      });
      expect(onText).not.toHaveBeenCalled();
      expect(result.current.state).toBe("idle");
    });

    it("ignores a late failure from a discarded request", async () => {
      const pending = deferred<string>();
      client.transcribeAudio.mockReturnValue(pending.promise);
      const { result } = setup();
      await record(result);
      let stopping!: Promise<void>;
      act(() => {
        stopping = result.current.stop();
      });
      await waitFor(() => expect(result.current.state).toBe("transcribing"));
      act(() => useRelayStore.setState({ enabled: false }));
      await act(async () => {
        pending.reject(new SttRequestError("busy"));
        await stopping;
      });
      expect(result.current.error).toBeNull();
      expect(result.current.canRetry).toBe(false);
    });

    it("ignores a stop result that arrives after discard", async () => {
      const stopped = deferred<{ blob: Blob; durationMs: number }>();
      const session = makeSession();
      session.stop.mockReturnValue(stopped.promise);
      const { result } = setup();
      await record(result, session);
      let stopping!: Promise<void>;
      act(() => {
        stopping = result.current.stop();
      });
      act(() => useRelayStore.setState({ activeThreadId: "t2" }));
      await act(async () => {
        stopped.resolve({ blob: BLOB, durationMs: 2000 });
        await stopping;
      });
      expect(client.transcribeAudio).not.toHaveBeenCalled();
      expect(result.current.state).toBe("idle");
    });

    it("aborts a session that resolves after discard", async () => {
      const starting = deferred<ReturnType<typeof makeSession>>();
      capture.startCapture.mockReturnValueOnce(starting.promise);
      const { result } = setup();
      let started!: Promise<void>;
      act(() => {
        started = result.current.start();
      });
      act(() => useRelayStore.setState({ activeThreadId: "t2" }));
      const session = makeSession();
      await act(async () => {
        starting.resolve(session);
        await started;
      });
      expect(session.abort).toHaveBeenCalledTimes(1);
      expect(result.current.state).toBe("idle");
    });

    it("ignores a mic failure that arrives after discard", async () => {
      const starting = deferred<never>();
      capture.startCapture.mockReturnValueOnce(starting.promise);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { result } = setup();
      let started!: Promise<void>;
      act(() => {
        started = result.current.start();
      });
      act(() => useRelayStore.setState({ enabled: false }));
      await act(async () => {
        starting.reject(new DOMException("x", "NotAllowedError"));
        await started;
      });
      expect(result.current.error).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
