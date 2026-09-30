"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { memo, useRef, useState } from "react";
import { EnvAutocompleteInput } from "@/components/common/EnvAutocompleteInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isSensitiveHeaderKey } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import type { KVPair } from "@/types";

const VALUE_INPUT_CLASS =
  "h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1";

const MASK_DISPLAY = "••••••••";

/**
 * Disambiguates test ids across editors that mount simultaneously (e.g. tab
 * switches keep Params/Headers/Body all in the DOM), so tests target the
 * right table instead of the first match.
 */
export const KV_TABLE_TEST_ID_PREFIXES = [
  "headers",
  "params",
  "path-params",
  "body",
  "edit-path-params",
  "edit-query-params",
  "edit-headers",
] as const;

export type KVTableTestIdPrefix = (typeof KV_TABLE_TEST_ID_PREFIXES)[number];

function buildTestId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}-${suffix}` : suffix;
}

const GRID = {
  base: "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-3",
  withDesc:
    "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-3",
  withMask:
    "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-x-3",
  withDescMask:
    "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-x-3",
} as const;

function resolveGridClass(
  showDescription: boolean,
  showMaskCol: boolean,
): string {
  if (showDescription && showMaskCol) return GRID.withDescMask;
  if (showDescription) return GRID.withDesc;
  if (showMaskCol) return GRID.withMask;
  return GRID.base;
}

type KVTableProps = {
  rows: KVPair[];
  onChange: (rows: KVPair[]) => void;
  keyLabel?: string;
  valueLabel?: string;
  descriptionLabel?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  showDescription?: boolean;
  readOnly?: boolean;
  readOnlyKeys?: boolean;
  hideCheckbox?: boolean;
  /** Eye toggle + mask sensitive header values (visual only; underlying value unchanged). */
  enableHeaderValueMask?: boolean;
  /** Scopes data-testid values so tests target this editor when several KVTables are mounted at once. */
  testIdPrefix?: KVTableTestIdPrefix;
};

export const KVTable = memo(function KVTable({
  rows,
  onChange,
  keyLabel = "Key",
  valueLabel = "Value",
  descriptionLabel = "Description",
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  descriptionPlaceholder = "Description",
  showDescription = false,
  readOnly = false,
  readOnlyKeys = false,
  hideCheckbox = false,
  enableHeaderValueMask = false,
  testIdPrefix,
}: KVTableProps) {
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const draftValueRef = useRef<HTMLInputElement>(null);
  const draftDescriptionRef = useRef<HTMLInputElement>(null);
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
    if (!draftKey && !draftValue && !draftDescription) return;
    onChange([
      ...rows,
      {
        id: generateId(),
        key: draftKey,
        value: draftValue,
        description: draftDescription,
        enabled: true,
      },
    ]);
    setDraftKey("");
    setDraftValue("");
    setDraftDescription("");
  }

  function handleDraftKeyBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (e.relatedTarget === draftValueRef.current) return;
    commitDraft();
  }

  const showMaskCol = enableHeaderValueMask && !readOnly;
  const gridClass = resolveGridClass(showDescription, showMaskCol);

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 border-b bg-muted/40 px-3 py-2">
        <div
          className={`${gridClass} text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}
        >
          <span className="w-4" />
          <span>{keyLabel}</span>
          <span>{valueLabel}</span>
          {showDescription ? <span>{descriptionLabel}</span> : null}
          {showMaskCol ? <span className="w-7 text-center">Mask</span> : null}
          <span className="w-6" />
        </div>
      </div>

      <div className="px-1 py-1">
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
                  data-testid={buildTestId(
                    testIdPrefix,
                    `row-enable-${row.id}`,
                  )}
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
                data-testid={buildTestId(testIdPrefix, `row-key-${row.id}`)}
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
                  data-testid={buildTestId(testIdPrefix, `row-value-${row.id}`)}
                  className={`h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1 ${
                    !row.enabled ? "opacity-40" : ""
                  }`}
                  value={row.value}
                  placeholder={valuePlaceholder}
                  readOnly
                />
              ) : showMaskedDisplay ? (
                <Input
                  data-testid={buildTestId(testIdPrefix, `row-value-${row.id}`)}
                  readOnly
                  tabIndex={-1}
                  className={`h-9 border-0 bg-transparent px-1 text-xs shadow-none ${
                    !row.enabled ? "opacity-40" : ""
                  }`}
                  value={MASK_DISPLAY}
                />
              ) : (
                <EnvAutocompleteInput
                  data-testid={buildTestId(testIdPrefix, `row-value-${row.id}`)}
                  className={`${VALUE_INPUT_CLASS} ${!row.enabled ? "opacity-40" : ""}`}
                  value={row.value}
                  placeholder={valuePlaceholder}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                />
              )}

              {showDescription ? (
                <Input
                  data-testid={buildTestId(
                    testIdPrefix,
                    `row-description-${row.id}`,
                  )}
                  className={`h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1 ${
                    !row.enabled ? "opacity-40" : ""
                  }`}
                  value={row.description ?? ""}
                  placeholder={descriptionPlaceholder}
                  readOnly={readOnly}
                  onChange={(e) =>
                    updateRow(row.id, { description: e.target.value })
                  }
                />
              ) : null}

              {showMaskCol ? (
                <button
                  type="button"
                  data-testid={buildTestId(
                    testIdPrefix,
                    `row-mask-toggle-${row.id}`,
                  )}
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
                  data-testid={buildTestId(
                    testIdPrefix,
                    `row-delete-${row.id}`,
                  )}
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
              data-testid={buildTestId(testIdPrefix, "draft-row-key")}
              className="h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1"
              value={draftKey}
              placeholder={keyPlaceholder}
              onChange={(e) => setDraftKey(e.target.value)}
              onBlur={handleDraftKeyBlur}
            />
            <EnvAutocompleteInput
              data-testid={buildTestId(testIdPrefix, "draft-row-value")}
              ref={draftValueRef}
              className={VALUE_INPUT_CLASS}
              value={draftValue}
              placeholder={valuePlaceholder}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={(e) => {
                if (
                  showDescription &&
                  e.relatedTarget === draftDescriptionRef.current
                ) {
                  return;
                }
                commitDraft();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitDraft();
                }
              }}
            />
            {showDescription ? (
              <Input
                data-testid={buildTestId(testIdPrefix, "draft-row-description")}
                ref={draftDescriptionRef}
                className="h-9 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-1"
                value={draftDescription}
                placeholder={descriptionPlaceholder}
                onChange={(e) => setDraftDescription(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
              />
            ) : null}
            {showMaskCol ? <span className="w-7" /> : null}
            <span className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
});
