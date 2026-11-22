import { TOUR_ANCHORS, type TourAnchor } from "./tourAnchors";

export type TourStepId =
  | "urlBar"
  | "sampleRequests"
  | "save"
  | "environments"
  | "chains"
  | "relay"
  | "palette";

export type TourStepDefinition = {
  id: TourStepId;
  /** Null for a centred popover that needs no element (always resolves). */
  anchor: TourAnchor | null;
  side?: "top" | "right" | "bottom" | "left";
};

/** Ordered first-run steps; copy lives under `common.tour.steps.<id>`. */
export const TOUR_STEPS: readonly TourStepDefinition[] = [
  { id: "urlBar", anchor: TOUR_ANCHORS.urlBarSend, side: "bottom" },
  { id: "sampleRequests", anchor: TOUR_ANCHORS.sampleRequests, side: "right" },
  { id: "save", anchor: TOUR_ANCHORS.saveToCollection, side: "bottom" },
  { id: "environments", anchor: TOUR_ANCHORS.environments, side: "right" },
  { id: "chains", anchor: TOUR_ANCHORS.chains, side: "right" },
  { id: "relay", anchor: TOUR_ANCHORS.relayDock, side: "bottom" },
  { id: "palette", anchor: null },
];
