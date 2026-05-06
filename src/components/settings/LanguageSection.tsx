"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/useSettingsStore";

const LOCALE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
] as const;

export function LanguageSection() {
  const locale = useSettingsStore((s) => s.locale);
  const setSetting = useSettingsStore((s) => s.setSetting);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold">Language</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the display language for the application
        </p>
      </div>

      <Select
        value={locale}
        onValueChange={(value) =>
          setSetting("locale", value as "en" | "fr" | "ja")
        }
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {LOCALE_OPTIONS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
