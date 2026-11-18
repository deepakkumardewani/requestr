import type { HistoryEntry, HttpTab, TabType } from "@/types";

type EntryOverrides = {
  id?: string;
  type?: TabType;
  url?: string;
  timestamp?: number;
  duration?: number;
  request?: Partial<HttpTab>;
  headers?: Record<string, string>;
};

/** A complete history entry; `type` can be forced to a non-HTTP value to model WebSocket/Socket.IO. */
export function historyEntry(overrides: EntryOverrides = {}): HistoryEntry {
  const url = overrides.url ?? "https://api.test/items?a=1&b=two";
  const timestamp = overrides.timestamp ?? Date.UTC(2026, 4, 2, 10, 30, 0);
  const duration = overrides.duration ?? 120.6;
  return {
    id: overrides.id ?? "h1",
    method: "GET",
    url,
    status: 200,
    duration,
    size: 42,
    timestamp,
    request: {
      tabId: "tab",
      requestId: null,
      name: "n",
      isDirty: false,
      type: (overrides.type ?? "http") as "http",
      url,
      method: "GET",
      headers: [],
      params: [],
      auth: { type: "none" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      ...overrides.request,
    },
    response: {
      status: 200,
      statusText: "OK",
      headers: overrides.headers ?? { "Content-Type": "application/json" },
      body: '{"ok":true}',
      duration,
      size: 42,
      url,
      method: "GET",
      timestamp,
    },
  };
}
