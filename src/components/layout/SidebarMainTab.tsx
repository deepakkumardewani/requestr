"use client";

import {
  FoldVertical,
  Globe2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UnfoldVertical,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChainList } from "@/components/chain/ChainList";
import { CollectionTree } from "@/components/collections/CollectionTree";
import { RequestItem } from "@/components/collections/RequestItem";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

function EnvSidebarList() {
  const t = useTranslations();
  const {
    environments,
    activeEnvId,
    hydrated,
    setActiveEnv,
    createEnv,
    deleteEnv,
  } = useEnvironmentsStore(
    useShallow((s) => ({
      environments: s.environments,
      activeEnvId: s.activeEnvId,
      hydrated: s.hydrated,
      setActiveEnv: s.setActiveEnv,
      createEnv: s.createEnv,
      deleteEnv: s.deleteEnv,
    })),
  );
  const { setEnvManagerOpen, isCreatingEnv, setIsCreatingEnv } = useUIStore(
    useShallow((s) => ({
      setEnvManagerOpen: s.setEnvManagerOpen,
      isCreatingEnv: s.isCreatingEnv,
      setIsCreatingEnv: s.setIsCreatingEnv,
    })),
  );
  const [newEnvName, setNewEnvName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const newEnvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCreatingEnv) return;
    const timer = setTimeout(() => newEnvInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [isCreatingEnv]);

  function handleConfirmDelete(envId: string) {
    if (activeEnvId === envId) setActiveEnv(null);
    deleteEnv(envId);
    setPendingDeleteId(null);
  }

  const pendingEnvName = environments.find(
    (e) => e.id === pendingDeleteId,
  )?.name;

  if (!hydrated && !isCreatingEnv) {
    return null;
  }

  return (
    <div className="space-y-0.5 py-1">
      {isCreatingEnv && (
        <div className="px-2 pb-1">
          <Input
            ref={newEnvInputRef}
            className="h-7 text-xs"
            value={newEnvName}
            placeholder={t("environment.namePlaceholder")}
            onChange={(e) => setNewEnvName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newEnvName.trim()) {
                createEnv(newEnvName.trim());
                setNewEnvName("");
                setIsCreatingEnv(false);
              }
              if (e.key === "Escape") {
                setNewEnvName("");
                setIsCreatingEnv(false);
              }
            }}
            onBlur={() => {
              setNewEnvName("");
              setIsCreatingEnv(false);
            }}
          />
        </div>
      )}

      {environments.length === 0 && !isCreatingEnv ? (
        <div className="px-2 py-4">
          <EmptyState
            title={t("navigation.noEnvironments")}
            description={t("navigation.noEnvironmentsDesc")}
          />
        </div>
      ) : (
        environments.map((env) => (
          <ContextMenu key={env.id}>
            <ContextMenuTrigger>
              <div
                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted ${
                  env.id === activeEnvId ? "text-theme-accent" : ""
                }`}
                onClick={() => {
                  setActiveEnv(env.id === activeEnvId ? null : env.id);
                  setEnvManagerOpen(true, env.id);
                }}
              >
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  {env.name}
                </span>
                {env.id === activeEnvId && (
                  <span className="text-xs font-medium text-theme-accent group-hover:hidden">
                    {t("environment.active")}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-foreground/10 dark:hover:bg-white/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEnvManagerOpen(true, env.id);
                      }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      {t("common.rename")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(env.id);
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setEnvManagerOpen(true, env.id)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {t("common.rename")}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setPendingDeleteId(env.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {t("common.delete")}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title={t("environment.deleteTitle")}
        description={t("environment.deleteDescription", {
          name: pendingEnvName ?? t("environment.deleteFallbackName"),
        })}
        confirmLabel={t("environment.deleteConfirm")}
        onConfirm={() =>
          pendingDeleteId && handleConfirmDelete(pendingDeleteId)
        }
      />
    </div>
  );
}

function PinnedSection() {
  const requests = useCollectionsStore((s) => s.requests);
  const pinnedRequestIds = useSettingsStore((s) => s.pinnedRequestIds);
  const activeRequestId = useTabsStore((s) => {
    const activeTab = s.tabs.find((t) => t.tabId === s.activeTabId);
    return activeTab?.requestId ?? null;
  });

  const pinnedRequests = pinnedRequestIds
    .map((id) => requests.find((r) => r.id === id))
    .filter(Boolean) as (typeof requests)[number][];

  if (pinnedRequests.length === 0) return null;

  return (
    <AccordionItem value="pinned" className="border-b border-border">
      <AccordionTrigger
        chevronLeft
        className="px-3 py-2.5 hover:no-underline hover:bg-muted/50"
      >
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pinned
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        <div className="pl-3 pr-1 py-1 space-y-0.5">
          {pinnedRequests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              isActive={activeRequestId === request.id}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function CollectionsSectionActions() {
  const t = useTranslations("navigation");
  const setIsCreatingCollection = useUIStore((s) => s.setIsCreatingCollection);
  const folders = useCollectionsStore((s) => s.folders);
  const collapsedFolderIds = useFolderExpandStore((s) => s.collapsedFolderIds);
  const toggleAll = useFolderExpandStore((s) => s.toggleAll);
  const allFolderIds = folders.map((f) => f.id);
  const allExpanded =
    allFolderIds.length > 0 &&
    allFolderIds.every((id) => !collapsedFolderIds.includes(id));

  return (
    <div className="ml-auto flex items-center gap-0.5">
      {allFolderIds.length > 0 && (
        <TooltipProvider delay={400}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    allExpanded ? "Collapse all folders" : "Expand all folders"
                  }
                  className="h-5 w-5 shrink-0 pointer-events-none opacity-0 transition-opacity group-hover/accordion-header:pointer-events-auto group-hover/accordion-header:opacity-100"
                  data-testid="toggle-all-folders-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAll(allFolderIds);
                  }}
                />
              }
            >
              {allExpanded ? (
                <FoldVertical className="h-3.5 w-3.5" />
              ) : (
                <UnfoldVertical className="h-3.5 w-3.5" />
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {allExpanded ? "Collapse all folders" : "Expand all folders"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("addCollection")}
        className="h-5 w-5 shrink-0 pointer-events-none opacity-0 transition-opacity group-hover/accordion-header:pointer-events-auto group-hover/accordion-header:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          setIsCreatingCollection(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

type SidebarMainTabProps = {
  isCreatingChain: boolean;
  onCreatingChainDone: () => void;
  onNewChain: () => void;
};

export const SIDEBAR_SECTIONS_STORAGE_KEY = "rq_sidebar_open_sections";
const DEFAULT_SECTIONS = ["pinned", "collections", "environments", "chains"];

function readStoredSections(): string[] {
  try {
    const stored = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : DEFAULT_SECTIONS;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

function persistSections(sections: string[]) {
  try {
    localStorage.setItem(
      SIDEBAR_SECTIONS_STORAGE_KEY,
      JSON.stringify(sections),
    );
  } catch (error) {
    // Private mode/quota: sections just won't persist, but leave a trace.
    console.warn("Failed to persist sidebar open sections", error);
  }
}

export function SidebarMainTab({
  isCreatingChain,
  onCreatingChainDone,
  onNewChain,
}: SidebarMainTabProps) {
  const t = useTranslations("navigation");
  const { setIsCreatingEnv, isCreatingCollection, isCreatingEnv } = useUIStore(
    useShallow((s) => ({
      setIsCreatingEnv: s.setIsCreatingEnv,
      isCreatingCollection: s.isCreatingCollection,
      isCreatingEnv: s.isCreatingEnv,
    })),
  );
  const hydrateChains = useChainStore((s) => s.hydrate);

  // Hydrate chains so the ChainList is populated on any page
  // that renders this sidebar (not just the chain page itself).
  useEffect(() => {
    hydrateChains();
  }, [hydrateChains]);

  const [openSections, setOpenSections] =
    useState<string[]>(readStoredSections);

  function handleSectionsChange(sections: string[]) {
    setOpenSections(sections);
    persistSections(sections);
  }

  // Functional update keeps this stable and independent of `openSections`,
  // so the effects below only re-run when their creation flag flips.
  const expandSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      if (prev.includes(section)) return prev;
      const next = [...prev, section];
      persistSections(next);
      return next;
    });
  }, []);

  // Auto-expand the relevant section when creation is triggered externally
  useEffect(() => {
    if (isCreatingCollection) expandSection("collections");
  }, [isCreatingCollection, expandSection]);

  useEffect(() => {
    if (isCreatingEnv) expandSection("environments");
  }, [isCreatingEnv, expandSection]);

  useEffect(() => {
    if (isCreatingChain) expandSection("chains");
  }, [isCreatingChain, expandSection]);

  return (
    <ScrollArea className="h-full">
      <Accordion
        multiple
        value={openSections}
        onValueChange={handleSectionsChange}
        className="w-full"
      >
        {/* Pinned requests */}
        <PinnedSection />

        {/* Collections */}
        <AccordionItem value="collections" className="border-b border-border">
          <AccordionTrigger
            chevronLeft
            className="hover:no-underline"
            action={<CollectionsSectionActions />}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("collections")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="pl-3 pr-1">
              <CollectionTree />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Environments */}
        <AccordionItem value="environments" className="border-b border-border">
          <AccordionTrigger
            chevronLeft
            className="hover:no-underline"
            action={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("addEnvironment")}
                className="ml-auto h-5 w-5 shrink-0 pointer-events-none opacity-0 transition-opacity group-hover/accordion-header:pointer-events-auto group-hover/accordion-header:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreatingEnv(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("environments")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="pl-3 pr-1">
              <EnvSidebarList />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Chains */}
        <AccordionItem
          value="chains"
          className="border-b-0"
          data-slot="chains-section"
        >
          <AccordionTrigger
            chevronLeft
            className="hover:no-underline"
            action={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("newChainAria")}
                className="ml-auto h-5 w-5 shrink-0 pointer-events-none opacity-0 transition-opacity group-hover/accordion-header:pointer-events-auto group-hover/accordion-header:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewChain();
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("chains")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="pl-3 pr-1">
              <ChainList
                isCreating={isCreatingChain}
                onCreatingDone={onCreatingChainDone}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </ScrollArea>
  );
}
