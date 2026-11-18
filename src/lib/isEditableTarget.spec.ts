/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./isEditableTarget";

function el(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
}

describe("isEditableTarget", () => {
  it.each([
    ["input", "<input />"],
    ["textarea", "<textarea></textarea>"],
    ["select", "<select></select>"],
    ["contenteditable", '<div contenteditable="true"></div>'],
    ["bare contenteditable", "<div contenteditable></div>"],
    ["role=textbox", '<div role="textbox"></div>'],
    ["role=combobox", '<div role="combobox"></div>'],
    ["CodeMirror content", '<div class="cm-editor"><div class="cm-content"></div></div>'],
    ["Monaco editor", '<div class="monaco-editor"><div class="view-line"></div></div>'],
  ])("is true for %s", (_name, html) => {
    expect(isEditableTarget(el(html))).toBe(true);
  });

  it("is true for a descendant of an editable host", () => {
    const host = el('<div role="textbox"><span id="c">x</span></div>');
    expect(isEditableTarget(host.querySelector("#c"))).toBe(true);
  });

  it("is false for plain elements, contenteditable=false and null", () => {
    expect(isEditableTarget(el("<div></div>"))).toBe(false);
    expect(isEditableTarget(el("<button></button>"))).toBe(false);
    expect(isEditableTarget(el('<div contenteditable="false"></div>'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
