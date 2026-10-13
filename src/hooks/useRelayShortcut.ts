"use client";

import { useEffect } from "react";
import { isMac } from "@/lib/platform";
import {
  RELAY_SHORTCUTS,
  type RelayShortcutChord,
} from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";

/**
 * Editors bind both Relay chords themselves (CodeMirror: Mod-i, Mod-Shift-l),
 * so the key stays theirs there. Users reach Relay from the header button.
 */
const CODE_EDITOR_SELECTOR = ".cm-editor, .monaco-editor";

function matchesChord(event: KeyboardEvent, chord: RelayShortcutChord) {
  return (
    event.key.toLowerCase() === chord.key &&
    event.metaKey === chord.meta &&
    event.ctrlKey === chord.ctrl &&
    event.shiftKey === chord.shift &&
    !event.altKey
  );
}

function isInsideCodeEditor(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(CODE_EDITOR_SELECTOR) !== null
  );
}

/**
 * Toggles Relay on Cmd+I (Mac) or Ctrl+Shift+L (elsewhere).
 *
 * Deliberately not part of `useKeyboardShortcuts`: that hook only mounts on
 * the workspace and chain pages and ignores keys typed into inputs, while
 * Relay must work on every route and from inside text fields (FR-30).
 */
export function useRelayShortcut({ enabled }: { enabled: boolean }) {
  const toggle = useRelayStore((s) => s.toggle);

  useEffect(() => {
    if (!enabled) return;

    const chord = isMac() ? RELAY_SHORTCUTS.mac : RELAY_SHORTCUTS.other;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || !matchesChord(event, chord)) return;
      if (isInsideCodeEditor(event.target)) return;
      event.preventDefault();
      toggle();
    }

    // Capture phase so a focused input or a page handler cannot swallow it.
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled, toggle]);
}
