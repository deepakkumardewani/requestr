export type ComparisonEmphasis = "requestr" | "postman" | "insomnia" | null;

export interface ComparisonRow {
  feature: string;
  requestr: string;
  postman: string;
  insomnia: string;
  /** Which column gets subtle highlight — null means neutral row */
  emphasis: ComparisonEmphasis;
  /** Official sources used to verify this row (not rendered in UI) */
  sources: string[];
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Install required",
    requestr: "None — open a browser tab",
    postman: "Desktop app or web app",
    insomnia: "Desktop app download",
    emphasis: "requestr",
    sources: [
      "https://learning.postman.com/docs/getting-started/installation/installation-and-updates",
      "https://insomnia.rest/download",
    ],
  },
  {
    feature: "Account required",
    requestr: "No",
    postman: "Optional (sign-in for sync & collections)",
    insomnia: "Optional (Scratch Pad works without account)",
    emphasis: "requestr",
    sources: [
      "https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman",
      "https://github.com/Kong/insomnia/blob/develop/README.md",
      "https://insomnia.rest/",
    ],
  },
  {
    feature: "Data location",
    requestr: "Stored in your browser only",
    postman: "Local in lightweight client; cloud sync optional",
    insomnia: "Local by default; cloud or Git optional",
    emphasis: "requestr",
    sources: [
      "https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman",
      "https://github.com/Kong/insomnia/blob/develop/README.md",
      "https://konghq.com/blog/engineering/why-kong-insomnia-is-developers-preferred-api-client",
    ],
  },
  {
    feature: "Time to first request",
    requestr: "Seconds (open tab, send)",
    postman: "Minutes if downloading desktop app",
    insomnia: "Minutes if downloading desktop app",
    emphasis: "requestr",
    sources: [
      "https://learning.postman.com/docs/getting-started/installation/installation-and-updates",
      "https://insomnia.rest/download",
    ],
  },
  {
    feature: "CORS (browser use)",
    requestr: "Built-in server-side proxy",
    postman: "Web app needs Desktop Agent; desktop app unaffected",
    insomnia: "Desktop app — not subject to browser CORS",
    emphasis: null,
    sources: [
      "README.md (Requestr — /api/proxy server-side CORS bypass)",
      "https://learning.postman.com/docs/getting-started/basics/about-postman-agent/",
      "https://developer.konghq.com/insomnia/allowlist/",
    ],
  },
  {
    feature: "Supported protocols",
    requestr: "HTTP, GraphQL, WebSocket, Socket.IO",
    postman: "HTTP, GraphQL, WebSocket, Socket.IO, gRPC, SOAP, MQTT",
    insomnia: "HTTP, GraphQL, gRPC, WebSocket, Socket.IO, SSE",
    emphasis: null,
    sources: [
      "https://learning.postman.com/docs/use/send-requests/protocols/protocols",
      "https://www.postman.com/product/rest-client/",
      "https://insomnia.rest/",
      "https://github.com/Kong/insomnia/blob/develop/README.md",
    ],
  },
  {
    feature: "Pricing model",
    requestr: "Free, open source",
    postman: "Free tier; Solo from $9/mo; Team from $19/user/mo",
    insomnia: "Essentials free; Pro $12/user/mo; Enterprise $45/user/mo",
    emphasis: null,
    sources: [
      "https://www.postman.com/pricing/",
      "https://insomnia.rest/pricing/",
    ],
  },
  {
    feature: "Real-time support",
    requestr: "WebSocket + Socket.IO (browser-native)",
    postman: "WebSocket + Socket.IO",
    insomnia: "WebSocket + Socket.IO + SSE",
    emphasis: null,
    sources: [
      "https://learning.postman.com/docs/use/send-requests/protocols/protocols",
      "https://insomnia.rest/changelog",
      "https://insomnia.rest/",
    ],
  },
];

/** Count rows where a column is emphasized — guards against strawman tables in tests */
export function countEmphasis(column: NonNullable<ComparisonEmphasis>): number {
  return COMPARISON_ROWS.filter((row) => row.emphasis === column).length;
}
