import type { RunStep } from "@/lib/chainRunHistory";

/** Drops case and separators so "HTTP_STATUS", "http-status" and "httpStatus" all match. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Every searchable field of a step: label, error code/message and HTTP status. */
function getSearchHaystack(step: RunStep): string[] {
  const status = step.response?.status;
  return [
    step.label,
    step.errorCode,
    step.error,
    status === undefined ? undefined : String(status),
  ].filter((field): field is string => field !== undefined && field !== "");
}

/** True when the query is empty or any searchable field of the step contains it. */
export function matchesSearch(step: RunStep, query: string): boolean {
  const needle = normalize(query);
  if (needle === "") return true;
  return getSearchHaystack(step).some((field) =>
    normalize(field).includes(needle),
  );
}
