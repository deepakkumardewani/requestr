"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
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
import { cn } from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";

type EnvListPanelProps = {
  selectedEnvId: string | null;
  onSelect: (id: string) => void;
};

export function EnvListPanel({ selectedEnvId, onSelect }: EnvListPanelProps) {
  const t = useTranslations();
  const {
    environments,
    activeEnvId,
    createEnv,
    updateEnv,
    deleteEnv,
    setActiveEnv,
  } = useEnvironmentsStore();

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNameId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNameId]);

  function commitName(envId: string) {
    updateEnv(envId, {
      name: draftName.trim() || t("environment.defaultName"),
    });
    setEditingNameId(null);
  }

  function handleAddEnvironment() {
    const defaultName = t("environment.defaultName");
    const env = createEnv(defaultName);
    onSelect(env.id);
    setActiveEnv(env.id);
    setDraftName(defaultName);
    setEditingNameId(env.id);
  }

  function handleConfirmDelete(envId: string) {
    const envName =
      environments.find((e) => e.id === envId)?.name ??
      t("environment.deleteFallbackName");
    const remaining = environments.filter((e) => e.id !== envId);
    const fallback = remaining.at(-1)?.id ?? null;

    deleteEnv(envId);
    setPendingDeleteId(null);
    toast.success(t("environment.deletedToast", { name: envName }));

    if (selectedEnvId === envId && fallback) {
      onSelect(fallback);
    }
  }

  const pendingEnvName = environments.find(
    (e) => e.id === pendingDeleteId,
  )?.name;

  return (
    <div className="flex w-[200px] shrink-0 flex-col border-r">
      <div className="border-b px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("navigation.environments")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {environments.map((env) => (
          <ContextMenu key={env.id}>
            <ContextMenuTrigger>
              <div
                data-testid={`env-list-item-${env.name}`}
                className={cn(
                  "group relative mx-1 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
                  selectedEnvId === env.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                onClick={() => {
                  onSelect(env.id);
                  setActiveEnv(env.id);
                }}
              >
                {/* Active env indicator dot */}
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    activeEnvId === env.id
                      ? "bg-theme-accent"
                      : "bg-transparent",
                  )}
                />

                {editingNameId === env.id ? (
                  <Input
                    ref={inputRef}
                    data-testid="env-item-rename-input"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={() => commitName(env.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitName(env.id);
                      if (e.key === "Escape") setEditingNameId(null);
                    }}
                    className="h-5 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate text-xs">{env.name}</span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid="env-item-more-btn"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-foreground/10 dark:hover:bg-white/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      data-testid="env-item-rename-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftName(env.name);
                        setEditingNameId(env.id);
                      }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      {t("common.rename")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      data-testid="env-item-delete-btn"
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
              <ContextMenuItem
                onClick={() => {
                  setDraftName(env.name);
                  setEditingNameId(env.id);
                }}
              >
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
        ))}
      </div>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          data-testid="add-env-btn"
          className="w-full justify-start gap-1.5 text-xs text-muted-foreground"
          onClick={handleAddEnvironment}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("environment.addEnvironment")}
        </Button>
      </div>

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
