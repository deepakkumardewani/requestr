/**
 * Elements (or ancestors of the event target) that consume typing. Covers native
 * form controls plus the custom editors the app embeds: CodeMirror and Monaco
 * render a contenteditable/textarea deep inside their own wrapper, and ARIA
 * text widgets may be plain divs.
 */
const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='combobox']",
  "[role='searchbox']",
  ".cm-editor",
  ".monaco-editor",
].join(",");

/** True while an event target sits in (or inside) something the user types into. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(EDITABLE_SELECTOR) !== null;
}
