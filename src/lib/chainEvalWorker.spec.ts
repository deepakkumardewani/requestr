import { describe, expect, it, vi } from "vitest";
import { evaluateInSandbox } from "@/lib/chainEval";
import "@/lib/chainEvalWorker";

vi.mock("@/lib/chainEval", () => ({
  evaluateInSandbox: vi.fn(),
}));

describe("chainEvalWorker", () => {
  it("delegates incoming messages to evaluateInSandbox and posts the result", () => {
    const postMessageSpy = vi
      .spyOn(globalThis, "postMessage")
      .mockImplementation(() => {});
    const input = { code: "data.value", data: { value: 1 }, inputs: {}, env: {} };
    const output = { output: 1 };
    vi.mocked(evaluateInSandbox).mockReturnValue(output);

    expect(self.onmessage).toBeTypeOf("function");
    (self.onmessage as (e: MessageEvent) => void)({ data: input } as MessageEvent);

    expect(evaluateInSandbox).toHaveBeenCalledWith(input);
    expect(postMessageSpy).toHaveBeenCalledWith(output);

    postMessageSpy.mockRestore();
  });
});
