import type { FeaturePreviewId } from "../data/features";
import { BackupPreview } from "./previews/BackupPreview";
import { ChainsPreview } from "./previews/ChainsPreview";
import { ComparePreview } from "./previews/ComparePreview";
import { EnvironmentsPreview } from "./previews/EnvironmentsPreview";
import { ImportPreview } from "./previews/ImportPreview";
import { PalettePreview } from "./previews/PalettePreview";
import { RelayPreview } from "./previews/RelayPreview";
import { SharePreview } from "./previews/SharePreview";
import { TransformPreview } from "./previews/TransformPreview";
import { VisualizePreview } from "./previews/VisualizePreview";

export const PREVIEW_COMPONENTS: Record<
  FeaturePreviewId,
  () => React.JSX.Element
> = {
  relay: RelayPreview,
  transform: TransformPreview,
  compare: ComparePreview,
  visualize: VisualizePreview,
  share: SharePreview,
  chains: ChainsPreview,
  environments: EnvironmentsPreview,
  palette: PalettePreview,
  import: ImportPreview,
  backup: BackupPreview,
};

interface FeaturePreviewProps {
  id: FeaturePreviewId;
  /** Freezes the preview's CSS animations, e.g. while the card is off-screen. */
  paused?: boolean;
}

export function FeaturePreview({ id, paused = false }: FeaturePreviewProps) {
  const Preview = PREVIEW_COMPONENTS[id];
  return (
    <div
      aria-hidden="true"
      data-preview-paused={paused}
      className="h-32 w-full shrink-0 overflow-hidden rounded-lg border border-border/50 bg-[var(--surface-deep)]"
    >
      <Preview />
    </div>
  );
}
