"use client";

import { Clock, FolderOpen, Plus } from "lucide-react";
import { MethodBadge } from "@/components/common/MethodBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, generateId, getRelativeTime } from "@/lib/utils";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { HistoryEntry, HttpMethod } from "@/types";
import type { ChainHistoryNode } from "@/types/chain";

type ApiPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  onAddRequest: (requestId: string) => void;
  onAddHistoryNode: (node: ChainHistoryNode) => void;
  alreadyAddedIds: Set<string>;
};

function historyEntryToChainNode(entry: HistoryEntry): ChainHistoryNode {
  let name: string;
  try {
    const segments = new URL(entry.url).pathname.split("/").filter(Boolean);
    name = segments.at(-1) ?? entry.url;
  } catch {
    name = entry.url;
  }
  return {
    id: generateId(),
    historyEntryId: entry.id,
    name,
    method: entry.method,
    url: entry.request.url,
    params: entry.request.params,
    headers: entry.request.headers,
    auth: entry.request.auth,
    body: entry.request.body,
  };
}

type RequestRowProps = {
  requestId: string;
  method: HttpMethod;
  name: string;
  url: string;
  isAdded: boolean;
  onAdd: () => void;
};

function RequestRow({ method, name, url, isAdded, onAdd }: RequestRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-muted/80 transition-colors group",
        isAdded && "opacity-50 pointer-events-none",
      )}
      onClick={isAdded ? undefined : onAdd}
    >
      <MethodBadge method={method} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[13px] font-medium truncate text-foreground/90 leading-tight mb-0.5">
          {name}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono truncate leading-tight">
          {url}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isAdded ? (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Added
          </span>
        ) : (
          <div className="h-6 w-6 rounded flex items-center justify-center bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground transition-[color,background-color,transform] duration-200">
            <Plus className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}

type HistoryRowProps = {
  entry: HistoryEntry;
  isAdded: boolean;
  onAdd: () => void;
};

function HistoryRow({ entry, isAdded, onAdd }: HistoryRowProps) {
  const statusColor =
    entry.status >= 200 && entry.status < 300
      ? "text-emerald-500"
      : entry.status >= 400
        ? "text-red-500"
        : "text-amber-500";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-muted/80 transition-colors group",
        isAdded && "opacity-50 pointer-events-none",
      )}
      onClick={isAdded ? undefined : onAdd}
    >
      <MethodBadge method={entry.method} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[13px] font-mono truncate text-foreground/90 leading-tight mb-0.5">
          {entry.url}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={cn(
              "text-[11px] font-medium font-mono leading-none",
              statusColor,
            )}
          >
            {entry.status} {entry.response?.statusText || ""}
          </span>
          <span className="text-[11px] text-muted-foreground/40 leading-none">
            •
          </span>
          <span className="text-[11px] text-muted-foreground leading-none">
            {getRelativeTime(entry.timestamp)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isAdded ? (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Added
          </span>
        ) : (
          <div className="h-6 w-6 rounded flex items-center justify-center bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground transition-[color,background-color,transform] duration-200">
            <Plus className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function ApiPickerDialog({
  open,
  onClose,
  onAddRequest,
  onAddHistoryNode,
  alreadyAddedIds,
}: ApiPickerDialogProps) {
  const { collections, requests } = useCollectionsStore();
  const { entries: historyEntries } = useHistoryStore();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="api-picker-dialog"
        className="max-w-[calc(100%-2rem)] sm:max-w-3xl p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Add API Request
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="collections" className="flex flex-col">
          <div className="px-6 border-b">
            <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 gap-6">
              <TabsTrigger
                value="collections"
                className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Collections
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="relative h-10 rounded-none border-b-2 border-b-transparent bg-transparent px-0 pb-3 pt-2 text-sm font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                History
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="collections" className="mt-0 outline-none">
            <ScrollArea className="h-[420px] px-3 py-3">
              {collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <FolderOpen className="h-6 w-6 opacity-50" />
                  </div>
                  <p className="text-sm">No collections yet</p>
                </div>
              ) : (
                <Accordion
                  multiple
                  defaultValue={collections.map((c) => c.id)}
                  className="w-full space-y-2 pr-3"
                >
                  {collections.map((collection) => {
                    const collectionRequests = requests.filter(
                      (r) => r.collectionId === collection.id,
                    );
                    return (
                      <AccordionItem
                        key={collection.id}
                        value={collection.id}
                        className="border-none"
                      >
                        <AccordionTrigger className="px-3 py-2 text-[13px] font-semibold hover:no-underline hover:bg-muted/50 rounded-md transition-colors">
                          <div className="flex items-center gap-2.5">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <span>{collection.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">
                              {collectionRequests.length}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-1 pl-4 pr-1 pt-1">
                          {collectionRequests.length === 0 ? (
                            <p className="px-3 py-3 text-[12px] text-muted-foreground italic">
                              No requests inside this collection
                            </p>
                          ) : (
                            <div className="space-y-1 mt-1 border-l-2 border-muted/50 pl-2">
                              {collectionRequests.map((req) => (
                                <RequestRow
                                  key={req.id}
                                  requestId={req.id}
                                  method={req.method}
                                  name={req.name}
                                  url={req.url}
                                  isAdded={alreadyAddedIds.has(req.id)}
                                  onAdd={() => onAddRequest(req.id)}
                                />
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-0 outline-none">
            <ScrollArea className="h-[420px] px-3 py-3">
              {historyEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <Clock className="h-6 w-6 opacity-50" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">No history yet</p>
                    <p className="text-xs opacity-70">
                      Run some requests first to see them here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 pr-3">
                  {historyEntries.map((entry) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      isAdded={alreadyAddedIds.has(entry.id)}
                      onAdd={() =>
                        onAddHistoryNode(historyEntryToChainNode(entry))
                      }
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
