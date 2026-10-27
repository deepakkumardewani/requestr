"use client";

import {
  ChevronDown,
  Globe,
  MoreHorizontal,
  Pencil,
  Settings2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
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
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useUIStore } from "@/stores/useUIStore";

export function EnvSelector() {
  const { environments, activeEnvId, setActiveEnv, deleteEnv } =
    useEnvironmentsStore();
  const { setEnvManagerOpen } = useUIStore();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const activeEnv = environments.find((e) => e.id === activeEnvId);
  const pendingEnvName = environments.find(
    (e) => e.id === pendingDeleteId,
  )?.name;

  function handleConfirmDelete(envId: string) {
    if (activeEnvId === envId) setActiveEnv(null);
    deleteEnv(envId);
    setPendingDeleteId(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="env-selector-trigger"
          className="flex h-8 w-full items-center justify-between rounded-md border border-theme-accent/20 bg-theme-accent/5 px-2 text-xs hover:bg-theme-accent/10"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Globe className="h-3 w-3 shrink-0 text-theme-accent" />
            <span className="truncate">
              {activeEnv?.name ?? "No Environment"}
            </span>
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-52">
          <DropdownMenuItem
            data-testid="env-selector-no-env"
            onClick={() => setActiveEnv(null)}
          >
            <span className="text-muted-foreground">No Environment</span>
          </DropdownMenuItem>

          {environments.length > 0 && <DropdownMenuSeparator />}

          {environments.map((env) => (
            <ContextMenu key={env.id}>
              <ContextMenuTrigger>
                <DropdownMenuItem
                  data-testid={`env-selector-item-${env.name}`}
                  className={`group pr-1 ${activeEnvId === env.id ? "font-medium" : ""}`}
                  onClick={() => setActiveEnv(env.id)}
                >
                  <span className="flex-1 truncate">{env.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      data-testid={`env-selector-more-${env.name}`}
                      aria-label={`${env.name} actions`}
                      className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded p-0 opacity-0 group-hover:opacity-100 hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-auto" side="right">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnvManagerOpen(true, env.id);
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Rename
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
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </DropdownMenuItem>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => setEnvManagerOpen(true, env.id)}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setPendingDeleteId(env.id)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            data-testid="env-selector-manage-btn"
            onClick={() => setEnvManagerOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage Environments
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Environment"
        description={`"${pendingEnvName ?? "This environment"}" and all its variables will be permanently deleted.`}
        confirmLabel="Yes, delete environment"
        onConfirm={() =>
          pendingDeleteId && handleConfirmDelete(pendingDeleteId)
        }
      />
    </>
  );
}
