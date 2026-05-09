"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { EnvAutocompleteInput } from "@/components/common/EnvAutocompleteInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isSensitiveHeaderKey } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type { KVPair } from "@/types";

const VALUE_INPUT_CLASS =
  "h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1";

const MASK_DISPLAY = "••••••••";

type KVTableProps = {
  rows: KVPair[];
  onChange: (rows: KVPair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  readOnly?: boolean;
  readOnlyKeys?: boolean;
  hideCheckbox?: boolean;
  /** Eye toggle + mask sensitive header values (visual only; underlying value unchanged). */
  enableHeaderValueMask?: boolean;
};

export function KVTable({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  readOnly = false,
  readOnlyKeys = false,
  hideCheckbox = false,
  enableHeaderValueMask = false,
}: KVTableProps) {
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const draftValueRef = useRef<HTMLInputElement>(null);
  /** Explicit mask state per row id (undefined = use default from sensitive key list). */
  const [maskExplicit, setMaskExplicit] = useState<Record<string, boolean>>({});

  function rowMasked(row: KVPair): boolean {
    if (!enableHeaderValueMask || readOnly) return false;
    const ex = maskExplicit[row.id];
    if (ex !== undefined) return ex;
    return isSensitiveHeaderKey(row.key);
  }

  function toggleRowMask(row: KVPair) {
    if (!enableHeaderValueMask) return;
    setMaskExplicit((prev) => ({
      ...prev,
      [row.id]: !rowMasked(row),
    }));
  }

  function updateRow(id: string, patch: Partial<KVPair>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function deleteRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
    setMaskExplicit((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function commitDraft() {
    if (!draftKey && !draftValue) return;
    onChange([
      ...rows,
      { id: generateId(), key: draftKey, value: draftValue, enabled: true },
    ]);
    setDraftKey("");
    setDraftValue("");
  }

  function handleDraftKeyBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (e.relatedTarget === draftValueRef.current) return;
    commitDraft();
  }

  const showMaskCol = enableHeaderValueMask && !readOnly;
  const gridClass = showMaskCol
    ? "grid grid-cols-[auto_1fr_1fr_auto_auto] gap-1"
    : "grid grid-cols-[auto_1fr_1fr_auto] gap-1";

  return (
    <div className="w-full">
      <div
        className={`${gridClass} px-2 pb-1 text-[11px] font-medium text-foreground/75`}
      >
        <span className="w-4" />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        {showMaskCol ? <span className="w-7 text-center">Mask</span> : null}
        <span className="w-6" />
      </div>

      <div>
        {rows.map((row) => {
          const prefersMask = rowMasked(row);
          const showMaskedDisplay = prefersMask && row.value.trim().length > 0;
          return (
            <div
              key={row.id}
              className={`group ${gridClass} items-center px-2 py-0.5 hover:bg-muted/30 rounded-sm`}
            >
              {!readOnly && !hideCheckbox ? (
                <Checkbox
                  data-testid={`row-enable-${row.id}`}
                  className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  checked={row.enabled}
                  onCheckedChange={(checked) =>
                    updateRow(row.id, { enabled: !!checked })
                  }
                />
              ) : (
                <span className="h-3.5 w-3.5" />
              )}

              <Input
                data-testid={`row-key-${row.id}`}
                className={`h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1 ${
                  !row.enabled ? "opacity-40" : ""
                } ${readOnlyKeys ? "text-muted-foreground" : ""}`}
                value={row.key}
                placeholder={keyPlaceholder}
                readOnly={readOnly || readOnlyKeys}
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
              />

              {readOnly ? (
                <Input
                  data-testid={`row-value-${row.id}`}
                  className={`h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1 ${
                    !row.enabled ? "opacity-40" : ""
                  }`}
                  value={row.value}
                  placeholder={valuePlaceholder}
                  readOnly
                />
              ) : showMaskedDisplay ? (
                <Input
                  data-testid={`row-value-${row.id}`}
                  readOnly
                  tabIndex={-1}
                  className={`h-9 border-0 bg-transparent px-1 text-xs shadow-none ${
                    !row.enabled ? "opacity-40" : ""
                  }`}
                  value={MASK_DISPLAY}
                />
              ) : (
                <EnvAutocompleteInput
                  data-testid={`row-value-${row.id}`}
                  className={`${VALUE_INPUT_CLASS} ${!row.enabled ? "opacity-40" : ""}`}
                  value={row.value}
                  placeholder={valuePlaceholder}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                />
              )}

              {showMaskCol ? (
                <button
                  type="button"
                  data-testid={`row-mask-toggle-${row.id}`}
                  onClick={() => toggleRowMask(row)}
                  className="mx-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  title={showMaskedDisplay ? "Show value" : "Hide value"}
                >
                  {showMaskedDisplay ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}

              {!readOnly && !readOnlyKeys ? (
                <button
                  type="button"
                  data-testid={`row-delete-${row.id}`}
                  onClick={() => deleteRow(row.id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-colors transition-opacity hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : (
                <span className="h-5 w-5" />
              )}
            </div>
          );
        })}

        {!readOnly && !readOnlyKeys && (
          <div
            className={`${gridClass} items-center px-2 py-0.5 hover:bg-muted/30 rounded-sm`}
          >
            <span className="h-3.5 w-3.5" />
            <Input
              data-testid="draft-row-key"
              className="h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1"
              value={draftKey}
              placeholder={keyPlaceholder}
              onChange={(e) => setDraftKey(e.target.value)}
              onBlur={handleDraftKeyBlur}
            />
            <EnvAutocompleteInput
              data-testid="draft-row-value"
              ref={draftValueRef}
              className={VALUE_INPUT_CLASS}
              value={draftValue}
              placeholder={valuePlaceholder}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                }
              }}
            />
            {showMaskCol ? <span className="w-7" /> : null}
            <span className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
