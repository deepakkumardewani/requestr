"use client";

import {
  Download,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { downloadPostmanCollection } from "@/lib/postmanExporter";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import { CollectionRequestTree } from "./CollectionRequestTree";

export function CollectionTree() {
  const {
    collections,
    folders,
    requests,
    hydrated,
    createCollection,
    createFolder,
    renameCollection,
    deleteCollection,
  } = useCollectionsStore();
  const activeRequestId = useTabsStore((s) => {
    const activeTab = s.tabs.find((t) => t.tabId === s.activeTabId);
    return activeTab?.requestId ?? null;
  });

  const { isCreatingCollection, setIsCreatingCollection, setIsImportOpen } =
    useUIStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const newCollectionInputRef = useRef<HTMLInputElement>(null);

  // autoFocus won't work when the accordion is animating open (overflow:hidden).
  // Defer focus to after the animation completes.
  useEffect(() => {
    if (!isCreatingCollection) return;
    const timer = setTimeout(() => newCollectionInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [isCreatingCollection]);

  // Mirror ChainList's guard: don't hide the tree while IDB hydration is
  // still in flight if the user has already asked to create a collection, or
  // already has a collection in memory — otherwise a collection created just
  // before hydration resolves gets hidden the instant `isCreatingCollection`
  // flips back to false (the tree unmounts until hydrate() finally settles),
  // which can outlast a caller's visibility assertion.
  if (!hydrated && !isCreatingCollection && collections.length === 0) {
    return null;
  }

  if (collections.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-2 py-6">
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No collections yet"
          description="Organize requests by creating collections"
          className="py-0"
          action={
            !isCreatingCollection ? (
              <div className="flex flex-col gap-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingCollection(true)}
                  className="w-full"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Collection
                </Button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 py-1"
                >
                  Import
                </button>
              </div>
            ) : undefined
          }
        />
        {isCreatingCollection && (
          <Input
            ref={newCollectionInputRef}
            className="h-7 w-full text-xs"
            value={newCollectionName}
            placeholder="Collection name"
            data-testid="new-collection-name-input"
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCollectionName.trim()) {
                createCollection(newCollectionName.trim());
                setNewCollectionName("");
                setIsCreatingCollection(false);
              }
              if (e.key === "Escape") setIsCreatingCollection(false);
            }}
            onBlur={() => setIsCreatingCollection(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="py-1">
      {isCreatingCollection && (
        <div className="px-2 pb-1">
          <Input
            ref={newCollectionInputRef}
            className="h-7 text-xs"
            value={newCollectionName}
            placeholder="Collection name"
            data-testid="new-collection-name-input"
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCollectionName.trim()) {
                createCollection(newCollectionName.trim());
                setNewCollectionName("");
                setIsCreatingCollection(false);
              }
              if (e.key === "Escape") setIsCreatingCollection(false);
            }}
            onBlur={() => setIsCreatingCollection(false)}
          />
        </div>
      )}

      <Accordion multiple className="w-full">
        {collections.map((collection) => {
          const collectionRequests = requests.filter(
            (r) => r.collectionId === collection.id,
          );

          return (
            <AccordionItem
              key={collection.id}
              value={collection.id}
              className="border-none"
              data-testid={`collection-item-${collection.id}`}
            >
              <ContextMenu>
                <ContextMenuTrigger>
                  <AccordionTrigger
                    chevronLeft
                    className="flex-1 rounded px-2 py-1.5 hover:bg-muted hover:no-underline cursor-pointer"
                    action={
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 pointer-events-none transition-opacity group-hover/accordion-header:opacity-100 group-hover/accordion-header:pointer-events-auto hover:bg-foreground/10 dark:hover:bg-white/20"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`collection-more-btn-${collection.id}`}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              const created = createFolder(collection.id);
                              setRenamingFolderId(created.id);
                            }}
                          >
                            <FolderPlus className="mr-2 h-3.5 w-3.5" />
                            New Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            data-testid="collection-rename-btn"
                            onClick={() => {
                              setEditName(collection.name);
                              setEditingId(collection.id);
                            }}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              downloadPostmanCollection(
                                collection,
                                collectionRequests,
                                folders.filter(
                                  (folder) =>
                                    folder.collectionId === collection.id,
                                ),
                              )
                            }
                          >
                            <Download className="mr-2 h-3.5 w-3.5" />
                            Export as Postman
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            data-testid="collection-delete-btn"
                            onClick={() => setPendingDeleteId(collection.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {editingId === collection.id ? (
                        <Input
                          autoFocus
                          className="h-5 py-0 text-xs"
                          value={editName}
                          data-testid="collection-rename-input"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              renameCollection(
                                collection.id,
                                editName.trim() || collection.name,
                              );
                              setEditingId(null);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => {
                            renameCollection(
                              collection.id,
                              editName.trim() || collection.name,
                            );
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <span
                          className="text-sm font-medium text-foreground"
                          data-testid={`collection-name-${collection.id}`}
                        >
                          {collection.name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {collectionRequests.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => {
                      const created = createFolder(collection.id);
                      setRenamingFolderId(created.id);
                    }}
                  >
                    <FolderPlus className="mr-2 h-3.5 w-3.5" />
                    New Folder
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setEditName(collection.name);
                      setEditingId(collection.id);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() =>
                      downloadPostmanCollection(
                        collection,
                        collectionRequests,
                        folders.filter(
                          (folder) => folder.collectionId === collection.id,
                        ),
                      )
                    }
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export as Postman
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setPendingDeleteId(collection.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <AccordionContent className="pb-1 pl-3 pr-1">
                <CollectionRequestTree
                  folders={folders.filter(
                    (folder) => folder.collectionId === collection.id,
                  )}
                  requests={collectionRequests}
                  activeRequestId={activeRequestId}
                  renamingFolderId={renamingFolderId}
                  onStartRename={setRenamingFolderId}
                  onRenamingDone={() => setRenamingFolderId(null)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Collection"
        description={`"${collections.find((c) => c.id === pendingDeleteId)?.name ?? "This collection"}" and all its requests will be permanently deleted.`}
        confirmLabel="Yes, delete collection"
        onConfirm={() => {
          if (pendingDeleteId) deleteCollection(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
