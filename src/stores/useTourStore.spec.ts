import { beforeEach, describe, expect, it } from "vitest";
import { useTourStore } from "./useTourStore";

describe("useTourStore", () => {
  beforeEach(() => {
    useTourStore.getState().end();
  });

  it("starts idle", () => {
    const { active, trigger, currentStep } = useTourStore.getState();
    expect({ active, trigger, currentStep }).toEqual({
      active: false,
      trigger: null,
      currentStep: 0,
    });
  });

  it("begin activates the tour with its trigger at step 0", () => {
    useTourStore.getState().setStep(3);
    useTourStore.getState().begin("replay");
    const { active, trigger, currentStep } = useTourStore.getState();
    expect({ active, trigger, currentStep }).toEqual({
      active: true,
      trigger: "replay",
      currentStep: 0,
    });
  });

  it("setStep updates only the current step", () => {
    useTourStore.getState().begin("auto");
    useTourStore.getState().setStep(4);
    const { active, trigger, currentStep } = useTourStore.getState();
    expect({ active, trigger, currentStep }).toEqual({
      active: true,
      trigger: "auto",
      currentStep: 4,
    });
  });

  it("end resets to idle", () => {
    useTourStore.getState().begin("auto");
    useTourStore.getState().setStep(2);
    useTourStore.getState().end();
    const { active, trigger, currentStep } = useTourStore.getState();
    expect({ active, trigger, currentStep }).toEqual({
      active: false,
      trigger: null,
      currentStep: 0,
    });
  });
});
