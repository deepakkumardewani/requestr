import type { RelayToolName } from "@/lib/relay/tools/schemas";
import {
  LANDING_CAPABILITIES,
  TOTAL_TOOL_COUNT,
} from "../../data/capabilities";
import {
  APPROVAL_MODES,
  COMMAND_PALETTE_POINTS,
  DATA_STEPS,
  UNDO_BODY,
  UNDO_TITLE,
  VISIBILITY_TITLE,
} from "../../data/copy";
import type { FeatureSlug } from "../../data/seoPages";

/**
 * Everything a feature page shows beyond its SEO copy (seoPages.ts). Claims
 * here are read off the app: its dialogs, i18n strings, the Relay tool
 * registry and the code each demo runs. Keyed by slug so a new feature page
 * without its details fails typecheck.
 */

export interface FeatureStep {
  title: string;
  body: string;
}

export interface FeatureCapability {
  id: string;
  /** Mono label above the title, written like a shell answer. */
  tag: string;
  /** CSS colour for the tag dot and the card's spotlight. */
  color: string;
  title: string;
  body: string;
}

export interface FeatureRelayUse {
  lede: string;
  /** Things a person would actually type into Relay for this feature. */
  prompts: readonly string[];
  /** Relay tools that do the work, named as in the tool registry. */
  tools: readonly RelayToolName[];
}

export interface FeatureHeroMedia {
  src: string;
  alt: string;
}

export interface FeatureDetail {
  /** Mono eyebrow above the h1. */
  eyebrow: string;
  /** Part of the page's h1 drawn with the accent gradient; must appear in it verbatim. */
  highlight: string;
  /** Accent for this page's demo halo and capability spotlights. */
  color: string;
  /**
   * Hero capture when the SEO screenshot will not do: it has no dark twin, or
   * the demo already shows it.
   */
  hero?: FeatureHeroMedia;
  demo: {
    title: string;
    lede: string;
    /** Says what the demo is, so a scripted one never passes for the app. */
    note: string;
  };
  steps: readonly FeatureStep[];
  capabilities: readonly FeatureCapability[];
  /** Omitted when Relay does nothing for the feature beyond opening its page. */
  relay?: FeatureRelayUse;
  closing: { headline: string; subline: string };
}

const COLOR = {
  get: "var(--method-get)",
  post: "var(--method-post)",
  put: "var(--method-put)",
  patch: "var(--method-patch)",
  del: "var(--method-delete)",
  options: "var(--method-options)",
} as const;

const SCRIPTED_NOTE =
  "A scripted example. In the app every value comes from your own requests.";
const LIVE_NOTE = "Runs in this page, on the same code the app uses.";
const RELAY_PROMPT_COUNT = 4;
const REVIEW_MODE = APPROVAL_MODES.find((mode) => mode.id === "review");

const RELAY_DETAIL: FeatureDetail = {
  eyebrow: "Relay, the agent built into Requestr",
  highlight: "built into your API client",
  color: COLOR.get,
  hero: {
    src: "/screens/relay-panel-dark.webp",
    alt: "Requestr with the Relay AI panel open next to a request",
  },
  demo: {
    title: "Watch it work through a task.",
    lede: "Pick a task. Each line is an action Relay takes in the app, the same ones you have, listed as it goes.",
    note: "A replay of real Relay runs, trimmed to fit.",
  },
  steps: [
    {
      title: "Ask in plain words",
      body: "Type what you need into the Relay panel. Mention a request with @, or pick an action with /.",
    },
    {
      title: "It works in your workspace",
      body: "Relay builds, edits and sends requests with the same actions you have, and lists each one in the conversation.",
    },
    {
      title: "You approve, and can undo",
      body: `In the recommended mode it stops before it deletes, sends or runs anything. ${UNDO_BODY}`,
    },
  ],
  capabilities: [
    {
      id: "modes",
      tag: "approvals: 3 modes",
      color: COLOR.get,
      title: "You choose when it asks",
      body: `${APPROVAL_MODES.map((mode) => mode.label).join(", ")}. ${REVIEW_MODE?.description ?? ""}`,
    },
    {
      id: "undo",
      tag: "undo: every change",
      color: COLOR.post,
      title: UNDO_TITLE,
      body: "Changes are listed in the conversation as they happen, each with an Undo next to it.",
    },
    {
      id: "visibility",
      tag: "secrets: never",
      color: COLOR.patch,
      title: VISIBILITY_TITLE,
      body: "The names of your requests, collections and environments. Variable values only when you turn on Share variable values. Secret values, never.",
    },
    {
      id: "tools",
      tag: `tools: ${TOTAL_TOOL_COUNT}`,
      color: COLOR.put,
      title: "The whole client, not a chat box",
      body: "Requests, chains, collections, environments, import, backup, settings and navigation are all things it can act on.",
    },
  ],
  relay: {
    lede: "Relay covers every area of the client. A few things to try once the panel is open.",
    prompts: LANDING_CAPABILITIES.slice(0, RELAY_PROMPT_COUNT).map(
      (capability) => capability.example,
    ),
    tools: [],
  },
  closing: {
    headline: "Open a tab. Ask Relay.",
    subline:
      "No account and no API key to bring. Your requests stay in this browser.",
  },
};

const CHAINS_DETAIL: FeatureDetail = {
  eyebrow: "Request chains",
  highlight: "pass values forward",
  color: COLOR.post,
  demo: {
    title: "Run a login flow.",
    lede: "Press Run. The login response hands its token to the next request, and each step reports its own status and time.",
    note: SCRIPTED_NOTE,
  },
  steps: [
    {
      title: "Put blocks on the canvas",
      body: "Add HTTP Request blocks, plus Condition, Delay, Loop or Evaluate blocks when the flow needs them.",
    },
    {
      title: "Draw an arrow, pick a value",
      body: "Connect two blocks, pick a field from the source response with JSONPath and give it a name.",
    },
    {
      title: "Use it downstream and run",
      body: "Reference the name as {{token}} in a later URL, header or body. Each step shows its status and timing.",
    },
  ],
  capabilities: [
    {
      id: "condition",
      tag: "block: Condition",
      color: COLOR.patch,
      title: "Branch on a value",
      body: "Send the run down one path or another based on an expression over upstream data.",
    },
    {
      id: "loop",
      tag: "block: Loop + Collect",
      color: COLOR.post,
      title: "Iterate over a list",
      body: "Loop over an array from an upstream response, then gather the results back into an array.",
    },
    {
      id: "validate",
      tag: "block: Validate",
      color: COLOR.get,
      title: "Check the shape",
      body: "Validate a response against a JSON Schema before the next step uses it.",
    },
    {
      id: "subchain",
      tag: "block: Sub-chain",
      color: COLOR.put,
      title: "Reuse a flow",
      body: "Run another chain as one step and bind its inputs, so a login flow is written once.",
    },
  ],
  relay: {
    lede: "Relay can build a chain from a description and run it, then read the run to tell you where it stopped.",
    prompts: [
      "Create a chain that logs in and then fetches my orders",
      "Run the checkout chain and tell me which step failed",
    ],
    tools: [
      "create_chain",
      "add_chain_node",
      "connect_chain_nodes",
      "run_chain",
      "get_chain_run",
    ],
  },
  closing: {
    headline: "Stop copying tokens by hand.",
    subline:
      "Build the flow once and run it whenever you need it, in the browser.",
  },
};

const TRANSFORM_DETAIL: FeatureDetail = {
  eyebrow: "Transform playground",
  highlight: "live playground",
  color: COLOR.patch,
  demo: {
    title: "Try an expression.",
    lede: "Pick an example or write your own JSONPath. The output is computed as you type, with the JSONPath engine the playground uses.",
    note: LIVE_NOTE,
  },
  steps: [
    {
      title: "Bring a payload",
      body: "Paste JSON into the playground, or open a response in it from the response panel.",
    },
    {
      title: "Pick JSONPath or JavaScript",
      body: "JSONPath for picking fields out, a few lines of JavaScript when the data needs reshaping.",
    },
    {
      title: "Read the output as you type",
      body: "The result updates straight away, so you can check an expression before you use it anywhere.",
    },
  ],
  capabilities: [
    {
      id: "modes",
      tag: "mode: JSONPath | JavaScript",
      color: COLOR.patch,
      title: "Two ways to shape data",
      body: "Filter with a JSONPath expression, or return anything you like from a JavaScript snippet.",
    },
    {
      id: "suggestions",
      tag: "suggest: from your data",
      color: COLOR.get,
      title: "Path suggestions",
      body: "The editor suggests JSONPath expressions built from the structure of the payload you pasted.",
    },
    {
      id: "ai",
      tag: "ask: in plain words",
      color: COLOR.post,
      title: "Describe it instead",
      body: "Say what you want out of the payload and AI writes the JSONPath expression for you to check.",
    },
    {
      id: "local",
      tag: "upload: none",
      color: COLOR.put,
      title: "Stays on your device",
      body: "Expressions run in your browser, so the payload is never sent anywhere.",
    },
  ],
  closing: {
    headline: "Shape the response before you use it.",
    subline: "Paste a payload and start typing. Nothing to install.",
  },
};

const COMPARE_DETAIL: FeatureDetail = {
  eyebrow: "JSON compare",
  highlight: "two JSON payloads",
  color: COLOR.del,
  demo: {
    title: "See what changed.",
    lede: "Two versions of the same response, diffed with the comparison code the app runs. Turn on Changes only to hide what stayed the same.",
    note: LIVE_NOTE,
  },
  steps: [
    {
      title: "Paste both sides",
      body: "Put the old payload on the left and the new one on the right. Swap them with one click.",
    },
    {
      title: "Read the diff tree",
      body: "Added, removed and changed keys are marked, and branches with no changes start collapsed.",
    },
    {
      title: "Count what moved",
      body: "A summary says how many keys were added, removed and changed, so a regression is easy to spot.",
    },
  ],
  capabilities: [
    {
      id: "kinds",
      tag: "+ added  - removed  ~ changed",
      color: COLOR.get,
      title: "Every change marked",
      body: "Each key is tagged by what happened to it, with the old and new value side by side when it changed.",
    },
    {
      id: "changes-only",
      tag: "filter: changes only",
      color: COLOR.patch,
      title: "Hide the noise",
      body: "Show only the branches that changed, however deep they sit in the payload.",
    },
    {
      id: "paths",
      tag: "path: items[0].name",
      color: COLOR.post,
      title: "Know where it is",
      body: "Every change carries its full path, so you can find it again in the response.",
    },
    {
      id: "local",
      tag: "upload: none",
      color: COLOR.put,
      title: "Compared in the browser",
      body: "Neither payload leaves your device.",
    },
  ],
  relay: {
    lede: "Relay can diff two responses it has stored for a request and explain what changed between them.",
    prompts: [
      "Compare the last two responses of Get user and tell me what changed",
    ],
    tools: ["diff_responses"],
  },
  closing: {
    headline: "Catch the change before your tests do.",
    subline: "Paste two payloads and read the diff. Nothing is uploaded.",
  },
};

const VISUALIZE_DETAIL: FeatureDetail = {
  eyebrow: "JSON visualizer",
  highlight: "as you read it",
  color: COLOR.options,
  demo: {
    title: "Open only what you need.",
    lede: "A nested response with each branch collapsed to its size. Expand a branch to read it; the app draws the same data as a graph you can pan and zoom.",
    note: "A simplified tree view. The app renders an interactive node graph.",
  },
  steps: [
    {
      title: "Paste JSON, YAML or CSV",
      body: "Drop in a payload in any of the three formats and it is parsed in your browser.",
    },
    {
      title: "Explore the graph",
      body: "Objects and arrays become nodes. Collapse the branches you do not need and follow the ones you do.",
    },
    {
      title: "Search for a field",
      body: "Search highlights matching nodes and steps through each match in turn.",
    },
  ],
  capabilities: [
    {
      id: "formats",
      tag: "format: json | yaml | csv",
      color: COLOR.options,
      title: "Three formats",
      body: "The same view works for a JSON response, a YAML file or a CSV export.",
    },
    {
      id: "collapse",
      tag: "collapse: per branch",
      color: COLOR.get,
      title: "Fold what you have read",
      body: "Collapse any object or array, so a long list does not push everything else off screen.",
    },
    {
      id: "layout",
      tag: "layout: any direction",
      color: COLOR.post,
      title: "Turn the graph",
      body: "Lay the graph out left to right or top to bottom, whichever suits the shape of the data.",
    },
    {
      id: "local",
      tag: "upload: none",
      color: COLOR.put,
      title: "Stays on your device",
      body: "The data is parsed and drawn in your browser.",
    },
  ],
  closing: {
    headline: "See the shape before you write the code.",
    subline: "Paste a payload and explore it. Nothing to install.",
  },
};

const IMPORT_STEP = DATA_STEPS.find((step) => step.id === "import");

const IMPORT_DETAIL: FeatureDetail = {
  eyebrow: "Import",
  highlight: "OpenAPI and cURL",
  color: COLOR.get,
  demo: {
    title: "Paste a cURL command.",
    lede: "Pick a command. It is parsed with the app's own cURL importer into the request you would get.",
    note: LIVE_NOTE,
  },
  steps: [
    {
      title: IMPORT_STEP?.title ?? "Drop a file or paste cURL.",
      body: "Drop a Postman, Insomnia, OpenAPI or Swagger file, or paste a cURL command.",
    },
    {
      title: "Scan before you save",
      body: "Scan lists what it found, so you see the requests before anything is added.",
    },
    {
      title: "Send straight away",
      body: "Each item opens as a request ready to send, and environment variables come across with it.",
    },
  ],
  capabilities: [
    {
      id: "collections",
      tag: "format: Postman v2.1 | Insomnia",
      color: COLOR.get,
      title: "Collections",
      body: "Bring folders and requests over from the client you use today.",
    },
    {
      id: "specs",
      tag: "format: OpenAPI 3 | Swagger 2",
      color: COLOR.post,
      title: "API specs",
      body: "Turn a spec into one request per operation.",
    },
    {
      id: "curl",
      tag: "format: cURL",
      color: COLOR.patch,
      title: "Pasted commands",
      body: "Method, URL, headers, body and auth are read from the command.",
    },
    {
      id: "local",
      tag: "upload: none",
      color: COLOR.put,
      title: "Parsed in the browser",
      body: "Your files are read on this device and are not sent anywhere.",
    },
  ],
  relay: {
    lede: "Paste a cURL command into Relay, or ask for a collection from the API hub, and it does the import for you.",
    prompts: ["Import this cURL command and save it to Shop"],
    tools: ["import_curl", "import_api_catalog"],
  },
  closing: {
    headline: "Bring what you have.",
    subline: "Drop a collection or paste a command. No account needed.",
  },
};

const COLLECTIONS_DETAIL: FeatureDetail = {
  eyebrow: "Collections and environments",
  highlight: "environments",
  color: COLOR.post,
  demo: {
    title: "Switch the environment.",
    lede: "One saved request, three environments. Pick one and watch the variables fill in.",
    note: "Variables are filled in with the same replacement the app runs.",
  },
  steps: [
    {
      title: "Group requests",
      body: "Keep related requests together in collections and folders. Drag to reorder or move them.",
    },
    {
      title: "Write variables once",
      body: "Put a base URL or an API key in an environment and use it as {{VARIABLE_NAME}} in any request.",
    },
    {
      title: "Switch with one click",
      body: "Change the active environment and every request picks up its values.",
    },
  ],
  capabilities: [
    {
      id: "folders",
      tag: "organize: folders",
      color: COLOR.post,
      title: "Collections and folders",
      body: "Nest folders, duplicate requests and move them between collections.",
    },
    {
      id: "secrets",
      tag: "variable: secret",
      color: COLOR.del,
      title: "Secret values stay hidden",
      body: "Mark a variable as secret and its value is masked until you choose to show it.",
    },
    {
      id: "export",
      tag: "export: Postman v2.1",
      color: COLOR.get,
      title: "Take it with you",
      body: "Export a collection in Postman v2.1 format whenever you need to share it.",
    },
    {
      id: "local",
      tag: "storage: this browser",
      color: COLOR.put,
      title: "No account",
      body: "Collections and environments are stored in your browser.",
    },
  ],
  relay: {
    lede: "Relay can create environments, set their variables and switch the active one, and it reads names, not secret values.",
    prompts: [
      "Create a staging environment with baseUrl set to https://staging.example.com",
    ],
    tools: [
      "create_environment",
      "set_env_variables",
      "set_active_environment",
    ],
  },
  closing: {
    headline: "Write the request once.",
    subline: "Point it at local, staging or production with one click.",
  },
};

const COMMAND_PALETTE_DETAIL: FeatureDetail = {
  eyebrow: "Command palette",
  highlight: "everything in the app",
  color: COLOR.patch,
  demo: {
    title: "Do anything from one keystroke.",
    lede: "A screen recording of the palette: typing to open a request, create a new one and open the Transform Playground.",
    note: "Recorded in the app.",
  },
  steps: [
    {
      title: "Press ⌘K",
      body: "Ctrl K everywhere other than macOS. The palette opens wherever you are in the app.",
    },
    {
      title: "Type a few letters",
      body: "Requests, recent history and the app's actions are filtered together in one list.",
    },
    {
      title: "Press Enter",
      body: "The request opens in a tab, or the action runs. Your hands never leave the keyboard.",
    },
  ],
  capabilities: COMMAND_PALETTE_POINTS.map((point, index) => ({
    id: point.id,
    tag: ["open: request", "run: action", "reopen: history"][index] ?? point.id,
    color: [COLOR.get, COLOR.post, COLOR.patch][index] ?? COLOR.get,
    title: point.title,
    body: point.body,
  })),
  closing: {
    headline: "Keep your hands on the keyboard.",
    subline: "Open the app and press ⌘K.",
  },
};

const BACKUP_DETAIL: FeatureDetail = {
  eyebrow: "Backup and restore",
  highlight: "your workspace",
  color: COLOR.put,
  // The demo steps through the export and restore dialogs, so the hero shows what a backup carries.
  hero: {
    src: "/screens/collections-envs-dark.webp",
    alt: "Collections and an environment with its variables, the workspace a backup saves to one file",
  },
  demo: {
    title: "One file out, one file back in.",
    lede: "Step through the two dialogs. The captures are from the app.",
    note: "Screens captured from the app.",
  },
  steps: [
    {
      title: "Choose what to include",
      body: "Export everything, or pick the collections, environments and history you want.",
    },
    {
      title: "Save one file",
      body: "The export is a single file. Secret values are left blank unless you switch them on.",
    },
    {
      title: "Restore with a preview",
      body: "The restore dialog lists what is in the file. Merge adds what is missing; Replace swaps only the sections in the file.",
    },
  ],
  capabilities: [
    {
      id: "secrets",
      tag: "secrets: off by default",
      color: COLOR.del,
      title: "Secrets stay out",
      body: "Secret values are left blank in the file unless you turn Include secret values on.",
    },
    {
      id: "merge",
      tag: "restore: merge | replace",
      color: COLOR.get,
      title: "Merge or Replace",
      body: "Merge keeps what you have and adds what is missing. Replace swaps only what the file contains.",
    },
    {
      id: "size",
      tag: "export: estimated size",
      color: COLOR.post,
      title: "Know what you are saving",
      body: "The export dialog shows an estimated size before you save.",
    },
    {
      id: "local",
      tag: "server: none",
      color: COLOR.put,
      title: "The file stays with you",
      body: "Nothing is stored on a server. The backup is yours to keep or move.",
    },
  ],
  relay: {
    lede: "Ask Relay to back up or restore. It always asks first.",
    prompts: ["Back up my collections and environments"],
    tools: ["export_backup", "import_backup"],
  },
  closing: {
    headline: "Keep a copy of your work.",
    subline:
      "Your data lives in this browser. A backup file is how you move it.",
  },
};

export const FEATURE_DETAILS = {
  relay: RELAY_DETAIL,
  "request-chains": CHAINS_DETAIL,
  "transform-playground": TRANSFORM_DETAIL,
  "json-compare": COMPARE_DETAIL,
  "json-visualize": VISUALIZE_DETAIL,
  import: IMPORT_DETAIL,
  "collections-environments": COLLECTIONS_DETAIL,
  "command-palette": COMMAND_PALETTE_DETAIL,
  "backup-restore": BACKUP_DETAIL,
} as const satisfies Record<FeatureSlug, FeatureDetail>;

function isFeatureSlug(slug: string): slug is FeatureSlug {
  return Object.hasOwn(FEATURE_DETAILS, slug);
}

export function getFeatureDetail(slug: string): FeatureDetail | undefined {
  return isFeatureSlug(slug) ? FEATURE_DETAILS[slug] : undefined;
}
