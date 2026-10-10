/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SETTINGS_SECTIONS } from "@/app/settings/constants";
import enSettings from "../../../messages/en/settings.json";
import { SettingsNav } from "./SettingsNav";

vi.mock("next/link", () => ({
  default({ children, href }: { children: ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  },
}));

afterEach(cleanup);

const ACTIVE_CLASS = "border-l-theme-accent";

function renderNav(activeSection: (typeof SETTINGS_SECTIONS)[number][0]) {
  const onSectionChange = vi.fn();
  render(
    <SettingsNav
      activeSection={activeSection}
      onSectionChange={onSectionChange}
    />,
  );
  return onSectionChange;
}

describe("SettingsNav", () => {
  it("renders all six sections with localized labels", () => {
    renderNav("general");

    expect(SETTINGS_SECTIONS).toHaveLength(6);
    for (const [id] of SETTINGS_SECTIONS) {
      expect(screen.getByTestId(`nav-${id}`)).toHaveTextContent(
        enSettings.sections[id],
      );
    }
  });

  it("marks only the active section as active", () => {
    renderNav("proxy");

    for (const [id] of SETTINGS_SECTIONS) {
      const isActive = screen.getByTestId(`nav-${id}`).className.includes(ACTIVE_CLASS);
      expect(isActive).toBe(id === "proxy");
    }
  });

  it("calls onSectionChange with the clicked section id", () => {
    const onSectionChange = renderNav("general");

    fireEvent.click(screen.getByTestId("nav-language"));

    expect(onSectionChange).toHaveBeenCalledWith("language");
  });

  it("links the Home breadcrumb to /app and shows the localized title", () => {
    renderNav("general");

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/app",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: enSettings.title }),
    ).toBeTruthy();
  });
});
