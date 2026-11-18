/**
 * Scripted Relay conversations for the hero. Step labels follow the wording
 * the real panel uses ("Read request: …", "Send this GET request?").
 */

export type SessionMethod = "GET" | "POST";

interface StepBase {
  id: string;
}

export type SessionStep =
  | (StepBase & { kind: "tool"; label: string })
  | (StepBase & { kind: "change"; label: string; method?: SessionMethod })
  | (StepBase & { kind: "confirm"; title: string; detail: string })
  | (StepBase & { kind: "response"; status: string; meta: string })
  | (StepBase & { kind: "reply"; text: string });

export interface RelaySessionScript {
  id: string;
  /** Short label for the picker under the panel. */
  tab: string;
  prompt: string;
  steps: readonly SessionStep[];
  /** Shown once the run finishes, like the panel's "Worked for …" line. */
  duration: string;
}

export const RELAY_SESSIONS: readonly RelaySessionScript[] = [
  {
    id: "build",
    tab: "Build a flow",
    prompt: "Set up login and fetch the current user for the DummyJSON API",
    duration: "14s",
    steps: [
      { id: "overview", kind: "tool", label: "Read workspace overview" },
      {
        id: "login",
        kind: "change",
        method: "POST",
        label: "Created request: Login",
      },
      {
        id: "me",
        kind: "change",
        method: "GET",
        label: "Created request: Get current user",
      },
      {
        id: "chain",
        kind: "change",
        label: 'Built chain "Login then profile" · 2 nodes',
      },
      {
        id: "reply",
        kind: "reply",
        text: "Both requests are in DummyJSON Shop. The chain passes accessToken from Login into the Authorization header of Get current user.",
      },
    ],
  },
  {
    id: "test",
    tab: "Write tests",
    prompt: "Run List products and write assertions for it",
    duration: "9s",
    steps: [
      { id: "read", kind: "tool", label: "Read request: List products" },
      {
        id: "confirm",
        kind: "confirm",
        title: "Send this GET request?",
        detail: '"List products" will be sent to dummyjson.com',
      },
      {
        id: "response",
        kind: "response",
        status: "200 OK",
        meta: "212 ms · 4.1 kB",
      },
      {
        id: "scripts",
        kind: "change",
        method: "GET",
        label: "Updated scripts: List products",
      },
      {
        id: "reply",
        kind: "reply",
        text: "Added 4 assertions: status is 200, products is an array, limit is 5 and every product has an id.",
      },
    ],
  },
  {
    id: "debug",
    tab: "Explain an error",
    prompt: "Why is Get user cart returning 401?",
    duration: "6s",
    steps: [
      { id: "read", kind: "tool", label: "Read request: Get user cart" },
      { id: "last", kind: "tool", label: "Read last response" },
      { id: "env", kind: "tool", label: "Read environment: DummyJSON" },
      {
        id: "reply",
        kind: "reply",
        text: "The request sends Authorization: Bearer {{token}}, but token has no value in the DummyJSON environment. Run Login first, or I can chain the two so it is filled in for you.",
      },
    ],
  },
];
