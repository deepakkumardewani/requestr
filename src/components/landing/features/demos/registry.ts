import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { FeatureSlug } from "../../data/seoPages";

/**
 * One demo per feature page. Each is its own chunk so a page ships only its
 * demo; SSR stays on so the demo's first frame is in the HTML.
 */
export const FEATURE_DEMOS = {
  relay: dynamic(() =>
    import("../../session/RelaySession").then((m) => m.RelaySession),
  ),
  "request-chains": dynamic(() =>
    import("./ChainRunDemo").then((m) => m.ChainRunDemo),
  ),
  "transform-playground": dynamic(() =>
    import("./TransformDemo").then((m) => m.TransformDemo),
  ),
  "json-compare": dynamic(() =>
    import("./CompareDemo").then((m) => m.CompareDemo),
  ),
  "json-visualize": dynamic(() => import("./TreeDemo").then((m) => m.TreeDemo)),
  import: dynamic(() =>
    import("./ImportCurlDemo").then((m) => m.ImportCurlDemo),
  ),
  "collections-environments": dynamic(() =>
    import("./EnvSwitchDemo").then((m) => m.EnvSwitchDemo),
  ),
  "command-palette": dynamic(() =>
    import("./CommandPaletteDemo").then((m) => m.CommandPaletteDemo),
  ),
  "backup-restore": dynamic(() =>
    import("./BackupRestoreDemo").then((m) => m.BackupRestoreDemo),
  ),
} as const satisfies Record<FeatureSlug, ComponentType>;

export function getFeatureDemo(slug: string): ComponentType | undefined {
  return Object.hasOwn(FEATURE_DEMOS, slug)
    ? FEATURE_DEMOS[slug as FeatureSlug]
    : undefined;
}
