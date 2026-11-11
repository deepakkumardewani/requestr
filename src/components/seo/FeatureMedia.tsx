import Image from "next/image";
import type { SeoScreenshot } from "@/components/landing/data/seoPages";

const LIGHT_SUFFIX = "-light.";
const DARK_SUFFIX = "-dark.";
// Screenshots are captured at a fixed size; width/height reserve the box so
// the page does not shift while the image loads.
const MEDIA_WIDTH = 1440;
const MEDIA_HEIGHT = 900;
const MEDIA_SIZES = "(min-width: 1152px) 1152px, 100vw";
const MEDIA_CLASS = "h-auto w-full";

interface FeatureMediaProps {
  screenshot: SeoScreenshot;
  /**
   * Above-the-fold media is preloaded. Applies to both theme twins: dark is the
   * default theme, so its image is the LCP element and must not be lazy.
   */
  priority?: boolean;
}

/** The dark twin of a `-light.` screenshot, or the same file if it has none. */
export function toDarkSource(src: string): string {
  return src.replace(LIGHT_SUFFIX, DARK_SUFFIX);
}

/** Theme-matched screenshot: CSS shows the light or dark file, no client JS. */
export function FeatureMedia({
  screenshot,
  priority = false,
}: FeatureMediaProps) {
  const darkSrc = toDarkSource(screenshot.src);
  const hasDarkTwin = darkSrc !== screenshot.src;

  return (
    <figure className="overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm">
      <Image
        src={screenshot.src}
        alt={screenshot.alt}
        width={MEDIA_WIDTH}
        height={MEDIA_HEIGHT}
        sizes={MEDIA_SIZES}
        priority={priority}
        className={hasDarkTwin ? `${MEDIA_CLASS} dark:hidden` : MEDIA_CLASS}
      />
      {hasDarkTwin && (
        <Image
          src={darkSrc}
          alt={screenshot.alt}
          width={MEDIA_WIDTH}
          height={MEDIA_HEIGHT}
          sizes={MEDIA_SIZES}
          priority={priority}
          className={`${MEDIA_CLASS} hidden dark:block`}
        />
      )}
    </figure>
  );
}
