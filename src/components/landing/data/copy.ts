/**
 * Copy for the landing page. Product claims here mirror the in-app strings,
 * the app's own dialogs and the recorded clips, so a claim is only ever
 * written down once.
 */

export const HERO_EYEBROW = "Relay, the agent built into Requestr";
export const HERO_HEADLINE_LEAD = "Open a tab.";
export const HERO_HEADLINE_TAIL = "Tell the agent what you need.";
export const HERO_SUBLINE =
  "Requestr is an API client that runs in your browser, with no account and nothing to install. Relay is built into it and can do whatever you can do by hand: build requests, chain them, run them and write the tests.";
export const HERO_FACTS = [
  "no sign-up",
  "no install",
  "runs in the browser",
  "open source",
] as const;

export interface BasicFact {
  id: string;
  /** Mono label above the title, written like a shell answer. */
  tag: string;
  /** CSS colour for the tag, taken from the app's method palette. */
  color: string;
  title: string;
  body: string;
}

export const BASICS_EYEBROW = "Before you ask";
export const BASICS_HEADLINE = "Nothing between you and the first request.";
export const BASIC_FACTS: readonly BasicFact[] = [
  {
    id: "no-signup",
    tag: "account: none",
    color: "var(--method-get)",
    title: "No sign-up.",
    body: "There is no sign-up form. Open /app and start working. Relay works without an account too, and there is no API key to bring.",
  },
  {
    id: "no-install",
    tag: "install: none",
    color: "var(--method-post)",
    title: "No install.",
    body: "It is a web page. No desktop download and no CORS extension: requests go through a stateless proxy that only forwards them.",
  },
  {
    id: "in-browser",
    tag: "storage: this browser",
    color: "var(--method-patch)",
    title: "Runs in the browser.",
    body: "Collections, history and environments are stored in IndexedDB on this machine. Export one backup file when you want to move them.",
  },
];

export const CAPABILITIES_EYEBROW = "What Relay can do";
export const CAPABILITIES_LEDE =
  "Relay does not answer in a side chat and leave the clicking to you. It works in your workspace with the same actions you have, and lists every step as it goes.";

export const CONTROL_EYEBROW = "Approvals and undo";
export const CONTROL_HEADLINE =
  "It asks before it sends. You can undo the rest.";
export const CONTROL_LEDE =
  "You choose how often Relay stops to ask. Whatever it changes is listed in the conversation, with an Undo next to it.";

export interface ApprovalMode {
  id: string;
  label: string;
  description: string;
}

/** Same labels and descriptions as the approval mode picker in the app. */
export const APPROVAL_MODES: readonly ApprovalMode[] = [
  {
    id: "always-ask",
    label: "Always ask",
    description: "Every change waits for your Approve.",
  },
  {
    id: "review",
    label: "Review for me",
    description:
      "Relay asks before deleting, sending or running things, and before large bulk edits.",
  },
  {
    id: "skip",
    label: "Skip all approvals",
    description:
      "Relay changes things without asking. You can still Undo any change.",
  },
];

export const UNDO_TITLE = "Undo any change";
export const UNDO_BODY =
  "Every change Relay makes is listed in the conversation. Use Undo on a change to put it back.";

export const VISIBILITY_TITLE = "What Relay can see";
export const VISIBILITY_ITEMS = [
  "The names of your requests, collections, environments and variables, plus the request or chain you have open.",
  "Variable values, only when you turn on Share variable values.",
  "Secret values, never.",
] as const;
export const VISIBILITY_NOTE =
  "Conversations are stored on this device. Your messages and the context above are sent to the Relay service to produce a reply.";

export const TOOLBOX_EYEBROW = "The rest of the client";
export const TOOLBOX_HEADLINE = "Everything Relay uses, you can use by hand.";
export const TOOLBOX_LEDE =
  "Relay is one way in. The same tools are in the app for when you would rather do it yourself.";

export const FINAL_HEADLINE = "Open a tab. Ask Relay.";
export const FINAL_SUBLINE =
  "No account, nothing to install. Your requests stay in this browser.";
export const FINAL_FOOTNOTE = "Free, open source, no sign-up.";

export const CAPABILITIES_HEADLINE = "One text box. The whole client.";

export const AUTH_FLIP_HEADLINE = "It reads the request before it guesses.";
/** Mirrors the hero's "Explain an error" session, step for step. */
export const AUTH_FLIP_LEDE =
  "Relay reads the request, its last response and the environment, then says why: token has no value. It offers to chain Login first, so the next run goes out authorized.";
export const CAPABILITIES_PROMPT_LABEL = "Try asking";
export const CAPABILITIES_PICKER_LABEL = "What Relay can do, by area";

export const APPROVAL_PICKER_TITLE = "Approval mode";
export const APPROVAL_PICKER_HINT =
  "Pick a mode to see what Relay would stop for.";
export const APPROVAL_OUTCOME_LABELS = {
  asks: "Waits for your Approve",
  runs: "Goes ahead",
} as const;
/** Same badge wording as the mode picker in the app. */
export const APPROVAL_MODE_BADGES: Readonly<Record<string, string>> = {
  review: "Recommended",
  skip: "Use with caution",
};

export const COMMAND_PALETTE_HEADLINE = "Do anything from one keystroke.";
export const COMMAND_PALETTE_LEDE =
  "Press the shortcut and type a few letters. Saved requests, recent history and the app's actions are all in one list, so you can get around without reaching for the mouse.";
export const COMMAND_PALETTE_KEYS = {
  mac: ["⌘", "K"],
  other: ["Ctrl", "K"],
} as const;
export const COMMAND_PALETTE_KEYS_NOTE = "on macOS, Ctrl K everywhere else";
export const COMMAND_PALETTE_POINTS = [
  {
    id: "requests",
    title: "Jump to a request",
    body: "Type part of its name and press Enter. It opens in a tab.",
  },
  {
    id: "actions",
    title: "Run an action",
    body: "New Request, Import Collection, Manage Environments, Open Settings, Transform Playground and Compare JSON.",
  },
  {
    id: "history",
    title: "Reopen something recent",
    body: "Your latest history entries are in the same list.",
  },
] as const;
export const COMMAND_PALETTE_LINK_LABEL = "More about the command palette";
export const COMMAND_PALETTE_MEDIA = {
  src: "/media/command-palette/command-palette-loop",
  poster: "/media/command-palette/command-palette-poster.webp",
  width: 2304,
  height: 1440,
  alt: "Screen recording of the command palette: typing “login” opens the Login request, “new” creates a request, and “trans” opens the Transform Playground, all from the keyboard",
} as const;

export interface DataStep {
  id: string;
  /** Short name on the step button. */
  label: string;
  title: string;
  body: string;
  screenshot: { src: string; alt: string };
}

export const DATA_STEPS: readonly DataStep[] = [
  {
    id: "import",
    label: "Import",
    title: "Drop a file or paste cURL.",
    body: "Drop a Postman, Insomnia, OpenAPI or Swagger file, or paste a cURL command. Scan lists what it found, and each item opens as a request ready to send.",
    screenshot: {
      src: "/screens/import-dialog-dark.webp",
      alt: "Import dialog with File and cURL tabs, a drop zone for Postman, Insomnia, OpenAPI or Swagger files and a Scan button",
    },
  },
  {
    id: "export",
    label: "Back up",
    title: "Save everything to one file.",
    body: "Export everything or choose what to include. Secret values are left blank unless you switch them on.",
    screenshot: {
      src: "/screens/backup-export-dark.webp",
      alt: "Export backup dialog with Everything and Choose what to include options, an Include secret values switch and an estimated size",
    },
  },
  {
    id: "restore",
    label: "Restore",
    title: "See what is in a backup first.",
    body: "The dialog lists what the file contains. Merge adds what is missing and keeps the rest. Replace swaps out only the sections that are in the file.",
    screenshot: {
      src: "/screens/backup-restore-dark.webp",
      alt: "Import backup dialog listing what is in the backup, with Merge and Replace options",
    },
  },
];
export const DATA_STEPS_LABEL = "Import, back up and restore";
export const DATA_FORMATS_LABEL = "Import formats";

export const TOOLBOX_PREVIEW_LABEL = "Preview";
