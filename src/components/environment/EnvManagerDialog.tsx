"use client";

import { Layers, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useUIStore } from "@/stores/useUIStore";
import { EnvListPanel } from "./EnvListPanel";
import { EnvVariableTable } from "./EnvVariableTable";

export function EnvManagerDialog() {
  const t = useTranslations("environment");
  const { envManagerOpen, envManagerFocusEnvId, setEnvManagerOpen } =
    useUIStore();
  const { environments, activeEnvId } = useEnvironmentsStore();

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);

  // Sync selection when dialog opens
  useEffect(() => {
    if (envManagerOpen) {
      setSelectedEnvId(
        envManagerFocusEnvId ?? activeEnvId ?? environments[0]?.id ?? null,
      );
    }
  }, [envManagerOpen]);

  const selectedEnv = environments.find((e) => e.id === selectedEnvId) ?? null;

  return (
    <Dialog
      open={envManagerOpen}
      onOpenChange={(open) => !open && setEnvManagerOpen(false)}
    >
      <DialogContent
        data-testid="env-manager-dialog"
        className="h-[580px] max-w-4xl sm:max-w-4xl gap-0 overflow-hidden p-0"
        showCloseButton
      >
        {/* Visually hidden title for a11y */}
        <DialogTitle className="sr-only">{t("manageTitle")}</DialogTitle>

        <div className="flex h-full">
          <EnvListPanel
            selectedEnvId={selectedEnvId}
            onSelect={setSelectedEnvId}
          />

          {selectedEnv ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Env name — inline editable */}
              <EnvHeader env={selectedEnv} />
              <EnvVariableTable env={selectedEnv} />
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EnvHeader({ env }: { env: { id: string; name: string } }) {
  const t = useTranslations("environment");
  const { updateEnv } = useEnvironmentsStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(env.name);

  // Keep draft in sync when env changes (e.g. renamed from list panel)
  useEffect(() => {
    if (!editing) setDraft(env.name);
  }, [env.name, editing]);

  function commit() {
    updateEnv(env.id, { name: draft.trim() || t("defaultName") });
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-2 border-b px-4 py-2.5 pr-12">
      {editing ? (
        <input
          data-testid="env-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 bg-transparent text-sm font-medium outline-none"
        />
      ) : (
        <button
          type="button"
          data-testid="env-name-display"
          className="flex items-center gap-1.5 text-left text-sm font-medium"
          onClick={() => {
            setDraft(env.name);
            setEditing(true);
          }}
        >
          {env.name}
          <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("environment");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Layers className="h-8 w-8 opacity-30" />
      <p className="text-xs">{t("addToGetStarted")}</p>
    </div>
  );
}
