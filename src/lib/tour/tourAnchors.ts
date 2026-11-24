/** Single source for `data-tour` values; components and steps reference this map only. */
export const TOUR_ANCHORS = {
  urlBarSend: "url-bar-send",
  requestTabs: "request-tabs",
  response: "response",
  sampleRequests: "sample-requests",
  collections: "collections",
  saveToCollection: "save-to-collection",
  environments: "environments",
  chains: "chains",
  relayDock: "relay-dock",
} as const;

export type TourAnchor = (typeof TOUR_ANCHORS)[keyof typeof TOUR_ANCHORS];

export function tourAnchorSelector(anchor: TourAnchor): string {
  return `[data-tour="${anchor}"]`;
}
