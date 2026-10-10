import type { IncomingMessage } from "node:http";
import { DEFAULT_TEST_ID, TEST_ID_HEADER } from "./mockBaseUrl";

export type LogKind = "http" | "ws" | "socketio";

export interface LogEntry {
  kind: LogKind;
  event: string;
  testId: string;
  time: number;
  method?: string;
  path?: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[] | undefined>;
  detail?: unknown;
}

const logsByTestId = new Map<string, LogEntry[]>();

/** Browsers cannot set headers on WebSocket/Socket.IO handshakes, so fall back to `?testId=`. */
export function resolveTestId(
  headers: IncomingMessage["headers"],
  query: URLSearchParams,
): string {
  const fromHeader = headers[TEST_ID_HEADER];
  const headerValue = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
  return headerValue || query.get("testId") || DEFAULT_TEST_ID;
}

export function recordEntry(entry: Omit<LogEntry, "time">): void {
  const entries = logsByTestId.get(entry.testId) ?? [];
  entries.push({ ...entry, time: Date.now() });
  logsByTestId.set(entry.testId, entries);
}

export function getEntries(testId: string): LogEntry[] {
  return logsByTestId.get(testId) ?? [];
}

/** Always scoped to one test id; there is intentionally no global reset. */
export function resetEntries(testId: string): void {
  logsByTestId.delete(testId);
}

export function queryToObject(
  query: URLSearchParams,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(query.keys())) {
    const values = query.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}
