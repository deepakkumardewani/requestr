"use client";

import { BookOpen, Eraser, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnvVariableKeys } from "@/hooks/useEnvVariableKeys";
import { TOUR_ANCHORS } from "@/lib/tour/tourAnchors";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { AuthEditor } from "../AuthEditor";
import { GraphQLSchemaExplorer } from "../GraphQLSchemaExplorer";
import { HeadersEditor } from "../HeadersEditor";

const CodeEditor = dynamic(() => import("../CodeEditor"), { ssr: false });

type GraphQLTabsProps = {
  tabId: string;
};

export function GraphQLTabs({ tabId }: GraphQLTabsProps) {
  const { tabs, updateTabState } = useTabsStore();
  const { sslVerify, followRedirects } = useSettingsStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const envVariables = useEnvVariableKeys();
  const [schemaOpen, setSchemaOpen] = useState(false);

  if (!tab || tab.type !== "graphql") return null;

  const enabledHeadersCount = tab.headers.filter(
    (h) => h.enabled && h.key,
  ).length;

  function handleFieldSnippet(snippet: string) {
    if (!tab || tab.type !== "graphql") return;
    const current = tab.query.trimEnd();

    // The root field name is the first word of the snippet (before any `(` or ` `)
    const rootFieldName = snippet.split(/[\s(]/)[0];
    // Reject if the same root field already exists anywhere in the query
    if (rootFieldName && new RegExp(`\\b${rootFieldName}\\b`).test(current)) {
      return;
    }

    // Indent every line of the snippet by 2 spaces for the selection set level
    const indented = snippet
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    let newQuery: string;
    if (!current) {
      newQuery = `{\n${indented}\n}`;
    } else if (current.endsWith("}")) {
      newQuery = `${current.slice(0, -1).trimEnd()}\n${indented}\n}`;
    } else {
      newQuery = `${current}\n${indented}`;
    }
    updateTabState(tabId, { query: newQuery });
  }

  const effectiveSslVerify =
    tab.sslVerify !== undefined ? tab.sslVerify : sslVerify;
  const effectiveFollowRedirects =
    tab.followRedirects !== undefined ? tab.followRedirects : followRedirects;

  return (
    <Tabs defaultValue="query" className="flex h-full flex-col">
      <div className="flex items-center border-b">
        <TabsList
          data-tour={TOUR_ANCHORS.requestTabs}
          className="h-9 shrink-0 rounded-none bg-transparent px-3 justify-start gap-0 border-b-0"
        >
          <TabsTrigger
            value="query"
            data-testid="request-tab-graphql-query"
            className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            Query
          </TabsTrigger>
          <TabsTrigger
            value="variables"
            data-testid="request-tab-graphql-variables"
            className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            Variables
          </TabsTrigger>
          <TabsTrigger
            value="headers"
            data-testid="request-tab-headers"
            className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            Headers
            {enabledHeadersCount > 0 && (
              <span className="ml-1 rounded-full bg-theme-accent/20 px-1.5 py-0.5 text-[10px] text-theme-accent">
                {enabledHeadersCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="auth"
            data-testid="request-tab-auth"
            className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
          >
            Auth
            {tab.auth.type !== "none" && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-theme-accent" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Clear query + Schema toggle */}
        <div className="ml-auto mr-2 flex items-center gap-1">
          {tab.query.trim() && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5 text-[11px] text-muted-foreground hover:text-destructive"
              onClick={() => updateTabState(tabId, { query: "" })}
              title="Clear query"
            >
              <Eraser className="h-3 w-3" />
              Clear
            </Button>
          )}
          <Button
            variant={schemaOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-6 gap-1.5 text-[11px]"
            onClick={() => setSchemaOpen((o) => !o)}
            data-testid="graphql-schema-toggle"
            aria-pressed={schemaOpen}
          >
            {schemaOpen ? (
              <X className="h-3 w-3" />
            ) : (
              <BookOpen className="h-3 w-3" />
            )}
            Schema
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main tab content */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="query" className="mt-0 h-full overflow-hidden">
            <div className="h-full" data-testid="graphql-query-editor">
              <CodeEditor
                value={tab.query}
                language="javascript"
                onChange={(value) => updateTabState(tabId, { query: value })}
                envVariables={envVariables}
                className="h-full min-h-[200px]"
              />
            </div>
          </TabsContent>
          <TabsContent
            value="variables"
            className="mt-0 h-full overflow-hidden"
          >
            <div className="h-full" data-testid="graphql-variables-editor">
              <CodeEditor
                value={tab.variables}
                language="json"
                onChange={(value) =>
                  updateTabState(tabId, { variables: value })
                }
                envVariables={envVariables}
                className="h-full min-h-[200px]"
              />
            </div>
          </TabsContent>
          <TabsContent value="headers" className="mt-0 h-full overflow-auto">
            <HeadersEditor tabId={tabId} />
          </TabsContent>
          <TabsContent value="auth" className="mt-0 h-full overflow-auto">
            <AuthEditor tabId={tabId} />
          </TabsContent>
        </div>

        {/* Schema explorer panel — always mounted to preserve fetched schema state */}
        <div
          className="w-72 shrink-0 border-l overflow-hidden"
          data-testid="graphql-schema-explorer"
          style={{ display: schemaOpen ? undefined : "none" }}
        >
          <GraphQLSchemaExplorer
            url={tab.url}
            headers={tab.headers}
            sslVerify={effectiveSslVerify}
            followRedirects={effectiveFollowRedirects}
            onFieldSnippet={handleFieldSnippet}
          />
        </div>
      </div>
    </Tabs>
  );
}
