export interface Feature {
  id: string;
  title: string;
  description: string;
  /** Shown on landing page hero section */
  hero?: boolean;
  category?: string;
}

export const FEATURES: Feature[] = [
  // ── Hero differentiators (landing page) ──────────────────────────────────
  {
    id: "transform-playground",
    title: "Transform Playground",
    description:
      "Filter and reshape JSON with JSONPath or JavaScript. Live output, AI expression suggest, and a dedicated workspace.",
    hero: true,
    category: "JSON Tools",
  },
  {
    id: "method-theme",
    title: "Method-driven theming",
    description:
      "Every HTTP method has its own color. GET is emerald, POST is blue, DELETE is red — your API is always scannable.",
    hero: true,
    category: "Appearance",
  },
  {
    id: "json-compare",
    title: "JSON Compare",
    description:
      "Side-by-side JSON diff with change-only tree view. Seed from any response and spot regressions instantly.",
    hero: true,
    category: "JSON Tools",
  },
  {
    id: "json-visualize",
    title: "JSON Visualize",
    description:
      "Interactive node graph from JSON, YAML, or CSV. Zoom, search, and rotate layouts to explore complex payloads.",
    hero: true,
    category: "JSON Tools",
  },
  {
    id: "share-link",
    title: "Shareable request links",
    description:
      "Generate a link that pre-loads method, URL, headers, and body. No account, no export — just paste and send.",
    hero: true,
    category: "Collaboration",
  },
  {
    id: "appearance-theme",
    title: "Dark, light & accent themes",
    description:
      "System-aware dark/light mode plus custom accent colors. Persistent across sessions with zero flicker.",
    hero: true,
    category: "Appearance",
  },

  // ── Workspace ────────────────────────────────────────────────────────────
  {
    id: "multi-tab-workspace",
    title: "Multi-tab workspace",
    description:
      "Keep multiple requests open side-by-side. Switch between GET, POST, and DELETE without losing context.",
    category: "Workspace",
  },
  {
    id: "http-request-builder",
    title: "HTTP request builder",
    description:
      "Full REST client with params, headers, auth, and body editors — everything in one focused workspace.",
    category: "Workspace",
  },
  {
    id: "command-palette",
    title: "Command palette",
    description:
      "⌘K to search requests, history, collections, and actions. Navigate the app without touching the mouse.",
    category: "Workspace",
  },

  // ── Collections & import ─────────────────────────────────────────────────
  {
    id: "collections",
    title: "Collections",
    description:
      "Organize requests into folders. Drag, drop, reorder, duplicate, and export as Postman v2.1.",
    category: "Organization",
  },
  {
    id: "environment-variables",
    title: "Environment variables",
    description:
      "Use {{BASE_URL}} and {{API_KEY}} across all requests. Switch between dev, staging, and prod in one click.",
    category: "Organization",
  },
  {
    id: "import-formats",
    title: "Import anything",
    description:
      "Postman v2.1, Insomnia, OpenAPI 3.x, Swagger 2.0, and cURL — drop a file or paste and go.",
    category: "Organization",
  },
  {
    id: "api-hub",
    title: "API Hub",
    description:
      "Pre-built provider collections and environments. Import GitHub, OpenAI, Stripe, and more in one click.",
    category: "Organization",
  },

  // ── Response & debugging ─────────────────────────────────────────────────
  {
    id: "response-viewer",
    title: "Response viewer",
    description:
      "Pretty JSON, raw mode, headers, HTML preview, and cookies — all in one panel with color-coded status.",
    category: "Response",
  },
  {
    id: "response-toolbar",
    title: "Response actions",
    description:
      "Summarize, compare, transform, visualize, copy, and download — every response tool one click away.",
    category: "Response",
  },
  {
    id: "code-generation",
    title: "Code generation",
    description:
      "Live snippets in cURL, fetch, axios, Python, Go, Ruby, Java, and more. Copy-ready with one click.",
    category: "Response",
  },
  {
    id: "timing-waterfall",
    title: "Request timing waterfall",
    description:
      "DNS → TCP → TLS → TTFB → Download breakdown per request. Spot slow hops at a glance.",
    category: "Response",
  },
  {
    id: "error-explainer",
    title: "Why did this fail?",
    description:
      "Plain-English diagnosis for 4xx/5xx errors with actionable fixes and AI deep-dive when you need more.",
    category: "Response",
  },
  {
    id: "assertions",
    title: "Response assertions",
    description:
      "Status, header, and JSONPath tests on responses and chains. Pass/fail badges keep smoke tests visible.",
    category: "Response",
  },

  // ── Protocols ────────────────────────────────────────────────────────────
  {
    id: "graphql",
    title: "GraphQL",
    description:
      "Dedicated query editor with variables and headers. Send GraphQL requests alongside your REST workflow.",
    category: "Protocols",
  },
  {
    id: "websocket",
    title: "WebSocket",
    description:
      "Connect, send messages, and inspect the live message log — all without leaving the workspace.",
    category: "Protocols",
  },
  {
    id: "curl-import-export",
    title: "cURL import & export",
    description:
      "Paste any curl command to populate fields instantly, or export any request as a copy-paste curl snippet.",
    category: "Protocols",
  },
  {
    id: "pre-post-scripts",
    title: "Pre/post-request scripts",
    description:
      "JavaScript snippets with env.set() for chaining tokens. Syntax check and AI script writer built in.",
    category: "Protocols",
  },

  // ── Chains ───────────────────────────────────────────────────────────────
  {
    id: "request-chains",
    title: "Visual request chains",
    description:
      "Canvas workflow with API nodes, conditions, delays, and display nodes. Run entire flows sequentially.",
    category: "Chains",
  },
  {
    id: "chain-variable-passing",
    title: "Zero-code token passing",
    description:
      "Draw arrows between nodes. JSONPath maps a response field into the next request's URL, header, or body.",
    category: "Chains",
  },

  // ── History & health ─────────────────────────────────────────────────────
  {
    id: "request-history",
    title: "Request history",
    description:
      "Last 200 requests auto-saved and searchable by URL or method. Reopen any call in a new tab instantly.",
    category: "History",
  },
  {
    id: "health-monitor",
    title: "Request health monitor",
    description:
      "Per-endpoint success rate and p50 latency in your collection tree. Spot flaky APIs before they break prod.",
    category: "History",
  },

  // ── Platform ─────────────────────────────────────────────────────────────
  {
    id: "zero-cors",
    title: "Zero CORS headaches",
    description:
      "All outbound requests route through a server-side proxy. Test any API from the browser without extensions.",
    category: "Platform",
  },
  {
    id: "local-privacy",
    title: "100% local data",
    description:
      "IndexedDB only — no account, no cloud sync. Your requests and secrets never leave your device.",
    category: "Platform",
  },
];

export const HERO_FEATURES = FEATURES.filter((f) => f.hero);
