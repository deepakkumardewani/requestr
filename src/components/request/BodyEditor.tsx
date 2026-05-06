"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { KVTable } from "@/components/common/KVTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAI } from "@/hooks/useAI";
import { useEnvVariableKeys } from "@/hooks/useEnvVariableKeys";
import { useTabsStore } from "@/stores/useTabsStore";
import type { BodyType, KVPair } from "@/types";

const CodeEditor = dynamic(() => import("./CodeEditor"), { ssr: false });

type BodyEditorProps = {
  tabId: string;
};

const RAW_TYPES: BodyType[] = ["json", "xml", "text", "html"];
export function BodyEditor({ tabId }: BodyEditorProps) {
  const { tabs, updateTabState } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const envVariables = useEnvVariableKeys();
  const t = useTranslations("request");

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const { run, loading, error, reset } = useAI<{ content: string }>(
    "generate-body",
  );

  if (!tab) return null;
  if (tab.type !== "http") return null;

  const { body } = tab;

  function handleTypeChange(type: BodyType | null) {
    if (!type) return;
    updateTabState(tabId, {
      body: {
        type,
        content: body.content,
        formData:
          type === "form-data" || type === "urlencoded"
            ? (body.formData ?? [])
            : undefined,
      },
    });
  }

  function handleFormDataChange(formData: KVPair[]) {
    updateTabState(tabId, { body: { ...body, formData } });
  }

  function handleOpenAI() {
    setAiOpen(true);
    setAiPrompt("");
    reset();
  }

  function handleCloseAI() {
    setAiOpen(false);
    setAiPrompt("");
    reset();
  }

  async function handleGenerate() {
    const result = await run({
      description: aiPrompt,
      bodyType: body.type,
      url: tab?.type === "http" ? tab.url : "",
      method: tab?.type === "http" ? tab.method : "POST",
    });
    if (result) {
      updateTabState(tabId, { body: { ...body, content: result.content } });
      handleCloseAI();
    }
  }

  const isRawType = RAW_TYPES.includes(body.type);
  const isFormType = body.type === "form-data" || body.type === "urlencoded";

  const bodyTypes: Array<{ value: BodyType; label: string }> = [
    { value: "none", label: t("body.types.none") },
    { value: "json", label: t("body.types.json") },
    { value: "xml", label: t("body.types.xml") },
    { value: "text", label: t("body.types.text") },
    { value: "html", label: t("body.types.html") },
    { value: "form-data", label: t("body.types.formData") },
    { value: "urlencoded", label: t("body.types.urlEncoded") },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Select value={body.type} onValueChange={handleTypeChange}>
          <SelectTrigger
            data-testid="body-type-selector"
            className="h-6 w-40 border-0 bg-transparent text-xs shadow-none focus:ring-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bodyTypes.map((bt) => (
              <SelectItem
                key={bt.value}
                value={bt.value}
                data-testid={`body-type-${bt.value}`}
                className="text-xs"
              >
                {bt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isRawType && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={handleOpenAI}
            data-testid="generate-body-btn"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </Button>
        )}
      </div>

      {/* AI inline prompt bar */}
      {aiOpen && isRawType && (
        <div
          className="flex items-center gap-2 border-b px-3 py-1.5"
          data-testid="ai-body-bar"
        >
          <Input
            autoFocus
            className="h-7 flex-1 text-xs"
            placeholder="Describe the body you need…"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) void handleGenerate();
              if (e.key === "Escape") handleCloseAI();
            }}
            data-testid="ai-body-input"
          />
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => void handleGenerate()}
            disabled={loading || !aiPrompt.trim()}
            data-testid="ai-body-generate-btn"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Generate
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleCloseAI}
            aria-label="Close AI bar"
            data-testid="ai-body-close-btn"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          {error && (
            <p className="text-xs text-destructive" data-testid="ai-body-error">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Body content */}
      <div className="flex-1 overflow-auto" data-testid="body-editor">
        {body.type === "none" && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">{t("body.noBody")}</p>
          </div>
        )}

        {isRawType && (
          <CodeEditor
            value={body.content}
            language={body.type === "json" ? "json" : "text"}
            onChange={(value) =>
              updateTabState(tabId, { body: { ...body, content: value } })
            }
            envVariables={envVariables}
          />
        )}

        {isFormType && (
          <KVTable
            rows={body.formData ?? []}
            onChange={handleFormDataChange}
            keyPlaceholder={t("body.keyPlaceholder")}
            valuePlaceholder={t("body.valuePlaceholder")}
          />
        )}
      </div>
    </div>
  );
}
