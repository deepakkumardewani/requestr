export type ComparisonEmphasis = "requestr" | "postman" | "insomnia" | null;

/** A competitor claim; every one must cite an official https source (FR-31) */
export interface CompetitorCell {
  text: string;
  source: string;
  /** Plan tier the claim applies to, stated where free and paid differ */
  tier?: string;
}

/** A Requestr claim; `codeRef` is a repo-relative path that proves it */
export interface RequestrCell {
  text: string;
  codeRef: string;
}

export interface ComparisonRow {
  feature: string;
  requestr: RequestrCell;
  postman: CompetitorCell;
  insomnia: CompetitorCell;
  /** Which column gets subtle highlight — null means neutral row */
  emphasis: ComparisonEmphasis;
}

/** Date the competitor claims were last checked against the sources */
export const COMPARISON_CHECKED_ON = "2026-11-07";

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Install required",
    requestr: {
      text: "None — open a browser tab",
      codeRef: "src/app/page.tsx",
    },
    postman: {
      text: "Desktop app or web app",
      source:
        "https://learning.postman.com/docs/getting-started/installation/installation-and-updates",
    },
    insomnia: {
      text: "Desktop app download",
      source: "https://insomnia.rest/download",
    },
    emphasis: "requestr",
  },
  {
    feature: "Account required",
    requestr: {
      text: "No",
      codeRef: "src/lib/anonUser.ts",
    },
    postman: {
      text: "Optional — signed-out use gets the lightweight client; sync and collections need an account",
      source:
        "https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman",
      tier: "Free account unlocks sync",
    },
    insomnia: {
      text: "Optional — Scratch Pad is local-only with no login; cloud sync uses an account",
      source: "https://insomnia.rest/",
      tier: "Free (Scratch Pad)",
    },
    emphasis: "requestr",
  },
  {
    feature: "Data location",
    requestr: {
      text: "Stored in your browser only",
      codeRef: "src/lib/idb.ts",
    },
    postman: {
      text: "Local in the lightweight client; cloud sync with an account",
      source:
        "https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman",
    },
    insomnia: {
      text: "Local by default; Git Sync built in",
      source:
        "https://konghq.com/blog/engineering/why-kong-insomnia-is-developers-preferred-api-client",
    },
    emphasis: "requestr",
  },
  {
    feature: "Supported protocols",
    requestr: {
      text: "HTTP, GraphQL, WebSocket, Socket.IO",
      codeRef: "src/lib/requestRunner.ts",
    },
    postman: {
      text: "HTTP, GraphQL, gRPC, MQTT, SOAP, WebSocket, Socket.IO, MCP, AI requests",
      source:
        "https://learning.postman.com/docs/use/send-requests/protocols/protocols",
      tier: "All plans",
    },
    insomnia: {
      text: "REST, GraphQL, gRPC, SOAP, WebSocket, Socket.IO, SSE",
      source: "https://insomnia.rest/pricing/",
      tier: "All plans",
    },
    emphasis: null,
  },
  {
    feature: "Pricing model",
    requestr: {
      text: "Free, open source (MIT)",
      codeRef: "LICENSE",
    },
    postman: {
      text: "Free plan; Solo $9/mo; Team $19/user/mo (billed annually)",
      source: "https://www.postman.com/pricing/",
    },
    insomnia: {
      text: "Essentials free; Pro from $12/user/mo; Enterprise from $45/user/mo",
      source: "https://insomnia.rest/pricing/",
    },
    emphasis: null,
  },
  {
    feature: "Real-time support",
    requestr: {
      text: "WebSocket + Socket.IO (browser-native)",
      codeRef: "src/stores/useConnectionStore.ts",
    },
    postman: {
      text: "WebSocket + Socket.IO",
      source:
        "https://learning.postman.com/docs/use/send-requests/protocols/protocols",
    },
    insomnia: {
      text: "WebSocket + Socket.IO + SSE",
      source: "https://insomnia.rest/pricing/",
    },
    emphasis: null,
  },
];

/** Count rows where a column is emphasized — guards against strawman tables in tests */
export function countEmphasis(column: NonNullable<ComparisonEmphasis>): number {
  return COMPARISON_ROWS.filter((row) => row.emphasis === column).length;
}
