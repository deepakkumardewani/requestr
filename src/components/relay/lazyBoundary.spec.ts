import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "../..");
const SHELL_FILES = [
  "components/layout/MainLayout.tsx",
  "providers/AppProviders.tsx",
  "components/relay/RelayRoot.tsx",
];
/** Modules that must only load once the dock is opened (NFR-2). */
const LAZY_ONLY = [
  "components/relay/RelayDock",
  "components/ai-elements/",
  "lib/relay/tools/",
  "lib/relay/contextBuilder",
  "hooks/useRelayChat",
  "lib/relay/changeLog",
  "lib/relay/threadDb",
];
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/** Static `from "x"` specifiers; type-only and dynamic imports do not load code. */
function staticImports(source: string): string[] {
  const found: string[] = [];
  const pattern = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm;
  for (const match of source.matchAll(pattern)) found.push(match[1]);
  const bare = /^\s*import\s+["']([^"']+)["']/gm;
  for (const match of source.matchAll(bare)) found.push(match[1]);
  return found;
}

function resolveModule(specifier: string, from: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  const hit = EXTENSIONS.map((ext) => base + ext).find(
    (candidate) => existsSync(candidate) && !candidate.endsWith(path.sep),
  );
  return hit && /\.(tsx?|)$/.test(hit) && existsSync(hit) ? hit : null;
}

/** Every first-party file reachable from `entry` through static imports. */
function staticClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || !/\.tsx?$/.test(file)) continue;
    seen.add(file);
    for (const specifier of staticImports(readFileSync(file, "utf8"))) {
      const resolved = resolveModule(specifier, file);
      if (resolved) queue.push(resolved);
    }
  }
  return seen;
}

const toRel = (file: string) => path.relative(SRC_ROOT, file).split(path.sep).join("/");

describe("Relay lazy boundary", () => {
  it("reaches the dock only through next/dynamic in RelayRoot", () => {
    const root = readFileSync(path.join(SRC_ROOT, "components/relay/RelayRoot.tsx"), "utf8");
    expect(root).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/RelayDockWithMessages["']\)/);
    expect(staticImports(root).filter((s) => s.includes("RelayDock"))).toEqual([]);
  });

  it("imports only RelayRoot from the Relay UI in the app providers", () => {
    const providers = readFileSync(path.join(SRC_ROOT, "providers/AppProviders.tsx"), "utf8");
    const relayUi = staticImports(providers).filter((s) => s.includes("components/relay"));
    expect(relayUi).toEqual(["@/components/relay/RelayRoot"]);
  });

  it("keeps MainLayout free of any Relay or AI Elements import", () => {
    const layout = readFileSync(path.join(SRC_ROOT, "components/layout/MainLayout.tsx"), "utf8");
    expect(staticImports(layout).filter((s) => /relay|ai-elements/i.test(s))).toEqual([]);
  });

  it.each(SHELL_FILES)("never statically pulls tool or run code into %s", (shellFile) => {
    const closure = [...staticClosure(path.join(SRC_ROOT, shellFile))].map(toRel);
    const leaked = closure.filter((file) => LAZY_ONLY.some((lazy) => file.includes(lazy)));
    expect(leaked).toEqual([]);
  });
});
