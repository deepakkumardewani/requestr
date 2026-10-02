"use client";

import { Link2, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput } from "@/components/ui/command";
import { looksLikeCurl, looksLikeUrl } from "@/lib/pickerSearch";
import { useUIStore } from "@/stores/useUIStore";
import { usePickerActions, usePickerQuery } from "./PickerContext";

const FOCUS_SEARCH_KEY = "/";

type Suggestion = "curl" | "url";

function getSuggestion(query: string): Suggestion | null {
  if (looksLikeCurl(query)) return "curl";
  if (looksLikeUrl(query)) return "url";
  return null;
}

/** True when the keystroke would type into a field, so `/` must not be hijacked. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

type PickerSearchBarProps = {
  /** Number of rows matching the current search and filters; announced to screen readers. */
  resultCount: number;
};

/**
 * Filter-as-you-type search. cmdk's own filtering is disabled (D3): ranking and highlighting come from
 * `pickerSearch`, so this is only the input chrome plus the cURL/URL "create a request" suggestion.
 */
export function PickerSearchBar({ resultCount }: PickerSearchBarProps) {
  const t = useTranslations("chain");
  const query = usePickerQuery();
  const { setQuery, patchDraft } = usePickerActions();
  const setPickerTab = useUIStore((s) => s.setPickerTab);
  const rootRef = useRef<HTMLDivElement>(null);
  const suggestion = getSuggestion(query);

  const focusInput = () => rootRef.current?.querySelector("input")?.focus();

  useEffect(() => {
    focusInput();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== FOCUS_SEARCH_KEY ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      focusInput();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Esc clears the search first; only an Esc on an already-empty search reaches the dialog and closes it.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || query === "") return;
    event.preventDefault();
    event.stopPropagation();
    setQuery("");
  };

  const handleSuggestion = () => {
    if (suggestion === "curl") patchDraft({ mode: "curl", curlText: query });
    else patchDraft({ mode: "blank", url: query.trim() });
    setPickerTab("new");
    setQuery("");
  };

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className="min-w-0 px-3 pt-3">
      <Command
        shouldFilter={false}
        className="h-auto overflow-visible bg-transparent p-0"
      >
        <CommandInput
          data-testid="picker-search"
          value={query}
          onValueChange={setQuery}
          placeholder={t("apiPickerSearchPlaceholder")}
          aria-label={t("apiPickerSearchPlaceholder")}
        />
      </Command>
      {suggestion && (
        <Button
          type="button"
          variant="ghost"
          data-testid="picker-suggestion"
          onClick={handleSuggestion}
          className="mt-2 h-auto w-full min-w-0 justify-start gap-2 px-3 py-2 text-left"
        >
          {suggestion === "curl" ? (
            <Terminal className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Link2 className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 truncate">
            {suggestion === "curl"
              ? t("apiPickerSuggestCurl")
              : t("apiPickerSuggestUrl", { url: query.trim() })}
          </span>
        </Button>
      )}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="picker-result-announcement"
      >
        {query.trim() ? t("apiPickerResultCount", { count: resultCount }) : ""}
      </div>
    </div>
  );
}

/** Empty-results state for an active search; sits where the list would be. */
export function PickerNoResults() {
  const t = useTranslations("chain");
  const query = usePickerQuery();
  const { setQuery } = usePickerActions();

  return (
    <div
      data-testid="picker-no-results"
      className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground"
    >
      <p className="max-w-full break-words">
        {t("apiPickerNoResultsFor", { query })}
      </p>
      <Button
        variant="outline"
        size="sm"
        data-testid="picker-clear-search"
        onClick={() => setQuery("")}
      >
        {t("apiPickerClearSearch")}
      </Button>
    </div>
  );
}
