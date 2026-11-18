import enMessages from "../../messages/en";
import frMessages from "../../messages/fr";
import jaMessages from "../../messages/ja";

/** Single locale -> messages map shared by the React provider and store-level translators. */
export const MESSAGES = {
  en: enMessages,
  fr: frMessages,
  ja: jaMessages,
} as const;
