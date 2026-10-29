"use client";

import {
  ArrowLeftRightIcon,
  BookOpenIcon,
  FolderTreeIcon,
  type LucideIcon,
  PencilIcon,
  PlayIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CAPABILITY_CATEGORIES,
  type CapabilityBadge,
  type CapabilityCategoryEntry,
  type CapabilityIcon,
  categoryBadge,
} from "@/lib/relay/capabilities";
import { cn } from "@/lib/utils";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { CapabilitySeeList } from "./CapabilitySeeList";

const ICONS: Record<CapabilityIcon, LucideIcon> = {
  "book-open": BookOpenIcon,
  pencil: PencilIcon,
  play: PlayIcon,
  "folder-tree": FolderTreeIcon,
  "arrow-left-right": ArrowLeftRightIcon,
};

/** Both approval markers read as caution; areas that run directly show none. */
const MARKER_CLASS = "border-warning/40 bg-warning/10 text-warning";

/** Keeps the popover usable on short viewports: only the list scrolls, the footer stays. */
const SCROLL_REGION_CLASS = "max-h-96 overflow-y-auto";

export type CapabilitiesPanelProps = {
  onChangeMode: () => void;
};

/** One calm list of what Relay can do, what it can see, and a way to change approvals (EMPTY-03). */
export function CapabilitiesPanel({ onChangeMode }: CapabilitiesPanelProps) {
  const t = useTranslations("relay");
  return (
    <div
      data-testid="relay-capabilities-panel"
      className="flex min-h-0 flex-col"
    >
      <ul
        data-testid="relay-capability-list"
        // Focusable so the keyboard can scroll a list that overflows.
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region
        tabIndex={0}
        aria-label={t("capabilities.title")}
        className={cn(SCROLL_REGION_CLASS, "flex flex-col gap-3 p-3")}
      >
        {CAPABILITY_CATEGORIES.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </ul>
      <CapabilitySeeList />
      <div className="border-t p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          data-testid="relay-capability-change-mode"
          onClick={onChangeMode}
        >
          {t("capabilities.changeMode")}
        </Button>
      </div>
    </div>
  );
}

function CategoryRow({ category }: { category: CapabilityCategoryEntry }) {
  const t = useTranslations("relay");
  const mode = useRelayPermissionStore((s) => s.mode);
  const Icon = ICONS[category.icon];
  const badge = categoryBadge(category, mode);
  return (
    <li
      data-testid={`relay-capability-category-${category.id}`}
      className="flex items-start gap-2"
    >
      <Icon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {t(category.titleKey)}
          {badge === "runs" ? null : <AsksFirstMarker badge={badge} />}
        </span>
        <span className="text-xs text-muted-foreground">
          {t(category.descriptionKey)}
        </span>
      </div>
    </li>
  );
}

function AsksFirstMarker({
  badge,
}: {
  badge: Exclude<CapabilityBadge, "runs">;
}) {
  const t = useTranslations("relay");
  return (
    <Badge
      variant="outline"
      data-testid="relay-capability-marker"
      data-badge={badge}
      className={cn("h-auto whitespace-normal font-normal", MARKER_CLASS)}
    >
      {t(`capabilities.marker.${badge}`)}
    </Badge>
  );
}
