import { useLayoutEffect, useRef, useState } from "react";

/**
 * Reports whether the element's content is clipped (scrollWidth > clientWidth).
 * Re-measured when `content` changes and whenever the element is resized.
 */
export function useIsTruncated<T extends HTMLElement>(content: string) {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // `content` is a dependency so a new text is re-measured
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () =>
      setIsTruncated(element.scrollWidth > element.clientWidth);
    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content]);

  return { ref, isTruncated };
}
