"use client";

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VariableHighlightOverlay } from "@/components/common/VariableHighlightOverlay";
import { Input } from "@/components/ui/input";
import { useEnvVariableKeys } from "@/hooks/useEnvVariableKeys";
import { buildActiveEnvVars } from "@/lib/activeEnvVars";
import { cn } from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";

type EnvAutocompleteInputProps = React.ComponentProps<typeof Input> & {
  /** Highlight `{{variable}}` tokens (resolved vs unresolved) inside the input. */
  highlightVariables?: boolean;
};

// Single source of truth for the input AND its highlight overlay. `md:text-xs`
// is required: the base Input sets `md:text-sm`, which plain `text-xs` would not override.
const TEXT_METRICS_CLASS = "px-2.5 py-1 font-mono text-xs md:text-xs";
const SCROLL_SYNC_EVENTS = [
  "keydown",
  "keyup",
  "select",
  "mouseup",
  "input",
  "scroll",
] as const;

// Variables with an empty value are treated as unresolved for highlighting.
function useResolvedEnvMap(enabled: boolean): Record<string, string> {
  const environments = useEnvironmentsStore((s) => s.environments);
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  return useMemo(() => {
    if (!enabled) return {};
    const all = buildActiveEnvVars(environments, activeEnvId);
    return Object.fromEntries(Object.entries(all).filter(([, v]) => v !== ""));
  }, [enabled, environments, activeEnvId]);
}

// Returns the variable prefix being typed after {{ at the end of the string,
// or null if the pattern isn't present.
function getEnvPrefix(
  value: string,
): { prefix: string; triggerIndex: number } | null {
  const match = value.match(/\{\{([\w.]*)$/);
  if (!match) return null;
  return { prefix: match[1], triggerIndex: match.index ?? 0 };
}

export const EnvAutocompleteInput = forwardRef<
  HTMLInputElement,
  EnvAutocompleteInputProps
>(function EnvAutocompleteInput(
  {
    value,
    onChange,
    className,
    onKeyDown: externalKeyDown,
    highlightVariables = false,
    ...props
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef =
    (forwardedRef as React.RefObject<HTMLInputElement>) ?? localRef;
  const getInput = () => inputRef.current;

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const envVariables = useEnvVariableKeys();
  const envMap = useResolvedEnvMap(highlightVariables);
  const overlayTextRef = useRef<HTMLSpanElement>(null);

  // Keeps the mirrored text aligned with the input's horizontal scroll.
  function syncOverlayScroll() {
    const input = getInput();
    if (!input || !overlayTextRef.current) return;
    overlayTextRef.current.style.transform = `translateX(${-input.scrollLeft}px)`;
  }

  useLayoutEffect(() => {
    if (highlightVariables) syncOverlayScroll();
  }, [value, highlightVariables]);

  useEffect(() => {
    const input = getInput();
    if (!highlightVariables || !input) return;
    for (const ev of SCROLL_SYNC_EVENTS)
      input.addEventListener(ev, syncOverlayScroll);
    return () => {
      for (const ev of SCROLL_SYNC_EVENTS)
        input.removeEventListener(ev, syncOverlayScroll);
    };
  }, [highlightVariables, inputRef]);

  function updateSuggestions(val: string) {
    const trigger = getEnvPrefix(val);
    if (!trigger || envVariables.length === 0) {
      setSuggestions([]);
      return;
    }
    const filtered = envVariables.filter((v) =>
      v.toLowerCase().startsWith(trigger.prefix.toLowerCase()),
    );
    setSuggestions(filtered);
    setActiveIndex(0);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Update suggestions before notifying parent — avoids any batching race
    updateSuggestions(e.target.value);
    onChange?.(e);
  }

  function applySelection(varName: string) {
    const strValue = typeof value === "string" ? value : "";
    // Replace the trailing {{ partial with the completed variable
    const newValue = strValue.replace(/\{\{([\w.]*)$/, `{{${varName}}}`);
    onChange?.({
      target: { value: newValue },
    } as React.ChangeEvent<HTMLInputElement>);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const input = (inputRef as React.RefObject<HTMLInputElement>).current;
      input?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) {
      externalKeyDown?.(e);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const selected = suggestions[activeIndex];
      if (selected) {
        e.preventDefault();
        applySelection(selected);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
    } else {
      externalKeyDown?.(e);
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const input = (inputRef as React.RefObject<HTMLInputElement>).current;
      if (input && !input.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [inputRef]);

  return (
    <div className="relative flex-1">
      {highlightVariables && (
        <VariableHighlightOverlay
          ref={overlayTextRef}
          value={typeof value === "string" ? value : ""}
          env={envMap}
          className={TEXT_METRICS_CLASS}
          disabled={props.disabled}
        />
      )}
      <Input
        ref={inputRef as React.Ref<HTMLInputElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-8 w-full",
          TEXT_METRICS_CLASS,
          highlightVariables &&
            "relative text-transparent caret-foreground selection:bg-primary/25 selection:text-transparent",
          className,
        )}
        {...props}
      />

      {suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 max-h-48 min-w-[200px] max-w-xs overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md">
          {suggestions.map((name, i) => (
            <li
              key={name}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click registers
                applySelection(name);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <span className="font-mono text-theme-accent opacity-70">
                {"{{"}
              </span>
              <span>{name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                env
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
