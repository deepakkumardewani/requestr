"use client";

import {
  Braces,
  FolderOpen,
  GitCompare,
  Globe,
  History,
  Network,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EnvManagerDialog } from "@/components/environment/EnvManagerDialog";
import { EnvSelector } from "@/components/environment/EnvSelector";
import { HistoryList } from "@/components/history/HistoryList";
import { HubTab } from "@/components/hub/HubTab";
import { ImportDialog } from "@/components/import/ImportDialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useJsonVisualizeStore } from "@/stores/useJsonVisualizeStore";
import { useUIStore } from "@/stores/useUIStore";
import { CreateNewDropdown } from "./CreateNewDropdown";
import { SidebarMainTab } from "./SidebarMainTab";
import { SidebarSearchInput, SidebarSearchResults } from "./SidebarSearch";

export function LeftPanel() {
  const t = useTranslations("tooltips");
  const [isCreatingChain, setIsCreatingChain] = useState(false);
  const [query, setQuery] = useState("");
  const { isImportOpen, setIsImportOpen } = useUIStore();
  const [activeTab, setActiveTab] = useState("collections");

  function handleQueryChange(q: string) {
    setQuery(q);
  }

  return (
    <>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-b from-accent/5 to-transparent px-3 pt-4 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center">
              <Image
                src="/logo.png"
                alt="Requestly Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="text-sm font-semibold">Requestr</span>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider delay={400}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("transformPlayground")}
                      nativeButton={false}
                      render={<Link href="/transform" />}
                    />
                  }
                >
                  <Braces className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("transformPlayground")}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("jsonCompare")}
                      nativeButton={false}
                      render={
                        <Link
                          href="/json-visualize"
                          onClick={() =>
                            useJsonVisualizeStore.getState().clear()
                          }
                        />
                      }
                    />
                  }
                >
                  <Network className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">JSON Visualize</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="JSON Compare"
                      nativeButton={false}
                      render={<Link href="/json-compare" />}
                    />
                  }
                >
                  <GitCompare className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("jsonCompare")}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("settings")}
                      data-testid="sidebar-settings-btn"
                      nativeButton={false}
                      render={<Link href="/settings" />}
                    />
                  }
                >
                  <Settings className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("settings")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Environment Selector */}
        <div className="px-3 pb-3">
          <EnvSelector />
        </div>

        <Separator />

        {/* Tabs + Search + Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Tab Triggers */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <TabsList variant="line" className="h-8 gap-0.5">
              <TooltipProvider delay={400}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        value="collections"
                        className="h-8 w-8 px-0"
                        aria-label={t("collections")}
                        data-testid="sidebar-tab-collections"
                      />
                    }
                  >
                    <FolderOpen className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t("collections")}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        value="history"
                        className="h-8 w-8 px-0"
                        aria-label={t("history")}
                        data-testid="sidebar-tab-history"
                      />
                    }
                  >
                    <History className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t("history")}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        value="hub"
                        className="h-8 w-8 px-0"
                        aria-label={t("apiHub")}
                      />
                    }
                  >
                    <Globe className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t("apiHub")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TabsList>
          </div>

          {/* Search + Plus row */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <SidebarSearchInput
              query={query}
              onQueryChange={handleQueryChange}
            />
            <CreateNewDropdown
              onNewChain={() => setIsCreatingChain(true)}
              onImport={() => setIsImportOpen(true)}
            />
          </div>

          {/* Content — on collections tab, query shows cross-resource search results;
               on history tab, query filters history inline (no separate results view) */}
          {query && activeTab === "collections" ? (
            <SidebarSearchResults query={query} onClose={() => setQuery("")} />
          ) : (
            <>
              <TabsContent
                value="collections"
                className="mt-0 min-h-0 flex-1 overflow-hidden"
              >
                <SidebarMainTab
                  isCreatingChain={isCreatingChain}
                  onCreatingChainDone={() => setIsCreatingChain(false)}
                  onNewChain={() => setIsCreatingChain(true)}
                />
              </TabsContent>

              <TabsContent
                value="history"
                className="mt-0 min-h-0 flex-1 overflow-hidden"
              >
                <HistoryList filter={query || undefined} />
              </TabsContent>

              <TabsContent
                value="hub"
                className="mt-0 min-h-0 flex-1 overflow-hidden"
              >
                <HubTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      <EnvManagerDialog />
      <ImportDialog
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </>
  );
}
