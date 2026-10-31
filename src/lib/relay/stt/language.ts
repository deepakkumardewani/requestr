import { SPEECH_LANG_BY_LOCALE } from "@/hooks/useSpeechDictation";

/** ISO-639-1 code for the app locale, or undefined so Grok auto-detects. */
export function toSttLanguage(locale: string): string | undefined {
  const tag = (SPEECH_LANG_BY_LOCALE as Record<string, string | undefined>)[
    locale
  ];
  return tag?.split("-")[0];
}
