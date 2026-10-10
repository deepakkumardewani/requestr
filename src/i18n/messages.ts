import enMessages from "../../messages/en";
import frMessages from "../../messages/fr";
import jaMessages from "../../messages/ja";

/** Single locale -> messages map shared by the React provider and store-level translators. */
export const MESSAGES = {
  en: enMessages,
  fr: frMessages,
  ja: jaMessages,
} as const;

export type Locale = keyof typeof MESSAGES;

/** Cookie that mirrors the client-side locale setting so the server can render the same locale. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(MESSAGES, value);
}
