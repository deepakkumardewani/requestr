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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  actionsFor,
  CAPABILITY_CATEGORIES,
  type CapabilityAction,
  type CapabilityBadge,
  type CapabilityCategoryEntry,
  type CapabilityExample,
  type CapabilityIcon,
  capabilityBadge,
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

const CAUTION_BADGE_CLASS = "border-warning/40 bg-warning/10 text-warning";

/** Runs directly reads neutral; anything that asks first gets the caution tone. */
const BADGE_CLASS: Record<CapabilityBadge, string> = {
  runs: "",
  asks: CAUTION_BADGE_CLASS,
  asksBulk: CAUTION_BADGE_CLASS,
};

/** Keeps the popover usable on short viewports: the tab body scrolls, the footer stays. */
const SCROLL_REGION_CLASS = "max-h-96 overflow-y-auto";

export type CapabilitiesPanelProps = {
  variant: "popover" | "empty";
  onStarter: (example: CapabilityExample) => void;
  /** Footer link of the popover variant. */
  onChangeMode?: () => void;
};

export function CapabilitiesPanel({
  variant,
  onStarter,
  onChangeMode,
}: CapabilitiesPanelProps) {
  if (variant === "empty") return <StarterGrid onStarter={onStarter} />;
  return <PopoverPanel onStarter={onStarter} onChangeMode={onChangeMode} />;
}

type StarterProps = Pick<CapabilitiesPanelProps, "onStarter">;

function PopoverPanel({
  onStarter,
  onChangeMode,
}: StarterProps & Pick<CapabilitiesPanelProps, "onChangeMode">) {
  const t = useTranslations("relay");
  return (
    <div
      data-testid="relay-capabilities-panel"
      data-variant="popover"
      className="flex min-h-0 flex-col"
    >
      <Tabs defaultValue="can" className="min-h-0 gap-0">
        <TabsList variant="line" className="w-full border-b px-2">
          <TabsTrigger value="can" data-testid="relay-capability-tab-can">
            {t("capabilities.tab.can")}
          </TabsTrigger>
          <TabsTrigger value="see" data-testid="relay-capability-tab-see">
            {t("capabilities.tab.see")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="can" className={cn(SCROLL_REGION_CLASS, "p-2")}>
          <div className="flex flex-col gap-4">
            {CAPABILITY_CATEGORIES.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                onStarter={onStarter}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="see" className={SCROLL_REGION_CLASS}>
          <CapabilitySeeList />
        </TabsContent>
      </Tabs>
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

type CategoryProps = StarterProps & { category: CapabilityCategoryEntry };

function CategorySection({ category, onStarter }: CategoryProps) {
  const t = useTranslations("relay");
  const Icon = ICONS[category.icon];
  return (
    <section
      data-testid={`relay-capability-category-${category.id}`}
      aria-label={t(category.titleKey)}
      className="flex flex-col gap-1"
    >
      <h4 className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        {t(category.titleKey)}
      </h4>
      <p className="px-1 text-xs text-muted-foreground">
        {t(category.descriptionKey)}
      </p>
      <StarterList examples={category.examples} onStarter={onStarter} />
      <ul className="flex flex-col gap-1 px-1 pt-1">
        {actionsFor(category.id).map((action) => (
          <ActionLine key={action.id} action={action} />
        ))}
      </ul>
    </section>
  );
}

type StarterListProps = StarterProps & {
  examples: readonly CapabilityExample[];
};

function StarterList({ examples, onStarter }: StarterListProps) {
  const t = useTranslations("relay");
  return (
    <ul className="flex flex-col gap-0.5">
      {examples.map((example) => (
        <li key={example.id}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="relay-capability-starter"
            data-example={example.id}
            className="h-auto w-full justify-start py-1.5 text-left font-normal whitespace-normal"
            onClick={() => onStarter(example)}
          >
            {t(example.promptKey)}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ActionLine({ action }: { action: CapabilityAction }) {
  const t = useTranslations("relay");
  const mode = useRelayPermissionStore((s) => s.mode);
  const badge = capabilityBadge(action.tools, mode);
  return (
    <li
      data-testid="relay-capability-action"
      className="flex items-start justify-between gap-2 text-xs text-muted-foreground"
    >
      <span className="min-w-0">{t(action.labelKey)}</span>
      <Badge
        variant="outline"
        data-testid="relay-capability-badge"
        data-badge={badge}
        className={cn("h-auto whitespace-normal", BADGE_CLASS[badge])}
      >
        {t(`capabilities.badge.${badge}`)}
      </Badge>
    </li>
  );
}

/** Empty-state layout: every category's starters at a glance, no tabs and no see list. */
function StarterGrid({ onStarter }: StarterProps) {
  const t = useTranslations("relay");
  return (
    <div
      data-testid="relay-capabilities-panel"
      data-variant="empty"
      className="flex w-full flex-col gap-3 text-left"
    >
      {CAPABILITY_CATEGORIES.map((category) => {
        const Icon = ICONS[category.icon];
        return (
          <section
            key={category.id}
            data-testid={`relay-capability-category-${category.id}`}
            aria-label={t(category.titleKey)}
            className="flex flex-col gap-1"
          >
            <h4 className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
              <Icon aria-hidden className="size-3.5" />
              {t(category.titleKey)}
            </h4>
            <StarterList examples={category.examples} onStarter={onStarter} />
          </section>
        );
      })}
    </div>
  );
}
