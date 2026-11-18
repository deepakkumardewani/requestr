import { describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import type { ChainRunState } from "@/types/chain";
import { MAX_BODY_BYTES } from "@/lib/chainRunHistory";
import {
  idleRunState,
  makeOnUpdate,
  makeRunStep,
  resolveNodeMeta,
  REDACTED_VALUE,
  serialiseHttpRequest,
  stepKey,
} from "./stepRecording";

describe("stepRecording", () => {
  it("idleRunState marks every id idle", () => {
    expect(idleRunState(["a", "b"])).toEqual({
      a: { state: "idle", extractedValues: {} },
      b: { state: "idle", extractedValues: {} },
    });
  });

  it("stepKey disambiguates loop iterations", () => {
    expect(stepKey("n", {})).toBe("n");
    expect(stepKey("n", { parentStepId: "loop", iteration: 2 })).toBe(
      "n::loop::2",
    );
  });

  it("resolveNodeMeta resolves requests, blocks, Start and falls back to the raw id", () => {
    const graph = {
      requests: [{ id: "r", name: "Get user" } as RequestModel],
      delayNodes: [{ id: "d", type: "delay" as const, delayMs: 1 }],
      startBlock: { id: "s", type: "start" as const, inputs: [] },
    };

    expect(resolveNodeMeta("r", graph)).toEqual({
      nodeType: "api",
      label: "Get user",
    });
    expect(resolveNodeMeta("d", graph)).toEqual({
      nodeType: "delay",
      label: "Delay",
    });
    expect(resolveNodeMeta("s", graph)).toEqual({
      nodeType: "start",
      label: "Start",
    });
    expect(resolveNodeMeta("unknown", graph)).toEqual({
      nodeType: "api",
      label: "unknown",
    });
  });

  it("makeOnUpdate mirrors updates into runState, records the step, and flags failures", () => {
    let state: ChainRunState = {};
    const recordStep = vi.fn();
    const onFailed = vi.fn();
    const onUpdate = makeOnUpdate({
      setRunState: (updater) => {
        state = updater(state);
      },
      recordStep,
      onFailed,
    });

    onUpdate("n", "passed", { activeBranchId: "b1" });
    expect(onFailed).not.toHaveBeenCalled();
    expect(state.n?.activeBranchId).toBe("b1");

    onUpdate("n", "failed", { error: "boom" });
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(state.n).toMatchObject({ state: "failed", error: "boom" });
    expect(recordStep).toHaveBeenCalledTimes(2);
  });

  it("makeRunStep prefers the sent request and carries errorKind, assertions and inputs", () => {
    const template = {
      id: "a",
      name: "a",
      method: "GET",
      url: "{{host}}/x",
      headers: [],
      body: { type: "json", content: "" },
    } as unknown as RequestModel;
    const assertions = [
      {
        id: "as-1",
        source: "status" as const,
        operator: "eq" as const,
        expectedValue: "200",
        enabled: true,
      },
    ];

    const step = makeRunStep({
      nodeId: "a",
      state: "failed",
      data: {
        request: { method: "GET", url: "https://h.test/x", headers: {} },
        errorKind: "assertion",
        assertions,
        inputs: { delayMs: 3 },
      },
      meta: { nodeType: "api", label: "a" },
      request: template,
      startedAt: Date.now(),
    });

    expect(step.request?.url).toBe("https://h.test/x");
    expect(step.errorKind).toBe("assertion");
    expect(step.assertions).toEqual(assertions);
    expect(step.inputs).toEqual({ delayMs: 3 });
  });

  it("serialiseHttpRequest keeps enabled headers only and caps the body", () => {
    const serialised = serialiseHttpRequest({
      method: "POST",
      url: "https://h.test",
      headers: [
        { id: "h1", key: "on", value: "1", enabled: true },
        { id: "h2", key: "off", value: "2", enabled: false },
      ],
      body: "x".repeat(MAX_BODY_BYTES + 10),
    });
    expect(serialised.headers).toEqual({ on: "1" });
    expect(serialised.body?.length).toBe(MAX_BODY_BYTES);
  });

  describe("secret redaction", () => {
    const send = (headers: Array<[string, string]>, url = "https://h.test") =>
      serialiseHttpRequest({
        method: "GET",
        url,
        headers: headers.map(([key, value], index) => ({ id: `h${index}`, key, value, enabled: true })),
      });

    it("masks sensitive request headers case-insensitively", () => {
      const { headers } = send([
        ["Authorization", "Bearer s3cret"],
        ["X-API-KEY", "k"],
        ["cookie", "sid=1"],
      ]);
      expect(headers).toEqual({
        Authorization: REDACTED_VALUE,
        "X-API-KEY": REDACTED_VALUE,
        cookie: REDACTED_VALUE,
      });
    });

    it("leaves non-sensitive headers untouched", () => {
      const { headers } = send([
        ["Content-Type", "application/json"],
        ["Authorization", "x"],
      ]);
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("masks credential query params but keeps the URL otherwise readable", () => {
      const { url } = send(
        [],
        "https://h.test/users?page=2&API_KEY=abc&token=t#frag",
      );
      expect(url).toBe(
        `https://h.test/users?page=2&API_KEY=${REDACTED_VALUE}&token=${REDACTED_VALUE}#frag`,
      );
    });

    it("masks set-cookie on persisted responses", () => {
      const step = makeRunStep({
        nodeId: "a",
        state: "passed",
        data: {
          response: {
            status: 200,
            statusText: "OK",
            headers: { "Set-Cookie": "sid=1", "content-type": "text/plain" },
            body: "",
            duration: 1,
            size: 0,
            url: "",
            method: "GET",
            timestamp: 0,
          },
        },
        meta: { nodeType: "api", label: "a" },
        request: undefined,
        startedAt: Date.now(),
      });
      expect(step.response?.headers).toEqual({
        "Set-Cookie": REDACTED_VALUE,
        "content-type": "text/plain",
      });
    });

    it("redacts the template fallback request too", () => {
      const template = {
        id: "a",
        name: "a",
        method: "GET",
        url: "https://h.test?token=abc",
        headers: [{ key: "Authorization", value: "Bearer x", enabled: true }],
        body: { type: "json", content: "" },
      } as unknown as RequestModel;
      const step = makeRunStep({
        nodeId: "a",
        state: "skipped",
        data: {},
        meta: { nodeType: "api", label: "a" },
        request: template,
        startedAt: Date.now(),
      });
      expect(step.request?.headers.Authorization).toBe(REDACTED_VALUE);
      expect(step.request?.url).toContain(`token=${REDACTED_VALUE}`);
    });
  });
});
