export type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface SidebarRequest {
  id: string;
  method: RequestMethod;
  name: string;
}

export interface SidebarCollection {
  name: string;
  requests: SidebarRequest[];
}

/** A change Relay proposes: tags the listed requests with a badge in the sidebar. */
export interface ChangeCard {
  id: string;
  title: string;
  detail: string;
  requestIds: string[];
  badge: string;
}

export interface RelayScenario {
  id: string;
  prompt: string;
  reply: string;
  cards: ChangeCard[];
}

/** Mock workspace shown in the demo sidebar; shared by every scenario. */
export const DEMO_SIDEBAR: SidebarCollection[] = [
  {
    name: "Payments",
    requests: [
      { id: "pay-create", method: "POST", name: "Create charge" },
      { id: "pay-list", method: "GET", name: "List charges" },
      { id: "pay-get", method: "GET", name: "Get charge" },
    ],
  },
  {
    name: "Orders",
    requests: [
      { id: "ord-create", method: "POST", name: "Place order" },
      { id: "ord-list", method: "GET", name: "List orders" },
      { id: "ord-cancel", method: "DELETE", name: "Cancel order" },
    ],
  },
];

export const RELAY_SCENARIOS: RelayScenario[] = [
  {
    id: "auth-header",
    prompt: "Add an auth header to every request in the Payments collection",
    reply:
      "Done. I added an Authorization header that reads your token variable to the 3 requests in Payments.",
    cards: [
      {
        id: "auth-header-card",
        title: "Add header to 3 requests",
        detail: "Authorization: Bearer {{token}}",
        requestIds: ["pay-create", "pay-list", "pay-get"],
        badge: "Auth",
      },
    ],
  },
  {
    id: "status-assertions",
    prompt: "Assert a 200 status on every GET request",
    reply:
      "I found 3 GET requests and added a status assertion to each. Nothing else was touched.",
    cards: [
      {
        id: "status-assert-payments",
        title: "Assert status 200 in Payments",
        detail: "List charges, Get charge",
        requestIds: ["pay-list", "pay-get"],
        badge: "Assert",
      },
      {
        id: "status-assert-orders",
        title: "Assert status 200 in Orders",
        detail: "List orders",
        requestIds: ["ord-list"],
        badge: "Assert",
      },
    ],
  },
  {
    id: "json-bodies",
    prompt: "Give the POST requests a JSON content type and a sample body",
    reply:
      "Both POST requests now send JSON with a starter body you can edit. Undo any card to revert it.",
    cards: [
      {
        id: "json-body-payments",
        title: "Set JSON body on Create charge",
        detail: "Content-Type: application/json",
        requestIds: ["pay-create"],
        badge: "JSON",
      },
      {
        id: "json-body-orders",
        title: "Set JSON body on Place order",
        detail: "Content-Type: application/json",
        requestIds: ["ord-create"],
        badge: "JSON",
      },
    ],
  },
];
