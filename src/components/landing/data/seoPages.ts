/**
 * Single source for the SEO pages: route, metadata, copy, media and links.
 * Sitemap, hub, footer and page templates all read from here. Routes are
 * relative; absolute URLs are built from SITE_URL by the consumers.
 */

export interface SeoScreenshot {
  src: string;
  alt: string;
}

export interface SeoCta {
  href: string;
  label: string;
}

interface SeoPageBase {
  slug: string;
  route: string;
  /** <= 60 chars */
  title: string;
  /** 120-160 chars */
  description: string;
  h1: string;
  screenshot: SeoScreenshot;
  cta: SeoCta;
  /** Answer-first intro followed by supporting paragraphs. */
  body: readonly string[];
}

export interface FeaturePage extends SeoPageBase {
  route: `/features/${string}`;
  /** Slugs of other feature pages to link to. */
  related: readonly string[];
}

export interface ComparePage extends SeoPageBase {
  route: `/compare/${string}`;
  /** Feature slugs worth reading next. */
  related: readonly string[];
  /** Honest notes on where the other tool is stronger. */
  strongerNotes: readonly string[];
}

const OPEN_APP_CTA: SeoCta = { href: "/app", label: "Open Requestr" };

export const FEATURE_PAGES = [
  {
    slug: "relay",
    route: "/features/relay",
    title: "Relay: an AI that does your API work in the browser",
    description:
      "Relay is the AI built into Requestr. Ask it to send a request, read the response or fix an error, and watch it work in the app. No install, no account.",
    h1: "Relay, the AI built into your API client",
    screenshot: {
      src: "/media/relay/relay-poster.webp",
      alt: "Relay panel open beside a request, listing the steps the AI took",
    },
    related: ["request-chains", "collections-environments", "command-palette"],
    cta: OPEN_APP_CTA,
    body: [
      "Relay is an AI assistant inside Requestr that carries out API work for you. Describe what you want in plain words and it builds the request, sends it and reads the response.",
      "Every step shows up in the app as it happens, so you can see which request it sent and what came back. You stay in control of what runs.",
      "When a call fails, ask Relay why. It reads the status, headers and body, then suggests a fix you can review and apply.",
    ],
  },
  {
    slug: "request-chains",
    route: "/features/request-chains",
    title: "Request chains: pass one response into the next call",
    description:
      "Chain API requests in your browser. Take a value from one response, such as a token or an id, and use it in the next request without copying it by hand.",
    h1: "Request chains that pass values forward",
    screenshot: {
      src: "/screens/chains-light.webp",
      alt: "A request chain with a login step feeding a token into the next request",
    },
    related: ["relay", "collections-environments", "transform-playground"],
    cta: OPEN_APP_CTA,
    body: [
      "A request chain runs several requests in order and hands values from each response to the next one. Log in, grab the token, then call a protected endpoint in a single run.",
      "Pick the value you want from a response and name it. Later steps reference that name in the URL, headers or body.",
      "Each step shows its own status and timing, so you can see exactly where a chain stopped.",
    ],
  },
  {
    slug: "transform-playground",
    route: "/features/transform-playground",
    title: "Transform playground: reshape JSON with live output",
    description:
      "Filter and reshape JSON with JSONPath or JavaScript right in your browser. The output updates as you type, so you can shape a response before you use it.",
    h1: "Transform JSON with a live playground",
    screenshot: {
      src: "/screens/transform-light.webp",
      alt: "Transform playground with a JSONPath expression and the filtered output",
    },
    related: ["json-compare", "json-visualize", "request-chains"],
    cta: { href: "/transform", label: "Open the playground" },
    body: [
      "The transform playground lets you filter and reshape JSON with JSONPath or a few lines of JavaScript. Paste a payload, write an expression and see the result straight away.",
      "It is handy for pulling one field out of a large response or flattening a list before you pass it on.",
      "Everything runs in your browser, so the payload stays on your device.",
    ],
  },
  {
    slug: "json-compare",
    route: "/features/json-compare",
    title: "JSON compare: see exactly what changed between payloads",
    description:
      "Compare two JSON payloads side by side and see only what changed. Catch a broken API response before your tests do. Runs in your browser with no upload.",
    h1: "Compare two JSON payloads",
    screenshot: {
      src: "/screens/json-compare-light.webp",
      alt: "Two JSON payloads side by side with added and removed fields highlighted",
    },
    related: ["json-visualize", "transform-playground", "relay"],
    cta: { href: "/json-compare", label: "Compare JSON" },
    body: [
      "JSON compare shows the difference between two payloads: which fields were added, removed or changed. Paste both sides and the changes are highlighted.",
      "Use it to check a response against an earlier one, or to see what a new API version changed.",
      "Nothing is uploaded. The comparison happens in your browser.",
    ],
  },
  {
    slug: "json-visualize",
    route: "/features/json-visualize",
    title: "JSON visualizer: explore nested data as a tree or graph",
    description:
      "Turn a large JSON response into something you can read. Explore nested objects and arrays in your browser, collapse what you do not need, and spot the shape.",
    h1: "Visualize JSON as you read it",
    screenshot: {
      src: "/screens/json-visualize-light.webp",
      alt: "A nested JSON response shown as an expandable visual structure",
    },
    related: ["json-compare", "transform-playground", "relay"],
    cta: { href: "/json-visualize", label: "Visualize JSON" },
    body: [
      "The JSON visualizer draws a payload as a structure you can expand and collapse. Deeply nested objects and long arrays become easy to scan.",
      "It helps when you are learning an unfamiliar API and want to see its shape before writing code against it.",
      "The data stays on your device while you explore it.",
    ],
  },
  {
    slug: "import",
    route: "/features/import",
    title: "Import Postman, Insomnia, OpenAPI and cURL in one step",
    description:
      "Bring your existing API work into Requestr. Import Postman and Insomnia collections, OpenAPI specs or a cURL command and start sending requests straight away.",
    h1: "Import from Postman, Insomnia, OpenAPI and cURL",
    screenshot: {
      src: "/screens/import-light.webp",
      alt: "Import dialog listing Postman, Insomnia, OpenAPI and cURL as sources",
    },
    related: ["collections-environments", "backup-restore", "relay"],
    cta: { href: "/import", label: "Import a collection" },
    body: [
      "You do not have to start over. Requestr imports Postman and Insomnia collections, OpenAPI specs and pasted cURL commands.",
      "Imported requests land in collections you can organize, and environment variables come across with them.",
      "Parsing happens in your browser, so your files are not sent anywhere.",
    ],
  },
  {
    slug: "collections-environments",
    route: "/features/collections-environments",
    title: "Collections and environments for organized API testing",
    description:
      "Group requests into collections and switch between environments such as local, staging and production with one click. Variables fill in the right values.",
    h1: "Collections and environments",
    screenshot: {
      src: "/screens/collections-envs-light.webp",
      alt: "Sidebar with collections and an environment switcher showing variables",
    },
    related: ["import", "request-chains", "backup-restore"],
    cta: { href: "/environments", label: "Manage environments" },
    body: [
      "Collections keep related requests together in folders. Environments hold variables like a base URL or an API key, so one request works against local, staging or production.",
      "Switch the active environment and every request picks up the new values.",
      "Collections and environments are stored in your browser, with no account needed.",
    ],
  },
  {
    slug: "command-palette",
    route: "/features/command-palette",
    title: "Command palette: reach any request or action by keyboard",
    description:
      "Press one shortcut to jump to any request, collection, environment or action in Requestr. Stay on the keyboard and spend less time hunting through menus.",
    h1: "A command palette for everything in the app",
    screenshot: {
      src: "/screens/command-palette-light.webp",
      alt: "Command palette open with a search box and a list of matching requests and actions",
    },
    related: ["collections-environments", "relay", "request-chains"],
    cta: OPEN_APP_CTA,
    body: [
      "The command palette opens with a single shortcut and searches your requests, collections, environments and actions together.",
      "Type a few letters, press Enter and you are there. It is the fastest way to move around once you have many requests.",
      "Because it covers actions as well as items, you can do most things without touching the mouse.",
    ],
  },
  {
    slug: "backup-restore",
    route: "/features/backup-restore",
    title: "Backup and restore your API workspace to a file",
    description:
      "Export your collections, environments and history to one file and restore them on another browser or device. You choose what to include and what to replace.",
    h1: "Back up and restore your workspace",
    screenshot: {
      // Interim: the backup dialog capture arrives with T10.10; swap src and alt then.
      src: "/screens/collections-envs-light.webp",
      alt: "Sidebar with collections and an environment switcher, the data a backup file holds",
    },
    related: ["import", "collections-environments", "command-palette"],
    cta: OPEN_APP_CTA,
    body: [
      "Requestr keeps your data in the browser, so a backup file is how you move it or keep a safe copy. Export picks the sections you want and saves a single file.",
      "Restoring shows a preview of what is inside before anything changes, and asks before it replaces existing data.",
      "The file stays with you. Nothing is stored on a server.",
    ],
  },
] as const satisfies readonly FeaturePage[];

export const COMPARE_PAGES = [
  {
    slug: "postman",
    route: "/compare/postman",
    title: "Requestr vs Postman: an API client without the install",
    description:
      "How Requestr compares with Postman. Requestr runs in the browser with no install or account and has an AI built in. See where Postman is still stronger.",
    h1: "Requestr vs Postman",
    screenshot: {
      src: "/screens/relay-panel-light.webp",
      alt: "Requestr with the Relay AI panel open next to a request",
    },
    related: ["import", "relay", "collections-environments"],
    cta: OPEN_APP_CTA,
    body: [
      "Requestr and Postman both let you build, send and organize API requests. The main difference is where they run: Requestr opens in a browser tab with no install and no account.",
      "Requestr also has Relay, an AI built into the app. The comparison table lists each claim with its source.",
    ],
    strongerNotes: [
      "Postman has a larger ecosystem, team workspaces and mature collaboration tools.",
      "Postman offers a desktop app with deeper offline and automation support.",
    ],
  },
  {
    slug: "insomnia",
    route: "/compare/insomnia",
    title: "Requestr vs Insomnia: a browser-based API client",
    description:
      "How Requestr compares with Insomnia. Requestr runs in the browser with no install or account and has an AI built in. See where Insomnia is still stronger.",
    h1: "Requestr vs Insomnia",
    screenshot: {
      src: "/screens/relay-panel-light.webp",
      alt: "Requestr with the Relay AI panel open next to a request",
    },
    related: ["import", "relay", "collections-environments"],
    cta: OPEN_APP_CTA,
    body: [
      "Requestr and Insomnia both give you a focused client for REST requests. Requestr runs in a browser tab, so there is nothing to install and no account to create.",
      "Requestr also has Relay, an AI built into the app. The comparison table lists each claim with its source.",
    ],
    strongerNotes: [
      "Insomnia has a native desktop app and stronger support for protocols beyond REST.",
      "Insomnia offers sync and team features for shared projects.",
    ],
  },
] as const satisfies readonly ComparePage[];

export type FeatureSlug = (typeof FEATURE_PAGES)[number]["slug"];
export type CompareSlug = (typeof COMPARE_PAGES)[number]["slug"];

export function getFeaturePage(slug: string): FeaturePage | undefined {
  return FEATURE_PAGES.find((page) => page.slug === slug);
}

export function getComparePage(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((page) => page.slug === slug);
}

export const ALL_SEO_ROUTES: readonly string[] = [
  ...FEATURE_PAGES.map((page) => page.route),
  ...COMPARE_PAGES.map((page) => page.route),
];
