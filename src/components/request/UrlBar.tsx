"use client";

import { BookmarkPlus, Copy, Globe, Loader2, Send, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { EnvAutocompleteInput } from "@/components/common/EnvAutocompleteInput";
import { MethodBadge } from "@/components/common/MethodBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAI } from "@/hooks/useAI";
import { useSaveRequest } from "@/hooks/useSaveRequest";
import { HTTP_METHODS } from "@/lib/constants";
import { generateCurl } from "@/lib/curlGenerator";
import { CurlParseError, parseCurl } from "@/lib/curlParser";
import { modKey } from "@/lib/platform";
import {
  cn,
  generateId,
  isRelativeOrPathOnlyUrl,
  syncParamsFromUrl,
} from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { BodyType, HttpMethod, HttpTab, KVPair } from "@/types";
import { ConnectButton } from "./ConnectButton";
import { ShareButton } from "./ShareButton";

type BuildRequestResult = {
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string }>;
  params: Array<{ key: string; value: string }>;
  bodyType?: BodyType;
  bodyContent?: string;
};

type AIRequestBuilderProps = {
  tabId: string;
  currentUrl: string;
  onClose: () => void;
};

function AIRequestBuilder({
  tabId,
  currentUrl,
  onClose,
}: AIRequestBuilderProps) {
  const { updateTabState, tabs } = useTabsStore();
  const tab = tabs.find((t) => t.tabId === tabId) as HttpTab | undefined;
  const { run, loading, error } = useAI<BuildRequestResult>("build-request");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<BuildRequestResult | null>(null);

  async function handleGenerate() {
    const result = await run({ description, currentUrl });
    if (result) setPreview(result);
  }

  function handleApply() {
    if (!preview || !tab) return;

    const headers: KVPair[] = preview.headers.map((h) => ({
      id: generateId(),
      key: h.key,
      value: h.value,
      enabled: true,
    }));

    const params: KVPair[] = preview.params.map((p) => ({
      id: generateId(),
      key: p.key,
      value: p.value,
      enabled: true,
      type: "query" as const,
    }));

    updateTabState(tabId, {
      method: preview.method,
      url: preview.url,
      headers,
      params,
      ...(preview.bodyType && preview.bodyType !== "none"
        ? {
            body: {
              type: preview.bodyType,
              content: preview.bodyContent ?? "",
            },
          }
        : {}),
    });

    toast.success("Request applied");
    onClose();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 pb-2">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Describe the API call
        </label>
        <Textarea
          data-testid="ai-builder-input"
          placeholder="e.g. POST a new user to JSONPlaceholder with name and email"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setPreview(null);
          }}
          className="min-h-[80px] resize-none text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleGenerate();
            }
          }}
        />
        {error && (
          <p
            className="text-xs text-destructive"
            data-testid="ai-builder-error"
          >
            {error}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => void handleGenerate()}
          disabled={loading || !description.trim()}
          data-testid="ai-builder-generate-btn"
          className="self-end"
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Generate
        </Button>
      </div>

      {preview && (
        <div
          className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3"
          data-testid="ai-builder-preview"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Preview
          </p>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="shrink-0 font-mono text-xs text-theme-accent border-theme-accent/30"
            >
              {preview.method}
            </Badge>
            <span
              className="truncate font-mono text-xs text-foreground"
              data-testid="preview-url"
            >
              {preview.url}
            </span>
          </div>

          {preview.headers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {preview.headers.length} header
              {preview.headers.length !== 1 ? "s" : ""}
              {preview.headers
                .slice(0, 2)
                .map((h) => ` · ${h.key}`)
                .join("")}
              {preview.headers.length > 2 ? " ···" : ""}
            </p>
          )}

          {preview.params.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {preview.params.length} param
              {preview.params.length !== 1 ? "s" : ""}
            </p>
          )}

          {preview.bodyType &&
            preview.bodyType !== "none" &&
            preview.bodyContent && (
              <div className="rounded border border-border bg-background p-2">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">
                  {preview.bodyType}
                </p>
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all text-[11px]">
                  {preview.bodyContent.slice(0, 300)}
                  {preview.bodyContent.length > 300 ? "…" : ""}
                </pre>
              </div>
            )}

          <Button
            size="sm"
            onClick={handleApply}
            className="self-end"
            data-testid="ai-builder-apply-btn"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}

const TYPE_BADGE_CLASS =
  "flex h-8 w-[110px] shrink-0 items-center justify-center rounded border border-theme-accent/20 bg-theme-accent/5 text-xs font-semibold text-theme-accent";

type UrlBarProps = {
  tabId: string;
  send: () => void;
  cancel: () => void;
  isLoading: boolean;
};

export function UrlBar({ tabId, send, cancel, isLoading }: UrlBarProps) {
  const t = useTranslations("common");
  const { save } = useSaveRequest();
  const { tabs, updateTabState } = useTabsStore();
  const resolveVariables = useEnvironmentsStore((s) => s.resolveVariables);
  const globalBaseUrl = useSettingsStore((s) => s.globalBaseUrl.trim());
  const tab = tabs.find((t) => t.tabId === tabId);
  const handleSend = () => send();
  const [builderOpen, setBuilderOpen] = useState(false);

  if (!tab) return null;

  if (tab.type === "graphql") {
    function handleGraphQLUrlChange(url: string) {
      updateTabState(tabId, { url });
    }

    const gqlShowBase =
      Boolean(globalBaseUrl) && isRelativeOrPathOnlyUrl(tab.url);

    return (
      <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
        <span className={cn(TYPE_BADGE_CLASS, "font-mono tracking-wide")}>
          GQL
        </span>
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-input bg-background shadow-xs">
          {gqlShowBase ? (
            <span
              className="flex max-w-[min(42%,14rem)] shrink-0 items-center border-r border-border bg-muted/35 px-2 py-1.5 text-[11px] font-mono text-muted-foreground"
              title={`${globalBaseUrl} + path in the field`}
            >
              <Globe className="mr-1 h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{globalBaseUrl}</span>
            </span>
          ) : null}
          <EnvAutocompleteInput
            value={tab.url}
            placeholder={
              gqlShowBase ? "/graphql" : "https://api.example.com/graphql"
            }
            onChange={(e) => handleGraphQLUrlChange(e.target.value)}
            data-testid="url-input"
            className="min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TooltipProvider delay={600}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={save}
                    disabled={!!tab.requestId && !tab.isDirty}
                    data-testid="save-request-btn"
                  />
                }
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                {t("save")}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("save")} <Kbd>{modKey()}+S</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    className="h-8 min-w-[80px] gap-1.5 bg-theme-accent text-[#0d1117] text-xs font-semibold hover:bg-theme-accent/90"
                    onClick={isLoading ? cancel : handleSend}
                    data-testid="send-request-btn"
                  />
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("cancel")}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {t("send")}
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("send")} <Kbd>{modKey()}+Enter</Kbd>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  }

  if (tab.type === "websocket") {
    function handleWsUrlChange(url: string) {
      updateTabState(tabId, { url });
    }

    return (
      <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
        <span className={TYPE_BADGE_CLASS}>WS</span>
        <EnvAutocompleteInput
          value={tab.url}
          placeholder="wss://echo.example.com"
          onChange={(e) => handleWsUrlChange(e.target.value)}
          data-testid="url-input"
        />
        <ConnectButton tabId={tabId} type="websocket" />
      </div>
    );
  }

  if (tab.type === "socketio") {
    function handleSocketIoUrlChange(url: string) {
      updateTabState(tabId, { url });
    }

    return (
      <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
        <span className={TYPE_BADGE_CLASS}>SIO</span>
        <EnvAutocompleteInput
          value={tab.url}
          placeholder="http://localhost:3000"
          onChange={(e) => handleSocketIoUrlChange(e.target.value)}
          data-testid="url-input"
        />
        <ConnectButton tabId={tabId} type="socketio" />
      </div>
    );
  }

  if (tab.type !== "http") return null;

  const httpTab: HttpTab = tab;

  function handleMethodChange(method: HttpMethod | null) {
    if (!method) return;
    updateTabState(tabId, { method });
  }

  function handleUrlChange(url: string) {
    const { pathParams, queryParams } = syncParamsFromUrl(url, httpTab.params);
    updateTabState(tabId, { url, params: [...pathParams, ...queryParams] });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.trimStart().toLowerCase().startsWith("curl ")) return;

    e.preventDefault();
    try {
      const parsed = parseCurl(pasted);
      updateTabState(tabId, {
        url: parsed.url,
        method: parsed.method,
        headers: parsed.headers,
        body: parsed.body,
        auth: parsed.auth,
        name: httpTab.name === "New Request" ? "New Request" : httpTab.name,
      });
      toast.success("cURL imported", {
        description: `${parsed.method} ${parsed.url}`,
      });
    } catch (err) {
      toast.error("Failed to parse cURL", {
        description:
          err instanceof CurlParseError ? err.message : "Invalid cURL command",
      });
    }
  }

  async function handleCopyCurl() {
    const resolve = resolveVariables;
    const resolvedTab: HttpTab = {
      ...httpTab,
      url: resolve(httpTab.url),
      params: httpTab.params.map((p) => ({ ...p, value: resolve(p.value) })),
      headers: httpTab.headers.map((h) => ({
        ...h,
        key: resolve(h.key),
        value: resolve(h.value),
      })),
      body: {
        ...httpTab.body,
        content: httpTab.body.content
          ? resolve(httpTab.body.content)
          : httpTab.body.content,
        formData: httpTab.body.formData?.map((f) => ({
          ...f,
          key: resolve(f.key),
          value: resolve(f.value),
        })),
      },
    };
    const curl = generateCurl(resolvedTab);
    try {
      await navigator.clipboard.writeText(curl);
      toast.success("cURL copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  const httpShowBase =
    Boolean(globalBaseUrl) && isRelativeOrPathOnlyUrl(httpTab.url);

  return (
    <>
      <Sheet open={builderOpen} onOpenChange={setBuilderOpen}>
        <SheetContent
          side="right"
          className="flex w-[420px] flex-col sm:max-w-[420px]"
        >
          <SheetHeader>
            <SheetTitle>AI Request Builder</SheetTitle>
            <SheetDescription>
              Describe the API call and AI will generate the full request for
              you.
            </SheetDescription>
          </SheetHeader>
          <AIRequestBuilder
            tabId={tabId}
            currentUrl={httpTab.url}
            onClose={() => setBuilderOpen(false)}
          />
          <SheetFooter className="flex-row justify-end gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBuilderOpen(false)}
              data-testid="ai-builder-discard-btn"
            >
              Discard
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
        {/* Method Selector */}
        <Select value={httpTab.method} onValueChange={handleMethodChange}>
          <SelectTrigger
            data-testid="method-selector"
            className="h-8 w-[110px] shrink-0 border-method-accent/20 bg-method-accent/5 text-xs font-medium"
          >
            <SelectValue>
              <MethodBadge method={httpTab.method} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map((m) => (
              <SelectItem
                key={m}
                value={m}
                data-testid={`method-${m.toLowerCase()}`}
              >
                <MethodBadge method={m} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* URL + global base hint */}
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-input bg-background shadow-xs">
          {httpShowBase ? (
            <span
              className="flex max-w-[min(42%,14rem)] shrink-0 items-center border-r border-border bg-muted/35 px-2 py-1.5 text-[11px] font-mono text-muted-foreground"
              title={`${globalBaseUrl} + path in the field`}
            >
              <Globe className="mr-1 h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{globalBaseUrl}</span>
            </span>
          ) : null}
          <EnvAutocompleteInput
            value={httpTab.url}
            placeholder={
              httpShowBase
                ? "/posts?user=1"
                : "https://api.example.com/v1/users"
            }
            onChange={(e) => handleUrlChange(e.target.value)}
            onPaste={handlePaste}
            data-testid="url-input"
            className="min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyCurl}
                />
              }
            >
              <Copy className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>{t("copyAsCurl")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBuilderOpen(true)}
                  data-testid="ai-builder-wand-btn"
                />
              }
            >
              <Wand2 className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>Build with AI</TooltipContent>
          </Tooltip>

          <ShareButton tabId={tabId} />

          <TooltipProvider delay={600}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={save}
                    disabled={!!httpTab.requestId && !httpTab.isDirty}
                    data-testid="save-request-btn"
                  />
                }
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                {t("save")}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("save")} <Kbd>{modKey()}+S</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    className="h-8 min-w-[80px] gap-1.5 bg-theme-accent text-[#0d1117] text-xs font-semibold hover:bg-theme-accent/90"
                    onClick={isLoading ? cancel : handleSend}
                    data-testid="send-request-btn"
                  />
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("cancel")}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {t("send")}
                  </>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("send")} <Kbd>{modKey()}+Enter</Kbd>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
