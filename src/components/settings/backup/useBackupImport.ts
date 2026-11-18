"use client";

import { useCallback, useEffect, useState } from "react";
import { reloadWorkspace } from "@/lib/backup/broadcast";
import type { BackupError } from "@/lib/backup/errors";
import {
  type RestoreMode,
  type RestoreSummary,
  restoreBackup,
} from "@/lib/backup/importer";
import { countReplaceDeletes } from "@/lib/backup/replace";
import type { BackupEnvelope } from "@/lib/backup/schema";
import type { SectionCounts } from "@/lib/backup/sizeEstimate";
import { type BackupWarning, validateBackup } from "@/lib/backup/validate";

/** Time the restore summary stays readable before the workspace reloads. */
export const RELOAD_DELAY_MS = 3000;

export type ImportStep = "pick" | "preview" | "done";

type ImportState = {
  step: ImportStep;
  fileName: string;
  envelope: BackupEnvelope | null;
  warnings: BackupWarning[];
  error: BackupError | null;
  restoreFailed: boolean;
  summary: RestoreSummary | null;
};

const INITIAL_STATE: ImportState = {
  step: "pick",
  fileName: "",
  envelope: null,
  warnings: [],
  error: null,
  restoreFailed: false,
  summary: null,
};

export function useBackupImport() {
  const [state, setState] = useState<ImportState>(INITIAL_STATE);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [busy, setBusy] = useState(false);
  const [confirmCounts, setConfirmCounts] = useState<SectionCounts | null>(
    null,
  );

  useEffect(() => {
    if (state.step !== "done") return;
    const timer = setTimeout(reloadWorkspace, RELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.step]);

  const pickFile = useCallback(async (file: File) => {
    const result = validateBackup(await file.text(), file.size);
    if (!result.ok) {
      setState({ ...INITIAL_STATE, fileName: file.name, error: result.error });
      return;
    }
    setState({
      ...INITIAL_STATE,
      step: "preview",
      fileName: file.name,
      envelope: result.envelope,
      warnings: result.warnings,
    });
  }, []);

  const runRestore = useCallback(async () => {
    if (!state.envelope) return;
    setBusy(true);
    try {
      const summary = await restoreBackup(state.envelope, mode);
      setConfirmCounts(null);
      setState((prev) => ({ ...prev, step: "done", summary }));
    } catch (error: unknown) {
      console.error("Backup import: restore failed", error);
      setConfirmCounts(null);
      setState((prev) => ({ ...prev, restoreFailed: true }));
    } finally {
      setBusy(false);
    }
  }, [state.envelope, mode]);

  /** Replace never applies silently: it first asks, with the per-section delete counts. */
  const restore = useCallback(async () => {
    if (!state.envelope) return;
    if (mode === "merge") {
      await runRestore();
      return;
    }
    setConfirmCounts(await countReplaceDeletes(state.envelope.sections));
  }, [state.envelope, mode, runRestore]);

  const cancelReplace = useCallback(() => setConfirmCounts(null), []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setMode("merge");
  }, []);

  return {
    ...state,
    mode,
    setMode,
    busy,
    confirmCounts,
    pickFile,
    restore,
    confirmReplace: runRestore,
    cancelReplace,
    reset,
  };
}
