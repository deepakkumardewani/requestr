"use client";

import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type CurlErrorReason,
  CurlToRequestError,
  curlToRequest,
} from "@/lib/curlToRequest";
import { cn } from "@/lib/utils";
import { type AddNodeOptions, useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { HttpMethod } from "@/types";
import {
  type NewRequestMode,
  usePickerActions,
  usePickerDraft,
} from "./PickerContext";
import {
  TargetCollectionPicker,
  type TargetSelection,
} from "./TargetCollectionPicker";
import {
  type CreateRequestInput,
  resolveDefaultTarget,
  useCreateRequest,
} from "./useCreateRequest";

const METHODS: readonly HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const MODES: readonly NewRequestMode[] = ["blank", "curl"];

const MODE_LABEL_KEYS = {
  blank: "apiPickerModeBlank",
  curl: "apiPickerModeCurl",
} as const satisfies Record<NewRequestMode, string>;

const CURL_REASON_KEYS = {
  empty: "apiPickerCurlReasonEmpty",
  notCurl: "apiPickerCurlReasonNotCurl",
  missingUrl: "apiPickerCurlReasonMissingUrl",
  unknownMethod: "apiPickerCurlReasonUnknownMethod",
  invalidHeader: "apiPickerCurlReasonInvalidHeader",
  unknown: "apiPickerCurlReasonUnknown",
} as const satisfies Record<CurlErrorReason, string>;

type CurlAnalysis =
  | { status: "empty" }
  | { status: "valid"; derivedName: string }
  | { status: "invalid"; reason: CurlErrorReason };

/** Pure so the panel can show the error and derived name from one parse of the pasted text. */
function analyzeCurl(text: string): CurlAnalysis {
  if (!text.trim()) return { status: "empty" };
  try {
    return { status: "valid", derivedName: curlToRequest(text).name };
  } catch (error) {
    if (error instanceof CurlToRequestError)
      return { status: "invalid", reason: error.reason };
    throw error;
  }
}

type NewRequestPanelProps = {
  chainId: string;
  /** Closes the whole dialog; called after a successful create or on Cancel. */
  onClose: () => void;
  /** Selects the new node and opens its details panel (D14). */
  onNodeAdded?: (nodeId: string) => void;
  placement?: AddNodeOptions;
};

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: NewRequestMode;
  onChange: (mode: NewRequestMode) => void;
}) {
  const t = useTranslations("chain");
  return (
    <div
      role="radiogroup"
      aria-label={t("apiPickerTabNew")}
      className="inline-flex w-fit rounded-lg bg-muted p-0.5"
    >
      {MODES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          data-testid={`picker-new-mode-${value}`}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            mode === value
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(MODE_LABEL_KEYS[value])}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** "New request" tab: creates a real request (or an unsaved history node) and places it on the chain. */
export function NewRequestPanel({
  chainId,
  onClose,
  onNodeAdded,
  placement,
}: NewRequestPanelProps) {
  const t = useTranslations("chain");
  const ids = useId();
  const draft = usePickerDraft();
  const { patchDraft } = usePickerActions();
  const collections = useCollectionsStore((s) => s.collections);
  const folders = useCollectionsStore((s) => s.folders);
  const chain = useChainStore((s) => s.chains[chainId]);
  const createRequest = useCreateRequest({ chainId, onNodeAdded, placement });
  const [urlTouched, setUrlTouched] = useState(false);

  // Seed the target once, and only while the draft is pristine so a tab switch never undoes a choice.
  const pristine = !draft.url && !draft.curlText && !draft.name;
  useEffect(() => {
    if (!pristine || draft.targetCollectionId || collections.length === 0)
      return;
    const target = resolveDefaultTarget(chain, collections);
    if (target.collectionId) {
      patchDraft({
        targetCollectionId: target.collectionId,
        targetFolderId: target.folderId,
      });
    }
    // Runs on mount / when collections hydrate; `pristine` is read, not a trigger.
  }, [collections.length]);

  const isCurl = draft.mode === "curl";
  const curl = useMemo(
    () => (isCurl ? analyzeCurl(draft.curlText) : null),
    [isCurl, draft.curlText],
  );
  const target: TargetSelection = {
    collectionId: draft.targetCollectionId,
    folderId: draft.targetFolderId,
  };
  const fallbackName =
    curl?.status === "valid" ? curl.derivedName : t("apiPickerTabNew");
  const name = draft.name || fallbackName;
  const urlMissing = !isCurl && draft.url.trim() === "";
  const valid = isCurl ? curl?.status === "valid" : !urlMissing;

  const handleTargetChange = useCallback(
    (next: TargetSelection) =>
      patchDraft({
        targetCollectionId: next.collectionId,
        targetFolderId: next.folderId,
      }),
    [patchDraft],
  );

  const submit = () => {
    if (!valid) return;
    const typedName = draft.name.trim();
    const input: CreateRequestInput = isCurl
      ? {
          source: "curl",
          text: draft.curlText,
          name: typedName || undefined,
          target,
        }
      : {
          source: "blank",
          name: typedName || t("apiPickerTabNew"),
          method: draft.method,
          url: draft.url,
          target,
        };
    createRequest(input);
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    submit();
  };

  const submitLabel =
    collections.length === 0
      ? t("apiPickerAddUnsaved")
      : target.collectionId
        ? t("apiPickerCreateAndAdd")
        : t("apiPickerAddToChain");

  return (
    <div
      data-testid="picker-new-request"
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-4 px-4 py-4 sm:px-6"
    >
      <ModeSwitch mode={draft.mode} onChange={(mode) => patchDraft({ mode })} />

      {isCurl ? (
        <Field label={t("apiPickerModeCurl")} htmlFor={`${ids}-curl`}>
          <Textarea
            id={`${ids}-curl`}
            value={draft.curlText}
            onChange={(event) => patchDraft({ curlText: event.target.value })}
            placeholder={t("apiPickerCurlPlaceholder")}
            spellCheck={false}
            rows={5}
            aria-invalid={curl?.status === "invalid"}
            aria-describedby={
              curl?.status === "invalid" ? `${ids}-curl-error` : undefined
            }
            data-testid="picker-new-curl"
            className="max-h-48 font-mono text-xs"
          />
          {curl?.status === "invalid" && (
            <p
              id={`${ids}-curl-error`}
              role="alert"
              data-testid="picker-curl-error"
              className="text-sm text-destructive"
            >
              {t("apiPickerCurlError", {
                reason: t(CURL_REASON_KEYS[curl.reason]),
              })}
            </p>
          )}
        </Field>
      ) : (
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label={t("apiPickerFieldMethod")} htmlFor={`${ids}-method`}>
            <Select
              value={draft.method}
              onValueChange={(method) =>
                method && patchDraft({ method: method as HttpMethod })
              }
            >
              <SelectTrigger
                id={`${ids}-method`}
                aria-label={t("apiPickerFieldMethod")}
                data-testid="picker-new-method"
                className="w-full"
              >
                <SelectValue>{draft.method}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("apiPickerFieldUrl")} htmlFor={`${ids}-url`}>
            <Input
              id={`${ids}-url`}
              value={draft.url}
              onChange={(event) => patchDraft({ url: event.target.value })}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://"
              aria-invalid={urlMissing && urlTouched}
              aria-describedby={
                urlMissing && urlTouched ? `${ids}-url-error` : undefined
              }
              data-testid="picker-new-url"
            />
            {urlMissing && urlTouched && (
              <p
                id={`${ids}-url-error`}
                role="alert"
                data-testid="picker-new-url-error"
                className="text-sm text-destructive"
              >
                {t("apiPickerUrlRequired")}
              </p>
            )}
          </Field>
        </div>
      )}

      <Field label={t("apiPickerFieldName")} htmlFor={`${ids}-name`}>
        <Input
          id={`${ids}-name`}
          value={name}
          onChange={(event) => patchDraft({ name: event.target.value })}
          data-testid="picker-new-name"
        />
      </Field>

      <TargetCollectionPicker
        collections={collections}
        folders={folders}
        value={target}
        onChange={handleTargetChange}
      />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          data-testid="picker-new-request-cancel"
        >
          {t("apiPickerCancel")}
        </Button>
        <Button
          type="button"
          disabled={!valid}
          onClick={submit}
          data-testid="picker-new-request-submit"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
