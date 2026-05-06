"use client";

import { FolderOpen, GitBranch, Globe2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MethodBadge } from "@/components/common/MethodBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useStandaloneChainStore } from "@/stores/useStandaloneChainStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel } from "@/types";

type SidebarSearchInputProps = {
  query: string;
  onQueryChange: (q: string) => void;
};

export function SidebarSearchInput({
  query,
  onQueryChange,
}: SidebarSearchInputProps) {
  const t = useTranslations("navigation");

  return (
    <div className="relative flex-1">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        className="h-8 pl-8 pr-7 text-xs"
        placeholder={t("search")}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {query && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2"
          onClick={() => onQueryChange("")}
          aria-label={t("clearSearch")}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

type SidebarSearchResultsProps = {
  query: string;
  onClose: () => void;
};

export function SidebarSearchResults({
  query,
  onClose,
}: SidebarSearchResultsProps) {
  const router = useRouter();
  const t = useTranslations("navigation");
  const ct = useTranslations("common");
  const { requests, collections } = useCollectionsStore();
  const { environments } = useEnvironmentsStore();
  const { chains } = useStandaloneChainStore();
  const { openTab, tabs, setActiveTab } = useTabsStore();
  const { setEnvManagerOpen } = useUIStore();

  const term = query.toLowerCase();

  const matchedRequests = requests.filter(
    (r) =>
      r.name.toLowerCase().includes(term) || r.url.toLowerCase().includes(term),
  );

  const matchedEnvironments = environments.filter((e) =>
    e.name.toLowerCase().includes(term),
  );

  const chainList = Object.values(chains);
  const matchedChains = chainList.filter((c) =>
    c.name.toLowerCase().includes(term),
  );

  const hasResults =
    matchedRequests.length > 0 ||
    matchedEnvironments.length > 0 ||
    matchedChains.length > 0;

  function getCollectionName(req: RequestModel) {
    return collections.find((c) => c.id === req.collectionId)?.name ?? "";
  }

  function handleOpenRequest(req: RequestModel) {
    const existing = tabs.find((t) => t.requestId === req.id);
    if (existing) {
      setActiveTab(existing.tabId);
    } else {
      openTab({
        type: "http",
        requestId: req.id,
        name: req.name,
        method: req.method,
        url: req.url,
        params: req.params,
        headers: req.headers,
        auth: req.auth,
        body: req.body,
        preScript: req.preScript,
        postScript: req.postScript,
        isDirty: false,
      });
    }
    onClose();
  }

  return (
    <ScrollArea className="flex-1">
      <div className="py-2">
        {!hasResults && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {ct("noResults", { query })}
          </p>
        )}

        {matchedRequests.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
              <FolderOpen className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("requests")}
              </span>
            </div>
            {matchedRequests.map((req) => (
              <button
                key={req.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left"
                onClick={() => handleOpenRequest(req)}
              >
                <MethodBadge method={req.method} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{req.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {getCollectionName(req)}
                  </p>
                </div>
              </button>
            ))}
          </section>
        )}

        {matchedEnvironments.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
              <Globe2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("environments")}
              </span>
            </div>
            {matchedEnvironments.map((env) => (
              <button
                key={env.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left"
                onClick={() => {
                  setEnvManagerOpen(true, env.id);
                  onClose();
                }}
              >
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs">{env.name}</span>
              </button>
            ))}
          </section>
        )}

        {matchedChains.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("chains")}
              </span>
            </div>
            {matchedChains.map((chain) => (
              <button
                key={chain.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left"
                onClick={() => {
                  router.push(`/chain/${chain.id}`);
                  onClose();
                }}
              >
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs">{chain.name}</span>
              </button>
            ))}
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
