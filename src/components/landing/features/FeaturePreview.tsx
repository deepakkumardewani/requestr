import type { FeaturePreviewId } from "../data/features";
import { ComparePreview } from "./previews/ComparePreview";
import { SharePreview } from "./previews/SharePreview";
import { TransformPreview } from "./previews/TransformPreview";
import { VisualizePreview } from "./previews/VisualizePreview";

const PREVIEW_COMPONENTS: Record<FeaturePreviewId, () => React.JSX.Element> = {
  transform: TransformPreview,
  compare: ComparePreview,
  visualize: VisualizePreview,
  share: SharePreview,
};

interface FeaturePreviewProps {
  id: FeaturePreviewId;
}

export function FeaturePreview({ id }: FeaturePreviewProps) {
  const Preview = PREVIEW_COMPONENTS[id];
  return (
    <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg bg-background/40">
      <Preview />
    </div>
  );
}
