"use client";

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
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
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useFolderExpandStore } from "@/stores/useFolderExpandStore";
import type { CollectionFolderModel, RequestModel } from "@/types";
import { RequestItem } from "./RequestItem";

type CollectionRequestTreeProps = {
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  activeRequestId: string | null;
  renamingFolderId?: string | null;
  onStartRename?: (folderId: string) => void;
  onRenamingDone?: () => void;
};

type FolderNodeProps = {
  folder: CollectionFolderModel;
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  activeRequestId: string | null;
  depth: number;
  isExpanded: (folderId: string) => boolean;
  onToggle: (folderId: string) => void;
  renamingFolderId: string | null;
  onStartRename: (folderId: string) => void;
  onRenamingDone: () => void;
};

function countDescendantRequests(
  folderId: string,
  folders: CollectionFolderModel[],
  requests: RequestModel[],
): number {
  const childFolderIds = folders
    .filter((child) => child.parentFolderId === folderId)
    .map((child) => child.id);

  const direct = requests.filter(
    (request) => request.folderId === folderId,
  ).length;
  const nested = childFolderIds.reduce(
    (sum, childId) => sum + countDescendantRequests(childId, folders, requests),
    0,
  );

  return direct + nested;
}

function FolderNode({
  folder,
  folders,
  requests,
  activeRequestId,
  depth,
  isExpanded,
  onToggle,
  renamingFolderId,
  onStartRename,
  onRenamingDone,
}: FolderNodeProps) {
  const createFolder = useCollectionsStore((s) => s.createFolder);
  const renameFolder = useCollectionsStore((s) => s.renameFolder);
  const duplicateFolder = useCollectionsStore((s) => s.duplicateFolder);
  const deleteFolder = useCollectionsStore((s) => s.deleteFolder);
  const [editName, setEditName] = useState(folder.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const expanded = isExpanded(folder.id);
  const isEditing = renamingFolderId === folder.id;

  useEffect(() => {
    if (isEditing) setEditName(folder.name);
  }, [isEditing, folder.name]);

  const childFolders = folders
    .filter((child) => child.parentFolderId === folder.id)
    .sort((a, b) => a.order - b.order);
  const folderRequests = requests
    .filter((request) => request.folderId === folder.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  function handleNewSubfolder() {
    const created = createFolder(folder.collectionId, folder.id);
    setEditName(created.name);
    onStartRename(created.id);
    if (!expanded) onToggle(folder.id);
  }

  function commitRename(name: string) {
    const trimmed = name.trim() || folder.name;
    renameFolder(folder.id, trimmed);
    onRenamingDone();
  }

  const FolderIcon = expanded ? FolderOpen : Folder;

  const folderMenuItems = (
    <>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          handleNewSubfolder();
        }}
      >
        <FolderPlus className="mr-2 h-3.5 w-3.5" />
        New Folder
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          setEditName(folder.name);
          onStartRename(folder.id);
        }}
      >
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          duplicateFolder(folder.id);
        }}
      >
        <Copy className="mr-2 h-3.5 w-3.5" />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          setConfirmDeleteOpen(true);
        }}
      >
        <Trash2 className="mr-2 h-3.5 w-3.5" />
        Delete
      </DropdownMenuItem>
    </>
  );

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="button"
            tabIndex={0}
            className="group flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onToggle(folder.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onToggle(folder.id);
            }}
            data-testid={`folder-item-${folder.id}`}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {isEditing ? (
              <Input
                autoFocus
                className="h-5 flex-1 py-0 text-xs"
                value={editName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitRename(editName)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(editName);
                  if (e.key === "Escape") onRenamingDone();
                }}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {folder.name}
              </span>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">
              {countDescendantRequests(folder.id, folders, requests)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-foreground/10 dark:hover:bg-white/20"
                onClick={(e) => e.stopPropagation()}
                data-testid={`folder-more-btn-${folder.id}`}
              >
                <MoreHorizontal className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {folderMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleNewSubfolder}>
            <FolderPlus className="mr-2 h-3.5 w-3.5" />
            New Folder
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setEditName(folder.name);
              onStartRename(folder.id);
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => duplicateFolder(folder.id)}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && (
        <div className="space-y-0.5">
          {childFolders.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              folders={folders}
              requests={requests}
              activeRequestId={activeRequestId}
              depth={depth + 1}
              isExpanded={isExpanded}
              onToggle={onToggle}
              renamingFolderId={renamingFolderId}
              onStartRename={onStartRename}
              onRenamingDone={onRenamingDone}
            />
          ))}
          {folderRequests.map((request) => (
            <div
              key={request.id}
              style={{ paddingLeft: `${(depth + 1) * 12}px` }}
            >
              <RequestItem
                request={request}
                isActive={activeRequestId === request.id}
              />
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete folder?"
        description={`"${folder.name}" and all nested folders and requests will be permanently deleted.`}
        onConfirm={() => deleteFolder(folder.id)}
      />
    </div>
  );
}

export function CollectionRequestTree({
  folders,
  requests,
  activeRequestId,
  renamingFolderId: externalRenamingFolderId,
  onStartRename: externalOnStartRename,
  onRenamingDone: externalOnRenamingDone,
}: CollectionRequestTreeProps) {
  const collapsedFolderIds = useFolderExpandStore((s) => s.collapsedFolderIds);
  const toggle = useFolderExpandStore((s) => s.toggle);
  const isExpanded = (folderId: string) =>
    !collapsedFolderIds.includes(folderId);
  const [internalRenamingFolderId, setInternalRenamingFolderId] = useState<
    string | null
  >(null);

  const renamingFolderId = externalRenamingFolderId ?? internalRenamingFolderId;
  const onStartRename = externalOnStartRename ?? setInternalRenamingFolderId;
  const onRenamingDone =
    externalOnRenamingDone ?? (() => setInternalRenamingFolderId(null));

  const rootFolders = folders
    .filter((folder) => folder.parentFolderId === null)
    .sort((a, b) => a.order - b.order);
  const rootRequests = requests
    .filter((request) => !request.folderId)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (requests.length === 0) {
    return (
      <p className="py-1 text-center text-xs text-muted-foreground">
        No requests yet
      </p>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="space-y-0.5">
        {requests
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              isActive={activeRequestId === request.id}
            />
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          folders={folders}
          requests={requests}
          activeRequestId={activeRequestId}
          depth={0}
          isExpanded={isExpanded}
          onToggle={toggle}
          renamingFolderId={renamingFolderId}
          onStartRename={onStartRename}
          onRenamingDone={onRenamingDone}
        />
      ))}
      {rootRequests.map((request) => (
        <RequestItem
          key={request.id}
          request={request}
          isActive={activeRequestId === request.id}
        />
      ))}
    </div>
  );
}
