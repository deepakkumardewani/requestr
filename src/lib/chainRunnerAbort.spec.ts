import { describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
import type { ChainEdge } from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({ runRequest: vi.fn() }));

import { runRequest } from "@/lib/requestRunner";
import { runChain } from "./chainRunner";
import { CHAIN_ERROR_CODE } from "./chainRunner/errorCodes";

const request = (id: string): RequestModel =>
  ({
    id,
    collectionId: "c",
    name: id,
    method: "GET",
    url: `https://api.test/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "json", content: "{}" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  }) as RequestModel;

const edge: ChainEdge = {
  id: "e1",
  sourceRequestId: "a",
  targetRequestId: "b",
  injections: [
    { sourceJsonPath: "$.id", targetField: "header", targetKey: "x" },
  ],
};

describe("runChain abort handling", () => {
  it("sends nothing and promotes nothing when aborted before start", async () => {
    const controller = new AbortController();
    controller.abort();
    const onUpdate = vi.fn();
    const onPromoteToEnv = vi.fn();

    await runChain({
      requests: [request("a"), request("b")],
      edges: [edge],
      onUpdate,
      signal: controller.signal,
      envPromotions: [{ edgeId: "e1", envId: "env", envVarName: "V" }],
      onPromoteToEnv,
    });

    expect(runRequest).not.toHaveBeenCalled();
    expect(onPromoteToEnv).not.toHaveBeenCalled();
    for (const [, state, data] of onUpdate.mock.calls) {
      expect(["aborted", "skipped"]).toContain(state);
      expect(data).toMatchObject({ errorCode: CHAIN_ERROR_CODE.RUN_STOPPED });
    }
    expect(onUpdate.mock.calls.some(([id]) => id === "b")).toBe(true);
  });
});
