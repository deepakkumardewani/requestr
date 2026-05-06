"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function HtmlLangSetter() {
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
