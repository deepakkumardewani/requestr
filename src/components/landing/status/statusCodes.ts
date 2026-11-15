import { SECTION_IDS } from "../data/links";

/**
 * Reason phrases exactly as RFC 9110 (and RFC 2518 / 4918 / 6585 for the
 * WebDAV and extra codes) spell them. Entries below name only a code, so a
 * phrase can never be mistyped in two places.
 */
export const STATUS_PHRASES = {
  101: "Switching Protocols",
  200: "OK",
  201: "Created",
  203: "Non-Authoritative Information",
  204: "No Content",
  207: "Multi-Status",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  401: "Unauthorized",
  428: "Precondition Required",
} as const;

export type StatusCode = keyof typeof STATUS_PHRASES;

export type StatusClass =
  | "informational"
  | "success"
  | "redirection"
  | "client-error"
  | "server-error";

/** Width of one status class: 100-199, 200-299 and so on. */
const CLASS_SPAN = 100;
const CLASS_BY_HUNDRED: Readonly<Record<number, StatusClass>> = {
  1: "informational",
  2: "success",
  3: "redirection",
  4: "client-error",
  5: "server-error",
};

/** The status family a code belongs to; throws on anything outside 100-599. */
export function statusClassOf(code: number): StatusClass {
  const statusClass = CLASS_BY_HUNDRED[Math.floor(code / CLASS_SPAN)];
  if (!Number.isInteger(code) || !statusClass) {
    throw new RangeError(`Not an HTTP status code: ${code}`);
  }
  return statusClass;
}

/** One colour per family, taken from the app's method palette. */
export const STATUS_CLASS_COLOR: Readonly<Record<StatusClass, string>> = {
  informational: "var(--method-head)",
  success: "var(--method-get)",
  redirection: "var(--method-post)",
  "client-error": "var(--method-put)",
  "server-error": "var(--method-delete)",
};

export interface SectionStatus {
  sectionId: string;
  code: StatusCode;
  /** A one-line wink shown under the reason phrase. */
  aside?: string;
  /** The section stages its own big status code, so the rail steps aside. */
  yieldsRail?: boolean;
}

/** One status per landing section, in page order. */
export const SECTION_STATUSES: readonly SectionStatus[] = [
  {
    sectionId: SECTION_IDS.hero,
    code: 200,
    aside: "Open a tab. That is the whole handshake.",
  },
  {
    sectionId: SECTION_IDS.basics,
    code: 204,
    aside: "No form, no installer, no key.",
  },
  {
    sectionId: SECTION_IDS.demo,
    code: 201,
    aside: "Relay builds it while you watch.",
  },
  {
    sectionId: SECTION_IDS.capabilities,
    code: 207,
    aside: "One prompt, a status for every step.",
  },
  {
    sectionId: SECTION_IDS.authFlip,
    code: 401,
    aside: "Until the token has a value.",
    yieldsRail: true,
  },
  {
    sectionId: SECTION_IDS.control,
    code: 428,
    aside: "The precondition is your Approve.",
  },
  {
    sectionId: SECTION_IDS.commandPalette,
    code: 302,
    aside: "Three letters in, there it is.",
  },
  {
    sectionId: SECTION_IDS.importBackup,
    code: 301,
    aside: "Your collections live here now.",
  },
  {
    sectionId: SECTION_IDS.toolbox,
    code: 300,
    aside: "Pick a tool, or let Relay pick.",
  },
  {
    sectionId: SECTION_IDS.compare,
    code: 203,
    aside: "We wrote this table. The sources are linked.",
  },
  {
    sectionId: SECTION_IDS.finalCta,
    code: 101,
    aside: "Your move.",
  },
];

/** The status for a section, falling back to the first one above the page. */
export function statusForSection(sectionId: string | null): SectionStatus {
  const [first] = SECTION_STATUSES;
  return (
    SECTION_STATUSES.find((entry) => entry.sectionId === sectionId) ?? first
  );
}
