import { describe, expect, it, vi } from "vitest";
import { evaluateInSandbox } from "@/lib/chainEval";
import { lockdownGlobals } from "@/lib/chainEvalLockdown";
import "@/lib/chainEvalWorker";

vi.mock("@/lib/chainEval", () => ({
  evaluateInSandbox: vi.fn(),
}));

// Mocked so the real lockdown does not freeze the test runner's own fetch/etc.
vi.mock("@/lib/chainEvalLockdown", () => ({ lockdownGlobals: vi.fn() }));

describe("chainEvalWorker", () => {
  it("locks down the global scope at load time", () => {
    expect(lockdownGlobals).toHaveBeenCalledTimes(1);
  });

  it("delegates incoming messages to evaluateInSandbox and posts the result", () => {
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => {});
    const input = { code: "data.value", data: { value: 1 }, inputs: {}, env: {} };
    const output = { output: 1 };
    vi.mocked(evaluateInSandbox).mockReturnValue(output);

    expect(self.onmessage).toBeTypeOf("function");
    (self.onmessage as (e: MessageEvent) => void)({ data: { id: 7, ...input } } as MessageEvent);

    expect(evaluateInSandbox).toHaveBeenCalledWith(input);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: 7, result: output });

    postMessageSpy.mockRestore();
  });
});
