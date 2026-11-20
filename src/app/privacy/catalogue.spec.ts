/** @vitest-environment happy-dom */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EVENT_ALLOWLIST } from "@/lib/analytics/events";
import PrivacyRoute from "./page";

/** R47: the privacy page must list every event the allowlist can emit. */
describe("privacy page event catalogue", () => {
  const html = renderToStaticMarkup(createElement(PrivacyRoute));
  const eventNames = Object.keys(EVENT_ALLOWLIST);

  it("has a non-empty allowlist to check", () => {
    expect(eventNames.length).toBeGreaterThan(20);
  });

  it.each(eventNames)("lists %s as a code element", (name) => {
    expect(html).toContain(`>${name}</code>`);
  });

  it("detects a missing event (guard against vacuous matching)", () => {
    expect(html).not.toContain(">not_a_real_event</code>");
  });
});
