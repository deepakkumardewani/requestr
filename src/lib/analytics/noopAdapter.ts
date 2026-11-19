import type { AnalyticsAdapter } from "@/lib/analytics/adapter";

const noop = (): void => {};

/** Used whenever analytics is disabled: no storage, no network, no logging. */
export const noopAdapter: AnalyticsAdapter = {
  track: noop,
  captureError: noop,
  submitSurvey: noop,
  setEnabled: noop,
};
