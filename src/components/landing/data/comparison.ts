import { SPEED_PROOF } from "./speedProof";

export type ComparisonEmphasis = "requestr" | "postman" | "insomnia" | null;

export type ComparisonGroupId =
  | "getting-started"
  | "capabilities"
  | "cost-data";

/** Hostnames a competitor `source` / `extraSources` URL may point at (AC-51) */
export const COMPETITOR_SOURCE_HOSTS = [
  "postman.com",
  "www.postman.com",
  "learning.postman.com",
  "insomnia.rest",
  "docs.insomnia.rest",
  "konghq.com",
  "github.com",
] as const;

/** `github.com` links are only allowed under the Kong organisation */
export const GITHUB_SOURCE_PATH_PREFIX = "/Kong/";

/** A competitor claim; every one must cite an official https source (FR-31) */
export interface CompetitorCell {
  text: string;
  source: string;
  /** Secondary proofs kept for audits; never rendered */
  extraSources?: string[];
  /** Plan tier the claim applies to, stated where free and paid differ */
  tier?: string;
}

/** A Requestr claim; `codeRef` is a repo-relative path that proves it */
export interface RequestrCell {
  text: string;
  codeRef: string;
  /** Further repo-relative proof paths; never rendered */
  codeRefs?: string[];
}

export interface ComparisonRow {
  feature: string;
  group: ComparisonGroupId;
  requestr: RequestrCell;
  postman: CompetitorCell;
  insomnia: CompetitorCell;
  /** Which column gets subtle highlight — null means neutral row */
  emphasis: ComparisonEmphasis;
}

/** Table sections in display order (FR-51) */
export const COMPARISON_GROUPS: ReadonlyArray<{
  id: ComparisonGroupId;
  title: string;
}> = [
  { id: "getting-started", title: "Getting started" },
  { id: "capabilities", title: "Capabilities" },
  { id: "cost-data", title: "Cost & data" },
];

/** Date the competitor claims were last checked against the sources */
export const COMPARISON_CHECKED_ON = "2026-11-07";

/** "2026-11-07" -> "Nov 2026"; UTC so the month never shifts with the viewer's timezone */
export function formatCheckedMonth(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const { ttfr } = SPEED_PROOF.stats;
const SIGNED_OUT_SOURCE =
  "https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman";
const POSTMAN_PRICING = "https://www.postman.com/pricing/";
const INSOMNIA_PRICING = "https://insomnia.rest/pricing/";
const POSTMAN_PROTOCOLS =
  "https://learning.postman.com/docs/use/send-requests/protocols/protocols";

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Install required",
    group: "getting-started",
    requestr: { text: "None, open a browser tab", codeRef: "src/app/page.tsx" },
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
    group: "getting-started",
    requestr: { text: "No", codeRef: "src/lib/anonUser.ts" },
    postman: {
      text: "Optional; signed out you get the lightweight client, sync needs an account",
      source: SIGNED_OUT_SOURCE,
      tier: "Free account unlocks sync",
    },
    insomnia: {
      text: "Optional; Scratch Pad is local-only with no login, cloud sync needs an account",
      source: "https://insomnia.rest/",
      tier: "Free (Scratch Pad)",
    },
    emphasis: "requestr",
  },
  {
    feature: "Time to first request",
    group: "getting-started",
    requestr: {
      text: `About ${ttfr.value} ${ttfr.unit} measured, no install or sign-up`,
      codeRef: "src/components/landing/data/speedProof.ts",
    },
    postman: {
      text: "Install or open the web app, sign in or go signed out, create a request, send",
      source: SIGNED_OUT_SOURCE,
    },
    insomnia: {
      text: "Download the app, open Scratch Pad (no login), create a request, send",
      source: "https://insomnia.rest/",
    },
    emphasis: "requestr",
  },
  {
    feature: "Protocols & real-time",
    group: "capabilities",
    requestr: {
      text: "HTTP, GraphQL, WebSocket, Socket.IO",
      codeRef: "src/lib/requestRunner.ts",
      codeRefs: ["src/stores/useConnectionStore.ts"],
    },
    postman: {
      text: "HTTP, GraphQL, gRPC, MQTT, SOAP, WebSocket, Socket.IO, MCP, AI requests",
      source: POSTMAN_PROTOCOLS,
      tier: "All plans",
    },
    insomnia: {
      text: "REST, GraphQL, gRPC, SOAP, WebSocket, Socket.IO, SSE",
      source: INSOMNIA_PRICING,
      tier: "All plans",
    },
    emphasis: null,
  },
  {
    feature: "Request chains / workflows",
    group: "capabilities",
    requestr: {
      text: "Visual chain runner with per-node assertions",
      codeRef: "src/lib/chainRunner.ts",
    },
    postman: {
      text: "Flows: a visual low-code editor, plus the Collection Runner",
      source:
        "https://learning.postman.com/docs/postman-flows/gs/flows-overview/",
      extraSources: [
        "https://learning.postman.com/docs/collections/running-collections/intro-to-collection-runs/",
      ],
      tier: "Free has limited flow runs",
    },
    insomnia: {
      text: "Collection Runner with unlimited runs",
      source: INSOMNIA_PRICING,
      extraSources: ["https://docs.insomnia.rest/insomnia/collection-runner"],
      tier: "All plans",
    },
    emphasis: "postman",
  },
  {
    feature: "AI assistant",
    group: "capabilities",
    requestr: {
      text: "Relay, a built-in chat assistant served by a server route",
      codeRef: "src/app/api/relay/chat/route.ts",
    },
    postman: {
      text: "Agent Mode builds requests, flows, mocks and tests, metered in AI credits",
      source: "https://learning.postman.com/docs/agent-mode/overview/",
      extraSources: [POSTMAN_PRICING],
      tier: "Free has 100 AI credits",
    },
    insomnia: {
      text: "Describes itself as AI-native, with MCP support",
      source: "https://insomnia.rest/",
      tier: "Plan split not stated",
    },
    emphasis: "postman",
  },
  {
    feature: "Import / export & code generation",
    group: "capabilities",
    requestr: {
      text: "Imports cURL, Postman, Insomnia, OpenAPI; exports Postman, HAR; 9 code languages",
      codeRef: "src/lib/postmanParser.ts",
      codeRefs: [
        "src/lib/insomniaParser.ts",
        "src/lib/curlParser.ts",
        "src/lib/openapiParser.ts",
        "src/lib/postmanExporter.ts",
        "src/lib/history/exportHar.ts",
        "src/lib/backup/exporter.ts",
        "src/lib/codeGenerators.ts",
      ],
    },
    postman: {
      text: "Imports files, cURL and URLs; exports JSON; code snippets in many languages",
      source:
        "https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/",
      extraSources: [
        "https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/",
        "https://learning.postman.com/docs/sending-requests/create-requests/generate-code-snippets/",
      ],
    },
    insomnia: {
      text: "Imports cURL, Postman, OpenAPI, HAR and WSDL; generates client code",
      source: "https://docs.insomnia.rest/insomnia/generate-code-snippet",
    },
    emphasis: null,
  },
  {
    feature: "Pricing model",
    group: "cost-data",
    requestr: { text: "Free, open source (MIT)", codeRef: "LICENSE" },
    postman: {
      text: "Free plan; Solo $9/mo; Team $19/user/mo (billed annually)",
      source: POSTMAN_PRICING,
    },
    insomnia: {
      text: "Essentials free; Pro from $12/user/mo; Enterprise from $45/user/mo",
      source: INSOMNIA_PRICING,
    },
    emphasis: null,
  },
  {
    feature: "Data location",
    group: "cost-data",
    requestr: {
      text: "Stored in your browser only",
      codeRef: "src/lib/idb.ts",
    },
    postman: {
      text: "Local in the lightweight client; cloud sync with an account",
      source: SIGNED_OUT_SOURCE,
    },
    insomnia: {
      text: "Local by default; Git Sync built in",
      source:
        "https://konghq.com/blog/engineering/why-kong-insomnia-is-developers-preferred-api-client",
    },
    emphasis: "requestr",
  },
  {
    feature: "Collaboration & teams",
    group: "cost-data",
    requestr: {
      text: "Single user and local; sharing is by request link",
      codeRef: "src/lib/shareLink.ts",
      codeRefs: ["src/app/api/share/[id]/route.ts"],
    },
    postman: {
      text: "Shared workspaces; Team adds basic role-based access",
      source:
        "https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview/",
      extraSources: [POSTMAN_PRICING],
      tier: "Free syncs; Team for roles",
    },
    insomnia: {
      text: "Git Sync free for 3 users; Pro adds unlimited users and RBAC",
      source: INSOMNIA_PRICING,
      tier: "Free up to 3 users",
    },
    emphasis: "postman",
  },
  {
    feature: "Offline use / open source",
    group: "cost-data",
    requestr: {
      text: "Open source (MIT); data stays in browser storage",
      codeRef: "LICENSE",
    },
    postman: {
      text: "Desktop Local View works offline; signed out you get the lightweight client",
      source: SIGNED_OUT_SOURCE,
    },
    insomnia: {
      text: "Scratch Pad is local-only with no login; Apache-2.0 open source",
      source: INSOMNIA_PRICING,
      extraSources: ["https://github.com/Kong/insomnia/blob/develop/LICENSE"],
    },
    emphasis: null,
  },
];

/** Count rows where a column is emphasized — guards against strawman tables in tests */
export function countEmphasis(column: NonNullable<ComparisonEmphasis>): number {
  return COMPARISON_ROWS.filter((row) => row.emphasis === column).length;
}
