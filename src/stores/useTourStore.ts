"use client";

import { create } from "zustand";

export type TourTrigger = "auto" | "replay";

type TourState = {
  active: boolean;
  trigger: TourTrigger | null;
  currentStep: number;
};

type TourActions = {
  begin: (trigger: TourTrigger) => void;
  setStep: (step: number) => void;
  end: () => void;
};

const IDLE_STATE: TourState = { active: false, trigger: null, currentStep: 0 };

/** Transient tour progress; completion is persisted separately by `startTour`. */
export const useTourStore = create<TourState & TourActions>((set) => ({
  ...IDLE_STATE,
  begin: (trigger) => set({ active: true, trigger, currentStep: 0 }),
  setStep: (currentStep) => set({ currentStep }),
  end: () => set(IDLE_STATE),
}));
