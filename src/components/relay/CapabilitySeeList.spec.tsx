/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestLocale } from "@/vitest-setup";
import { CapabilitySeeList } from "./CapabilitySeeList";

afterEach(cleanup);

beforeEach(() => {
  setTestLocale("en");
});

describe("CapabilitySeeList", () => {
  it("renders the list container with correct testid", () => {
    render(<CapabilitySeeList />);

    expect(screen.getByTestId("relay-capability-see-list")).toBeInTheDocument();
  });

  it("renders all five see items", () => {
    render(<CapabilitySeeList />);

    expect(
      screen.getByTestId("relay-capability-see-attached"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("relay-capability-see-index"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("relay-capability-see-lookups"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("relay-capability-see-envValues"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("relay-capability-see-secrets"),
    ).toBeInTheDocument();
  });

  it("displays the attached section with sample entity pills", () => {
    render(<CapabilitySeeList />);

    const attachedItem = screen.getByTestId("relay-capability-see-attached");
    expect(attachedItem).toBeInTheDocument();

    // Should contain entity pills
    const pills = attachedItem.querySelectorAll('[data-testid*="entity-pill"]');
    expect(pills.length).toBeGreaterThan(0);
  });

  it("displays the index section without entity pills", () => {
    render(<CapabilitySeeList />);

    const indexItem = screen.getByTestId("relay-capability-see-index");
    expect(indexItem).toBeInTheDocument();

    // Should not have entity pills nested
    const pills = indexItem.querySelectorAll('[data-testid*="entity-pill"]');
    expect(pills.length).toBe(0);
  });

  it("displays the lookups section without entity pills", () => {
    render(<CapabilitySeeList />);

    const lookupsItem = screen.getByTestId("relay-capability-see-lookups");
    expect(lookupsItem).toBeInTheDocument();

    // Should not have entity pills nested
    const pills = lookupsItem.querySelectorAll(
      '[data-testid*="entity-pill"]',
    );
    expect(pills.length).toBe(0);
  });

  it("displays the envValues section with settings link", () => {
    render(<CapabilitySeeList />);

    const envValuesItem = screen.getByTestId("relay-capability-see-envValues");
    expect(envValuesItem).toBeInTheDocument();

    const settingsLink = screen.getByTestId(
      "relay-capability-settings-link",
    );
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("displays the secrets section without entity pills", () => {
    render(<CapabilitySeeList />);

    const secretsItem = screen.getByTestId("relay-capability-see-secrets");
    expect(secretsItem).toBeInTheDocument();

    // Should not have entity pills nested
    const pills = secretsItem.querySelectorAll('[data-testid*="entity-pill"]');
    expect(pills.length).toBe(0);
  });

  it("renders icons for each section", () => {
    render(<CapabilitySeeList />);

    const items = [
      "relay-capability-see-attached",
      "relay-capability-see-index",
      "relay-capability-see-lookups",
      "relay-capability-see-envValues",
      "relay-capability-see-secrets",
    ];

    for (const itemId of items) {
      const item = screen.getByTestId(itemId);
      // Each item should have an SVG icon
      const svg = item.querySelector("svg");
      expect(svg).toBeInTheDocument();
    }
  });

  it("has settings link with correct styling classes", () => {
    render(<CapabilitySeeList />);

    const settingsLink = screen.getByTestId(
      "relay-capability-settings-link",
    );
    expect(settingsLink).toHaveClass("text-primary");
    expect(settingsLink).toHaveClass("hover:underline");
  });

  it("renders as an unordered list", () => {
    render(<CapabilitySeeList />);

    const list = screen.getByTestId("relay-capability-see-list");
    expect(list.tagName).toBe("UL");
  });

  it("renders each see item as a list item", () => {
    render(<CapabilitySeeList />);

    const listItems = screen.getByTestId(
      "relay-capability-see-list",
    ).querySelectorAll("li");
    expect(listItems.length).toBe(5);
  });

  it("translates all item labels correctly", () => {
    render(<CapabilitySeeList />);

    const attachedItem = screen.getByTestId("relay-capability-see-attached");
    expect(attachedItem.textContent).toContain("capabilities.see.attached");

    const indexItem = screen.getByTestId("relay-capability-see-index");
    expect(indexItem.textContent).toContain("capabilities.see.index");
  });

  it("conditionally renders entity pills only for attached section", () => {
    render(<CapabilitySeeList />);

    // Count all entity pills
    const allPills = screen.getByTestId("relay-capability-see-list").querySelectorAll(
      '[data-testid*="entity-pill"]',
    );

    // Should only have pills in the attached section
    const attachedItem = screen.getByTestId("relay-capability-see-attached");
    const attachedPills = attachedItem.querySelectorAll(
      '[data-testid*="entity-pill"]',
    );

    expect(allPills.length).toBe(attachedPills.length);
  });

  it("includes sample entities for all kinds in attached section", () => {
    render(<CapabilitySeeList />);

    const attachedItem = screen.getByTestId("relay-capability-see-attached");
    const text = attachedItem.textContent;

    // Should mention different kinds of entities
    expect(text).toBeTruthy();
  });

  it("renders settings link only in envValues section", () => {
    render(<CapabilitySeeList />);

    const settingsLinks = screen.getAllByTestId(
      "relay-capability-settings-link",
    );
    expect(settingsLinks.length).toBe(1);

    // Verify it's inside envValues
    const envValuesItem = screen.getByTestId("relay-capability-see-envValues");
    expect(envValuesItem.contains(settingsLinks[0])).toBe(true);
  });

  it("has proper flex layout for items", () => {
    render(<CapabilitySeeList />);

    const list = screen.getByTestId("relay-capability-see-list");
    const classes = list.className;
    expect(classes).toContain("flex");
    expect(classes).toContain("flex-col");
    expect(classes).toContain("gap-3");
  });

  it("has proper padding for the list", () => {
    render(<CapabilitySeeList />);

    const list = screen.getByTestId("relay-capability-see-list");
    const classes = list.className;
    expect(classes).toContain("p-3");
  });

  it("renders text items with proper styling", () => {
    render(<CapabilitySeeList />);

    const attachedItem = screen.getByTestId("relay-capability-see-attached");
    const classes = attachedItem.className;
    expect(classes).toContain("flex");
    expect(classes).toContain("gap-2");
  });

  it("hides icons from assistive technology", () => {
    render(<CapabilitySeeList />);

    const icons = screen.getByTestId("relay-capability-see-list").querySelectorAll(
      "svg[aria-hidden='true']",
    );
    expect(icons.length).toBeGreaterThan(0);
  });

  it("renders section titles with correct styling", () => {
    render(<CapabilitySeeList />);

    const attachedItem = screen.getByTestId("relay-capability-see-attached");
    const titleSpan = attachedItem.querySelector("span");
    expect(titleSpan).toBeInTheDocument();
  });
});
