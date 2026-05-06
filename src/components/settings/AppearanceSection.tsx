"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { THEME_OPTIONS } from "@/app/settings/constants";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ACCENT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Props = {
  theme: string | undefined;
  onThemeChange: (theme: string) => void;
  accentColor: { r: number; g: number; b: number } | undefined;
  onAccentColorChange: (color: { r: number; g: number; b: number }) => void;
};

export function AppearanceSection({
  theme,
  onThemeChange,
  accentColor,
  onAccentColorChange,
}: Props) {
  const t = useTranslations("settings");

  return (
    <div className="max-w-lg space-y-8">
      <div className="space-y-6">
        <h2 className="text-base font-semibold">{t("appearance.title")}</h2>

        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = theme === value;
            return (
              <Card
                key={value}
                data-testid={`theme-${value}`}
                className={cn(
                  "cursor-pointer transition-[color,box-shadow,border-color] duration-200",
                  isActive
                    ? "border-theme-accent ring-2 ring-theme-accent/30"
                    : "hover:border-theme-accent/50",
                )}
                onClick={() => onThemeChange(value)}
              >
                <CardContent className="flex flex-col items-center gap-2 py-4">
                  <Icon
                    className={cn("h-6 w-6", isActive && "text-theme-accent")}
                  />
                  <span className="text-xs font-medium">{label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Accent Color</h2>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map(({ label, r, g, b }) => {
            const isActive =
              accentColor?.r === r &&
              accentColor?.g === g &&
              accentColor?.b === b;
            return (
              <Tooltip key={label}>
                <TooltipTrigger>
                  <button
                    type="button"
                    aria-label={`Theme accent ${label}`}
                    data-testid={`accent-${label.toLowerCase()}`}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-[color,box-shadow] duration-200",
                      isActive
                        ? "border-theme-accent ring-2 ring-theme-accent/30"
                        : "border-transparent hover:ring-2 hover:ring-theme-accent/20",
                    )}
                    style={{ backgroundColor: `rgb(${r},${g},${b})` }}
                    onClick={() => onAccentColorChange({ r, g, b })}
                  >
                    {isActive && (
                      <Check className="h-4 w-4 text-white drop-shadow-sm" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
