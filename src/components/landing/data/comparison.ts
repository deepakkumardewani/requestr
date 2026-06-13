export interface ComparisonRow {
  feature: string;
  requestr: string;
  postman: string;
  requestrWins: boolean;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Install required",
    requestr: "None — open a tab",
    postman: "Desktop app download",
    requestrWins: true,
  },
  {
    feature: "Account required",
    requestr: "No",
    postman: "Yes",
    requestrWins: true,
  },
  {
    feature: "Data location",
    requestr: "Your browser only",
    postman: "Postman cloud",
    requestrWins: true,
  },
  {
    feature: "Time to first request",
    requestr: "< 5 seconds",
    postman: "Minutes (download + login)",
    requestrWins: true,
  },
  {
    feature: "CORS workaround",
    requestr: "Built-in browser proxy",
    postman: "Requires Postman agent",
    requestrWins: true,
  },
  {
    feature: "Price",
    requestr: "Free, forever",
    postman: "Free tier + paid plans",
    requestrWins: true,
  },
];
