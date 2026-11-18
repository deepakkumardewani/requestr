"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PICKER_TABS, type PickerTab } from "@/stores/useUIStore";

const TAB_LABEL_KEYS = {
  collections: "apiPickerTabCollections",
  history: "apiPickerTabHistory",
  new: "apiPickerTabNew",
} as const satisfies Record<PickerTab, string>;

type PickerTabsProps = {
  value: PickerTab;
  onValueChange: (tab: PickerTab) => void;
  /** `TabsContent` panels owned by the shell. */
  children: ReactNode;
};

function isPickerTab(value: unknown): value is PickerTab {
  return PICKER_TABS.some((tab) => tab === value);
}

/** Line-variant tab strip; labels stay visible at every width and arrow keys switch tabs (base-ui). */
export function PickerTabs({
  value,
  onValueChange,
  children,
}: PickerTabsProps) {
  const t = useTranslations("chain");

  return (
    <Tabs
      value={value}
      onValueChange={(next) => isPickerTab(next) && onValueChange(next)}
      className="min-h-0 min-w-0 flex-1 gap-0"
    >
      <div className="min-w-0 border-b px-4 sm:px-6">
        <TabsList
          variant="line"
          activateOnFocus
          className="w-full justify-start"
        >
          {PICKER_TABS.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              data-testid={`picker-tab-${tab}`}
              className="flex-none px-3"
            >
              {t(TAB_LABEL_KEYS[tab])}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
