"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE } from "@/i18n/messages";
import { useSettingsStore } from "@/stores/useSettingsStore";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function HtmlLangSetter() {
  const locale = useSettingsStore((s) => s.locale);
  const hydrated = useSettingsStore((s) => s.hydrated);

  useEffect(() => {
    // Before hydration `locale` is the default, which would clobber the
    // server-rendered lang and the cookie holding the user's saved choice.
    if (!hydrated) return;
    document.documentElement.lang = locale;
    // The server can't read IndexedDB; the cookie lets request.ts render the saved locale.
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available in all supported browsers.
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }, [locale, hydrated]);

  return null;
}
