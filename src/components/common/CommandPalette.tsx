"use client";

import {
  ArrowDownToLineIcon,
  ArrowLeftRightIcon,
  GlobeIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MethodBadge } from "@/components/common/MethodBadge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { isRelayEnabled } from "@/lib/relay/flag";
import { truncateUrl } from "@/lib/utils";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

export function CommandPalette() {
  const router = useRouter();
  const tRelay = useTranslations("relay");
  const tShortcuts = useTranslations("shortcuts");
  const toggleRelay = useRelayStore((s) => s.toggle);
  const openRelay = useRelayStore((s) => s.setOpen);
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { collections, requests } = useCollectionsStore();
  const { entries } = useHistoryStore();
  const openTab = useTabsStore((s) => s.openTab);

  // Deduplicate history by method+url, keeping the most recent occurrence
  const uniqueHistory = entries
    .reduce<typeof entries>((acc, entry) => {
      const key = `${entry.method}:${entry.url}`;
      if (!acc.some((e) => `${e.method}:${e.url}` === key)) {
        acc.push(entry);
      }
      return acc;
    }, [])
    .slice(0, 20);

  function handleSelect(action: () => void) {
    setCommandPaletteOpen(false);
    action();
  }

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
    >
      <CommandInput placeholder="Search requests, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleSelect(() => openTab())}>
            <PlusIcon />
            <span>New Request</span>
            <CommandShortcut>⌃N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/environments"))}
          >
            <GlobeIcon />
            <span>Manage Environments</span>
            <CommandShortcut>⌃E</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/import"))}
          >
            <ArrowDownToLineIcon />
            <span>Import Collection</span>
            <CommandShortcut>⌃I</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/settings"))}
          >
            <SettingsIcon />
            <span>Open Settings</span>
            <CommandShortcut>⌃,</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/transform"))}
          >
            <WandSparklesIcon />
            <span>Transform Playground</span>
            <CommandShortcut>⌃⇧T</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push("/json-compare"))}
          >
            <ArrowLeftRightIcon />
            <span>Compare JSON</span>
            <CommandShortcut>⌃J</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {isRelayEnabled() && (
          <>
            <CommandSeparator />
            <CommandGroup heading={tRelay("title")}>
              <CommandItem onSelect={() => handleSelect(toggleRelay)}>
                <SparklesIcon />
                <span>{tShortcuts("relayOpen")}</span>
              </CommandItem>
              {/* Both open the dock until chat exists to start a thread or attach a chip. */}
              <CommandItem onSelect={() => handleSelect(() => openRelay(true))}>
                <SparklesIcon />
                <span>{tShortcuts("relayNewThread")}</span>
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => openRelay(true))}>
                <SparklesIcon />
                <span>{tShortcuts("relayAskRequest")}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Collections */}
        {requests.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Collections">
              {requests.slice(0, 30).map((req) => {
                const collection = collections.find(
                  (c) => c.id === req.collectionId,
                );
                return (
                  <CommandItem
                    key={req.id}
                    onSelect={() =>
                      handleSelect(() =>
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
                        }),
                      )
                    }
                  >
                    <MethodBadge method={req.method} className="mr-2" />
                    <span className="flex-1 truncate">{req.name}</span>
                    {collection && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {collection.name}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* History */}
        {uniqueHistory.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent History">
              {uniqueHistory.map((entry) => (
                <CommandItem
                  key={entry.id}
                  onSelect={() =>
                    handleSelect(() =>
                      openTab({
                        type: "http",
                        name: truncateUrl(entry.url, 30),
                        method: entry.method,
                        url: entry.url,
                        params: entry.request.params,
                        headers: entry.request.headers,
                        auth: entry.request.auth,
                        body: entry.request.body,
                        preScript: entry.request.preScript,
                        postScript: entry.request.postScript,
                      }),
                    )
                  }
                >
                  <MethodBadge method={entry.method} className="mr-2" />
                  <span className="flex-1 truncate font-mono text-xs">
                    {truncateUrl(entry.url, 50)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
