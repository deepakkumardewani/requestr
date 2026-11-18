import { firstJsonPathMatch } from "@/lib/chainJson";

/**
 * Check if an extractedValues key is a detailed key (contains injection source path)
 * vs. a bare edge ID key used as a fallback lookup when no detailed key matches.
 *
 * Detailed keys format: "edgeId:$.json.path"
 * Bare keys format: "edgeId"
 *
 * Only display-side, the bare keys are retained in extractedValues as that
 * fallback lookup target but should not be shown in the UI panel.
 */
export function isDetailedExtractionKey(key: string): boolean {
  return key.includes(":$");
}

/**
 * Parse an extractedValues detailed key into edge ID and source JSON path.
 * Assumes the key passes isDetailedExtractionKey() check.
 *
 * @param key Key of format "edgeId:$.json.path"
 * @returns { edgeId, sourceJsonPath } or null if not a detailed key
 */
export function parseDetailedExtractionKey(
  key: string,
): { edgeId: string; sourceJsonPath: string } | null {
  if (!isDetailedExtractionKey(key)) return null;
  const colonDollarIdx = key.indexOf(":$");
  return {
    edgeId: key.slice(0, colonDollarIdx),
    sourceJsonPath: key.slice(colonDollarIdx + 1),
  };
}

/** Extract a display variable name from a JSONPath, e.g. "$.data.token" → "token". */
export function jsonPathToVarName(path: string): string {
  const parts = path.replace(/^\$\.?/, "").split(".");
  return parts[parts.length - 1] || "value";
}

/**
 * Given a URL and a param name + extracted value, try to auto-replace a matching
 * static segment (or last numeric segment) with :paramName.
 * Returns the updated URL, or the original if nothing was replaced.
 */
export function autoReplaceUrlSegment(
  url: string,
  paramName: string,
  extractedValue: string | null,
): string {
  if (!paramName) return url;
  // Already has this placeholder — nothing to do
  if (url.includes(`:${paramName}`)) return url;

  // Try to match the extracted value exactly as a URL segment
  if (extractedValue) {
    const escaped = extractedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactPattern = new RegExp(`(/)${escaped}(/|$)`);
    if (exactPattern.test(url)) {
      return url.replace(exactPattern, `$1:${paramName}$2`);
    }
  }

  // Fallback: replace the last numeric or UUID-like segment
  const numericOrUuidPattern = /(\/)[a-f0-9-]{8,}(\/?$)|(\/)\d+(\/?$)/i;
  const match = url.match(numericOrUuidPattern);
  if (match) {
    return url.replace(numericOrUuidPattern, (_, p1, p2, p3, p4) => {
      const slash = p1 ?? p3;
      const trail = p2 ?? p4 ?? "";
      return `${slash}:${paramName}${trail}`;
    });
  }

  return url;
}

/** Resolve the actual value for a JSONPath from an already-parsed response. */
export function resolveJsonPathFromParsed(
  parsed: unknown,
  jsonPath: string,
): string | null {
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !jsonPath ||
    !jsonPath.trim()
  ) {
    return null;
  }
  const match = firstJsonPathMatch(parsed, jsonPath);
  return match === undefined ? null : String(match);
}
