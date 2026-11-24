import { TOUR_ANCHORS, type TourAnchor } from "./tourAnchors";
import {
  areSampleRequestsShown,
  hasActiveRequestTab,
  hasResponsePanel,
  isCollectionsSidebarShown,
  isRelayAvailable,
} from "./tourApplicability";

export type TourStepId =
  | "urlBar"
  | "requestTabs"
  | "response"
  | "sampleRequests"
  | "collections"
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
  /**
   * False when the anchor cannot appear without the user changing the UI; such
   * steps are skipped instead of waited for. Omitted means always applicable.
   */
  isApplicable?: () => boolean;
};

/** Ordered first-run steps; copy lives under `common.tour.steps.<id>`. */
export const TOUR_STEPS: readonly TourStepDefinition[] = [
  {
    id: "urlBar",
    anchor: TOUR_ANCHORS.urlBarSend,
    side: "bottom",
    isApplicable: hasActiveRequestTab,
  },
  {
    id: "requestTabs",
    anchor: TOUR_ANCHORS.requestTabs,
    side: "bottom",
    isApplicable: hasActiveRequestTab,
  },
  {
    id: "response",
    anchor: TOUR_ANCHORS.response,
    side: "top",
    isApplicable: hasResponsePanel,
  },
  {
    id: "sampleRequests",
    anchor: TOUR_ANCHORS.sampleRequests,
    side: "right",
    isApplicable: areSampleRequestsShown,
  },
  {
    id: "collections",
    anchor: TOUR_ANCHORS.collections,
    side: "right",
    isApplicable: isCollectionsSidebarShown,
  },
  {
    id: "save",
    anchor: TOUR_ANCHORS.saveToCollection,
    side: "bottom",
    isApplicable: hasActiveRequestTab,
  },
  { id: "environments", anchor: TOUR_ANCHORS.environments, side: "right" },
  {
    id: "chains",
    anchor: TOUR_ANCHORS.chains,
    side: "right",
    isApplicable: isCollectionsSidebarShown,
  },
  {
    id: "relay",
    anchor: TOUR_ANCHORS.relayDock,
    side: "bottom",
    isApplicable: isRelayAvailable,
  },
  { id: "palette", anchor: null },
];
