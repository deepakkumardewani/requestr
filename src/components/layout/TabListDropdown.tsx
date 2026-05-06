"use client";

import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCloseTabGuard } from "@/hooks/useCloseTabGuard";
import { cn } from "@/lib/utils";
import { useTabsStore } from "@/stores/useTabsStore";

export function TabListDropdown() {
  const t = useTranslations("common");
  const tabsMenuId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { tabs, activeTabId, setActiveTab } = useTabsStore();
  const { handleCloseTab, handleCloseAll } = useCloseTabGuard();
  const fallbackName = t("newRequest");

  const filteredTabs = search.trim()
    ? tabs.filter((tab) =>
        (tab.name || fallbackName).toLowerCase().includes(search.toLowerCase()),
      )
    : tabs;

  function handleSelectTab(tabId: string) {
    setActiveTab(tabId);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        aria-label={t("showAllTabs")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={tabsMenuId}
        title={t("showAllTabs")}
        data-testid="tabs-overflow-btn"
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </PopoverTrigger>

      <PopoverContent
        id={tabsMenuId}
        align="end"
        sideOffset={4}
        className="w-72 p-0"
        data-testid="tabs-popover-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("openedTabs", { count: tabs.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              handleCloseAll();
              setOpen(false);
            }}
          >
            <X className="h-3 w-3" />
            {t("closeAllShort")}
          </Button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-2 py-2">
          <Input
            placeholder={t("searchTabs")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
            autoFocus
            data-testid="tabs-search-input"
            aria-label={t("searchTabs")}
          />
        </div>

        {/* Tab rows */}
        <div className="max-h-80 overflow-y-auto">
          {filteredTabs.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t("noTabsFound")}
            </p>
          ) : (
            filteredTabs.map((tab) => {
              const isActive = tab.tabId === activeTabId;
              const name = tab.name || fallbackName;

              return (
                <div
                  key={tab.tabId}
                  role="button"
                  tabIndex={0}
                  data-testid="tab-list-item"
                  onClick={() => handleSelectTab(tab.tabId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectTab(tab.tabId);
                    }
                  }}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between px-3 py-2 text-sm rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-muted/60 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="flex-1 truncate">{name}</span>

                  {/* Status area: dot when dirty, close on hover */}
                  <div className="relative ml-2 h-4 w-4 shrink-0">
                    {tab.isDirty && (
                      <span className="absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      </span>
                    )}
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(tab);
                      }}
                      aria-label={`Close ${name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
