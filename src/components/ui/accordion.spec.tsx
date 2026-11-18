/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

type TriggerProps = Parameters<typeof AccordionTrigger>[0];

function renderAccordion(triggerProps: Partial<TriggerProps> = {}) {
  return render(
    <Accordion>
      <AccordionItem value="a">
        <AccordionTrigger {...triggerProps}>Section A</AccordionTrigger>
        <AccordionContent>Body A</AccordionContent>
      </AccordionItem>
    </Accordion>,
  );
}

function triggerEl() {
  return screen.getByRole("button", { name: /section a/i });
}

function iconClasses(trigger: HTMLElement) {
  const right = trigger.querySelector("svg.lucide-chevron-right");
  const down = trigger.querySelector("svg.lucide-chevron-down");
  return {
    right: right?.getAttribute("class") ?? "",
    down: down?.getAttribute("class") ?? "",
  };
}

afterEach(cleanup);

describe("Accordion", () => {
  it("renders a right chevron that hides when expanded and a down chevron that shows when expanded", () => {
    renderAccordion();
    const { right, down } = iconClasses(triggerEl());
    expect(right).toContain("group-aria-expanded/accordion-trigger:hidden");
    expect(down).toContain("hidden");
    expect(down).toContain("group-aria-expanded/accordion-trigger:inline");
  });

  it("toggles aria-expanded and reveals the panel when the trigger is clicked", async () => {
    const user = userEvent.setup();
    renderAccordion();
    expect(triggerEl()).toHaveAttribute("aria-expanded", "false");

    await user.click(triggerEl());

    expect(triggerEl()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Body A")).toBeVisible();
  });

  it("places the chevrons after the label by default and before it with chevronLeft", () => {
    const { unmount } = renderAccordion();
    const trailing = triggerEl();
    expect(trailing.lastElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(trailing.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    unmount();

    renderAccordion({ chevronLeft: true });
    const leading = triggerEl();
    expect(leading.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(leading.lastChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(leading.className).toContain("mr-0");
  });

  it("renders an action sibling outside the trigger and applies className to the header", () => {
    renderAccordion({
      action: <button type="button">Do thing</button>,
      className: "custom-header",
    });
    const action = screen.getByRole("button", { name: "Do thing" });
    expect(triggerEl()).not.toContainElement(action);
    expect(action.parentElement?.className).toContain("custom-header");
    expect(triggerEl().className).not.toContain("custom-header");
  });

  it("applies className to the trigger itself when there is no action", () => {
    renderAccordion({ className: "custom-trigger" });
    expect(triggerEl().className).toContain("custom-trigger");
  });
});
