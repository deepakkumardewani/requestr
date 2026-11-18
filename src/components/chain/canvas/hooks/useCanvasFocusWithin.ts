import { useCallback, useRef, useState } from "react";

/**
 * Tracks whether focus is inside the canvas wrapper's DOM subtree.
 *
 * React focus events bubble through portals (config Sheets/dialogs are React
 * children of the wrapper but live elsewhere in the DOM), so containment is
 * checked against the real DOM with `wrapper.contains(...)` instead of trusting
 * the synthetic event's bubbling.
 */
export function useCanvasFocusWithin() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const containsNode = useCallback(
    (node: EventTarget | null) =>
      node instanceof Node && Boolean(wrapperRef.current?.contains(node)),
    [],
  );

  const onFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      setFocused(containsNode(e.target));
    },
    [containsNode],
  );

  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      setFocused(containsNode(e.relatedTarget));
    },
    [containsNode],
  );

  return { wrapperRef, focused, focusProps: { onFocus, onBlur } };
}
