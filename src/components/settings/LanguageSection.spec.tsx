/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HtmlLangSetter } from "@/components/layout/HtmlLangSetter";
import { LOCALE_COOKIE } from "@/i18n/messages";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { LanguageSection } from "./LanguageSection";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

function renderSection() {
  return render(
    <>
      <HtmlLangSetter />
      <LanguageSection />
    </>,
  );
}

async function chooseLanguage(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: label }));
}

function clearLocaleCookie() {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
}

beforeEach(() => {
  clearLocaleCookie();
  document.documentElement.lang = "en";
  useSettingsStore.setState({ locale: "en", hydrated: true });
});

afterEach(cleanup);

describe("LanguageSection", () => {
  it.each([
    ["Français", "fr"],
    ["日本語", "ja"],
  ] as const)("selecting %s sets locale and <html lang>", async (label, code) => {
    renderSection();
    await chooseLanguage(label);

    expect(useSettingsStore.getState().locale).toBe(code);
    expect(document.documentElement.lang).toBe(code);
  });

  it("persists the choice in a cookie the server can read after reload", async () => {
    renderSection();
    await chooseLanguage("Français");

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=fr`);
  });

  it("does not overwrite the saved cookie with the default before hydration", () => {
    document.cookie = `${LOCALE_COOKIE}=ja; path=/`;
    useSettingsStore.setState({ locale: "en", hydrated: false });
    renderSection();

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=ja`);
  });
});
