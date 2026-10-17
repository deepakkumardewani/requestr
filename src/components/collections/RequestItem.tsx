"use client";

import {
  Code2,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Terminal,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { HealthDot } from "@/components/collections/HealthDot";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { MethodBadge } from "@/components/common/MethodBadge";
import { CodeGenDialog } from "@/components/request/CodeGenDialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { generateCurl } from "@/lib/curlGenerator";
import { downloadPostmanRequest } from "@/lib/postmanExporter";
import { requestModelToHttpTab } from "@/lib/requestModelToTab";
import { generateId } from "@/lib/utils";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HttpTab, RequestModel } from "@/types";

type RequestItemProps = {
  request: RequestModel;
  isActive: boolean;
};

export function RequestItem({ request, isActive }: RequestItemProps) {
  const t = useTranslations("common");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(request.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [codeGenOpen, setCodeGenOpen] = useState(false);

  const openTabForRequest = useTabsStore((s) =>
    s.tabs.find((t) => t.requestId === request.id),
  );
  const openTab = useTabsStore((s) => s.openTab);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const updateTabState = useTabsStore((s) => s.updateTabState);
  const updateRequest = useCollectionsStore((s) => s.updateRequest);
  const deleteRequest = useCollectionsStore((s) => s.deleteRequest);
  const addRequest = useCollectionsStore((s) => s.addRequest);
  const showHealthMonitor = useSettingsStore((s) => s.showHealthMonitor);
  const pinnedRequestIds = useSettingsStore((s) => s.pinnedRequestIds);
  const pinRequest = useSettingsStore((s) => s.pinRequest);
  const unpinRequest = useSettingsStore((s) => s.unpinRequest);

  const isPinned = pinnedRequestIds.includes(request.id);
  const codeGenTab = requestModelToHttpTab(request);

  function handleOpen() {
    if (isEditing) return;
    if (openTabForRequest) {
      setActiveTab(openTabForRequest.tabId);
      return;
    }
    openTab({
      type: "http",
      requestId: request.id,
      name: request.name,
      method: request.method,
      url: request.url,
      params: request.params,
      headers: request.headers,
      auth: request.auth,
      body: request.body,
      preScript: request.preScript,
      postScript: request.postScript,
      timeoutMs: request.timeoutMs,
      assertions: request.assertions,
      sslVerify: request.sslVerify,
      followRedirects: request.followRedirects,
      isDirty: false,
    });
  }

  function handleRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== request.name) {
      updateRequest(request.id, { name: trimmed });
      if (openTabForRequest) {
        updateTabState(openTabForRequest.tabId, {
          name: trimmed,
          isDirty: openTabForRequest.isDirty,
        });
      }
    }
    setIsEditing(false);
  }

  function handleDuplicate() {
    const duplicateTab: HttpTab = {
      tabId: generateId(),
      requestId: null,
      name: `${request.name} (copy)`,
      isDirty: false,
      type: "http",
      method: request.method,
      url: request.url,
      params: request.params,
      headers: request.headers,
      auth: request.auth,
      body: request.body,
      preScript: request.preScript,
      postScript: request.postScript,
      timeoutMs: request.timeoutMs,
      assertions: request.assertions,
    };
    addRequest(request.collectionId, duplicateTab, request.folderId);
  }

  async function handleCopyAsCurl() {
    const curl = generateCurl(codeGenTab);
    try {
      await navigator.clipboard.writeText(curl);
      toast.success("cURL copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  function handleGenerateCode() {
    setCodeGenOpen(true);
  }

  function handleExportPostman() {
    downloadPostmanRequest(request);
  }

  const exportItems = (
    <>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          handleGenerateCode();
        }}
      >
        <Code2 className="mr-2 h-3.5 w-3.5" />
        Generate Code
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          void handleCopyAsCurl();
        }}
      >
        <Terminal className="mr-2 h-3.5 w-3.5" />
        {t("copyAsCurl")}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          handleExportPostman();
        }}
      >
        <Download className="mr-2 h-3.5 w-3.5" />
        Export as Postman
      </DropdownMenuItem>
    </>
  );

  const actionItems = (
    <>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          isPinned ? unpinRequest(request.id) : pinRequest(request.id);
        }}
      >
        {isPinned ? (
          <>
            <PinOff className="mr-2 h-3.5 w-3.5" />
            Unpin
          </>
        ) : (
          <>
            <Pin className="mr-2 h-3.5 w-3.5" />
            Pin to top
          </>
        )}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          handleDuplicate();
        }}
      >
        <Copy className="mr-2 h-3.5 w-3.5" />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem
        data-testid="request-rename-btn"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Rename
      </DropdownMenuItem>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          role="button"
          tabIndex={0}
          data-testid="request-item"
          className={`group flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors cursor-pointer ${
            isActive
              ? "border-l-2 border-l-theme-accent bg-theme-accent/10 pl-[calc(0.5rem-2px)]"
              : "hover:bg-muted"
          }`}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleOpen();
          }}
        >
          <MethodBadge method={request.method} />

          {isEditing ? (
            <Input
              className="h-5 flex-1 py-0 text-xs"
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate text-sm">{request.name}</span>
          )}

          {showHealthMonitor && request.url && (
            <HealthDot method={request.method} url={request.url} />
          )}

          {isPinned && (
            <Pin
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label="Pinned"
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-foreground/10 dark:hover:bg-white/20"
              onClick={(e) => e.stopPropagation()}
              data-testid="request-item-more-btn"
            >
              <MoreHorizontal className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Export</DropdownMenuLabel>
                {exportItems}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {actionItems}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                data-testid="request-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteOpen(true);
                }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuGroup>
          <ContextMenuLabel>Export</ContextMenuLabel>
          <ContextMenuItem onClick={handleGenerateCode}>
            <Code2 className="mr-2 h-3.5 w-3.5" />
            Generate Code
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void handleCopyAsCurl()}>
            <Terminal className="mr-2 h-3.5 w-3.5" />
            {t("copyAsCurl")}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleExportPostman}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export as Postman
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem
            onClick={() =>
              isPinned ? unpinRequest(request.id) : pinRequest(request.id)
            }
          >
            {isPinned ? (
              <>
                <PinOff className="mr-2 h-3.5 w-3.5" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="mr-2 h-3.5 w-3.5" />
                Pin to top
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete the request?"
        description={`"${request.name}" will be permanently deleted.`}
        onConfirm={() => deleteRequest(request.id)}
      />

      <CodeGenDialog
        open={codeGenOpen}
        onOpenChange={setCodeGenOpen}
        tab={codeGenTab}
      />
    </ContextMenu>
  );
}
