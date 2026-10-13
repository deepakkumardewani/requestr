/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RELAY_DEFAULT_WIDTH_PX } from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";
import { useRelayFocus } from "./useRelayFocus";

/** Builds a dock (composer + a second control) in the page and mounts the hook against it. */
function mountDock({ twoStepEscape = true, strict = false } = {}) {
  const dock = document.createElement("aside");
  dock.dataset.testid = "dock";
  const composer = document.createElement("textarea");
  composer.dataset.testid = "composer";
  const inside = document.createElement("button");
  inside.dataset.testid = "inside";
  dock.append(composer, inside);
  document.body.append(dock);

  // Refs are created once, as real components keep them stable across renders.
  const dockRef = { current: dock };
  const composerRef = { current: composer };
  return renderHook(
    () => useRelayFocus({ dockRef, composerRef, twoStepEscape }),
    strict ? { wrapper: StrictMode } : undefined,
  );
}

function getEl(testId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!el) throw new Error(`missing ${testId}`);
  return el;
}

function addOutsideButton(id: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.dataset.testid = id;
  document.body.append(button);
  return button;
}

function setOpen(open: boolean) {
  act(() => useRelayStore.getState().setOpen(open));
}

function pressEscape(init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
    ...init,
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  useRelayStore.setState({
    open: false,
    width: RELAY_DEFAULT_WIDTH_PX,
    focusRequest: 0,
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useRelayFocus: open and restore", () => {
  it("focuses the composer when the user opens Relay", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    mountDock();

    setOpen(true);

    expect(document.activeElement).toBe(getEl("composer"));
  });

  it("restores the previously focused element when toggled closed", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    mountDock();

    setOpen(true);
    setOpen(false);

    expect(document.activeElement).toBe(outside);
  });

  it("handles the first open, which mounts the dock after the toggle", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    setOpen(true);

    mountDock();

    expect(document.activeElement).toBe(getEl("composer"));
    setOpen(false);
    expect(document.activeElement).toBe(outside);
  });

  it("keeps the captured element when StrictMode re-runs the mount effect", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    setOpen(true);

    mountDock({ strict: true });

    expect(document.activeElement).toBe(getEl("composer"));
    setOpen(false);
    expect(document.activeElement).toBe(outside);
  });

  it("does not steal focus when an open state is restored from storage", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    useRelayStore.setState({ open: true, focusRequest: 0 });

    mountDock();

    expect(document.activeElement).toBe(outside);
  });

  it("refocuses the composer when opened again while already open", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    mountDock();
    setOpen(true);
    getEl("inside").focus();

    setOpen(true);

    expect(document.activeElement).toBe(getEl("composer"));
    setOpen(false);
    expect(document.activeElement).toBe(outside);
  });

  it("leaves focus alone on close if the user already moved elsewhere", () => {
    const outside = addOutsideButton("outside");
    const elsewhere = addOutsideButton("elsewhere");
    outside.focus();
    mountDock();
    setOpen(true);
    elsewhere.focus();

    setOpen(false);

    expect(document.activeElement).toBe(elsewhere);
  });

  it("drops focus when there is nothing to return to", () => {
    mountDock();
    setOpen(true);
    expect(document.activeElement).toBe(getEl("composer"));

    setOpen(false);

    expect(document.activeElement).toBe(document.body);
  });

  it("drops focus when the previous element left the page", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    mountDock();
    setOpen(true);
    outside.remove();

    setOpen(false);

    expect(document.activeElement).toBe(document.body);
  });
});

describe("useRelayFocus: two-step Escape", () => {
  function openFromOutside() {
    const outside = addOutsideButton("outside");
    outside.focus();
    setOpen(true);
    return outside;
  }

  it("first Esc returns focus without closing, second Esc closes", () => {
    const outside = addOutsideButton("outside");
    outside.focus();
    mountDock();
    setOpen(true);

    pressEscape();
    expect(document.activeElement).toBe(outside);
    expect(useRelayStore.getState().open).toBe(true);

    pressEscape();
    expect(useRelayStore.getState().open).toBe(false);
  });

  it("does nothing on Esc while a draft is in the composer", () => {
    const outside = openFromOutside();
    mountDock();
    // Opened before mount: the composer is focused by the mount effect.
    const composer = getEl("composer") as HTMLTextAreaElement;
    composer.value = "draft";

    pressEscape();

    expect(document.activeElement).toBe(composer);
    expect(useRelayStore.getState().open).toBe(true);
    expect(outside).not.toHaveFocus();
  });

  it("returns focus on Esc from a non-composer control inside the dock", () => {
    const outside = openFromOutside();
    mountDock();
    getEl("inside").focus();

    pressEscape();

    expect(document.activeElement).toBe(outside);
    expect(useRelayStore.getState().open).toBe(true);
  });

  it("does not close on an outside Esc that was never preceded by a first Esc", () => {
    openFromOutside();
    mountDock();
    addOutsideButton("elsewhere").focus();

    pressEscape();

    expect(useRelayStore.getState().open).toBe(true);
  });

  it("disarms when focus re-enters the dock", () => {
    openFromOutside();
    mountDock();
    pressEscape();
    getEl("composer").focus();
    addOutsideButton("elsewhere").focus();

    pressEscape();

    expect(useRelayStore.getState().open).toBe(true);
  });

  it("ignores Esc while another overlay is open", () => {
    openFromOutside();
    mountDock();
    pressEscape();
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    document.body.append(overlay);

    pressEscape();

    expect(useRelayStore.getState().open).toBe(true);
  });

  it("ignores Esc another handler already consumed", () => {
    openFromOutside();
    mountDock();

    const consumed = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
      bubbles: true,
    });
    consumed.preventDefault();
    getEl("composer").dispatchEvent(consumed);

    expect(document.activeElement).toBe(getEl("composer"));
  });

  it("ignores Esc while closed", () => {
    mountDock();
    pressEscape();
    expect(useRelayStore.getState().open).toBe(false);
  });

  it("ignores keys other than Esc", () => {
    openFromOutside();
    mountDock();

    fireEvent.keyDown(getEl("composer"), { key: "a" });

    expect(document.activeElement).toBe(getEl("composer"));
  });

  it("leaves Esc to the sheet when two-step Esc is off", () => {
    openFromOutside();
    mountDock({ twoStepEscape: false });

    pressEscape();
    pressEscape();

    expect(useRelayStore.getState().open).toBe(true);
  });
});
