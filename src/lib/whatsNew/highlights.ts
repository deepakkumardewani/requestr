export type HighlightLocale = "en" | "fr" | "ja";

export type VersionHighlights = Record<HighlightLocale, string[]>;

const FALLBACK_LOCALE: HighlightLocale = "en";

/**
 * Plain-language bullets per release, keyed by version. A version with no
 * entry (or an empty one) shows no dialog, so a release ships quietly unless
 * someone writes highlights for it.
 */
export const HIGHLIGHTS: Record<string, VersionHighlights> = {
  "0.1.0": {
    en: [
      "Build, send and chain API requests right in your browser, with no install or account.",
      "Press ? at any time to see the keyboard shortcuts.",
      "Export a backup from Settings so your work is never lost.",
    ],
    fr: [
      "Créez, envoyez et enchaînez des requêtes API directement dans votre navigateur, sans installation ni compte.",
      "Appuyez sur ? à tout moment pour voir les raccourcis clavier.",
      "Exportez une sauvegarde depuis les Paramètres pour ne jamais perdre votre travail.",
    ],
    ja: [
      "インストールもアカウントも不要で、ブラウザ上でAPIリクエストの作成・送信・連携ができます。",
      "いつでも ? を押すと、キーボードショートカットを確認できます。",
      "設定からバックアップを書き出して、作業内容を失わないようにしましょう。",
    ],
  },
};

function isHighlightLocale(locale: string): locale is HighlightLocale {
  return locale === "en" || locale === "fr" || locale === "ja";
}

/** Bullets for `version` in `locale`, falling back to English; empty when the version has none. */
export function getHighlights(version: string, locale: string): string[] {
  const entry = HIGHLIGHTS[version];
  if (!entry) return [];
  const localized = isHighlightLocale(locale) ? entry[locale] : undefined;
  return localized?.length ? localized : (entry[FALLBACK_LOCALE] ?? []);
}

/** Numeric dotted-version parts; a pre-release or build suffix is ignored. */
function parseVersion(version: string): number[] {
  return version
    .split(/[-+]/)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * The newest version in (`lastSeen`, `current`] that has highlights, so a user
 * who skipped releases sees the latest notes once rather than a stack of dialogs.
 * A null `lastSeen` means nothing was ever seen.
 */
export function pickLatestWithHighlights(
  lastSeen: string | null,
  current: string,
): string | null {
  const candidates = Object.keys(HIGHLIGHTS)
    .filter((version) => getHighlights(version, FALLBACK_LOCALE).length > 0)
    .filter((version) => compareVersions(version, current) <= 0)
    .filter(
      (version) => lastSeen === null || compareVersions(version, lastSeen) > 0,
    )
    .sort(compareVersions);
  return candidates.at(-1) ?? null;
}
