import { describe, expect, it } from "vitest";
import { READ_SEGMENT } from "./stepLabels";
import { summariseSteps } from "./stepSummary";

const step = (id: string, toolName?: string) => ({ id, toolName });

describe("summariseSteps", () => {
  it("returns no lines for no steps", () => {
    expect(summariseSteps([])).toEqual([]);
  });

  it("groups consecutive reads of one class into one counted segment", () => {
    const steps = [step("a", "get_request"), step("b", "get_last_response"), step("c", "export_curl")];
    expect(summariseSteps(steps)).toEqual([
      { kind: "reads", segments: [{ key: READ_SEGMENT.request, count: 3 }], steps },
    ]);
  });

  it("keeps separate counts per read class, in first-seen order", () => {
    const steps = [
      step("a", "get_request"),
      step("b", "search_workspace"),
      step("c", "get_request"),
      step("d", "get_collection"),
      step("e", "get_environment"),
    ];
    const [line] = summariseSteps(steps);
    expect(line).toMatchObject({
      kind: "reads",
      segments: [
        { key: READ_SEGMENT.request, count: 2 },
        { key: READ_SEGMENT.searched, count: 1 },
        { key: READ_SEGMENT.explored, count: 1 },
        { key: READ_SEGMENT.item, count: 1 },
      ],
    });
  });

  it("splits runs at a write and preserves order", () => {
    const steps = [
      step("a", "get_request"),
      step("b", "create_collection"),
      step("c", "search_workspace"),
      step("d", "get_workspace_summary"),
    ];
    const lines = summariseSteps(steps);
    expect(lines.map((l) => l.kind)).toEqual(["reads", "step", "reads"]);
    expect(lines[1]).toEqual({ kind: "step", step: steps[1] });
    expect(lines[2]).toMatchObject({
      segments: [
        { key: READ_SEGMENT.searched, count: 1 },
        { key: READ_SEGMENT.explored, count: 1 },
      ],
      steps: [steps[2], steps[3]],
    });
  });

  it("treats steps without a tool and unknown tools as their own lines", () => {
    const steps = [step("a"), step("b", "not_a_tool"), step("c", "get_request")];
    expect(summariseSteps(steps).map((l) => l.kind)).toEqual(["step", "step", "reads"]);
  });

  it("does not mutate the input steps", () => {
    const steps = [step("a", "get_request"), step("b", "get_request")];
    summariseSteps(steps);
    expect(steps).toHaveLength(2);
  });
});
