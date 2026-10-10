const EXPORT_PREFIX = /^export\s+/;
// Only whitespace-preceded `#` starts a comment, so `http://x/#frag` survives.
const INLINE_COMMENT = /\s+#.*$/;

// A quoted value, optionally followed by whitespace + `# comment`; group 2 is the inner value.
const QUOTED_VALUE = /^(["'])(.*)\1(?:\s+#.*)?$/;

function parseValue(raw: string): string {
  const quoted = QUOTED_VALUE.exec(raw);
  if (quoted) return quoted[2];
  return raw.replace(INLINE_COMMENT, "").trimEnd();
}

/**
 * Parse `.env`-style lines into key/value pairs. Later duplicate keys overwrite earlier ones.
 * Blank lines and lines starting with `#` are skipped. A leading `export ` is stripped from keys
 * and whitespace-preceded `# comments` are stripped from unquoted values.
 */
export function parseDotEnvContent(
  text: string,
): Array<{ key: string; value: string }> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).replace(EXPORT_PREFIX, "").trim();
    if (!key) continue;
    map.set(key, parseValue(trimmed.slice(eq + 1)));
  }
  return [...map.entries()].map(([key, value]) => ({ key, value }));
}

/**
 * If clipboard text looks like a multi-line `.env` blob, returns parsed pairs; otherwise `null`
 * (single-line `KEY=value` pastes stay normal so one cell can still receive a single assignment).
 */
export function consumeDotEnvBulkPaste(
  text: string,
): Array<{ key: string; value: string }> | null {
  if (!/\r|\n/.test(text)) return null;
  const pairs = parseDotEnvContent(text);
  if (pairs.length === 0) return null;
  return pairs;
}
