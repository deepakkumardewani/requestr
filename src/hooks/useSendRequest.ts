"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { evaluateAllAssertions } from "@/lib/chainAssertions";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { runGraphQLRequest, runRequest } from "@/lib/requestRunner";
import {
  resolveGraphQLRequestTemplate,
  resolveHttpRequestTemplate,
} from "@/lib/resolveRequest";
import { runPostScript, runPreScript } from "@/lib/scriptRunner";
import { generateId } from "@/lib/utils";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { RequestError } from "@/types";

export function useSendRequest(tabId: string) {
  const abortRef = useRef<AbortController | null>(null);

  const { tabs } = useTabsStore();
  const { resolveVariables, getVariable, setVariable } = useEnvironmentsStore();
  const {
    setLoading,
    setResponse,
    setError,
    setScriptLogs,
    setAssertionResults,
    setUnresolvedVars,
    loading,
  } = useResponseStore();
  const { addEntry } = useHistoryStore();
  const { sslVerify, followRedirects, globalBaseUrl, globalHeaders } =
    useSettingsStore();

  const tab = tabs.find((t) => t.tabId === tabId);
  const isLoading = loading[tabId] ?? false;

  const envGet = (key: string) => getVariable(key);
  const envSet = (key: string, value: string) => setVariable(key, value);

  async function send(force = false) {
    if (!tab) return;
    if (tab.type !== "http" && tab.type !== "graphql") {
      toast.info("Send is not available for this tab type");
      return;
    }
    if (!tab.url.trim()) {
      toast.warning("Enter a URL to send the request");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(tabId, true);

    const allLogs: string[] = [];

    try {
      if (tab.type === "graphql") {
        // Use resolveGraphQLRequestTemplate to resolve variables
        const { resolvedRequest, unresolvedVars } =
          resolveGraphQLRequestTemplate(
            {
              url: tab.url,
              headers: tab.headers,
              query: tab.query,
              globalHeaders,
              globalBaseUrl,
            },
            resolveVariables,
          );

        const query = resolvedRequest.query.trim();
        if (!query) {
          toast.warning("Enter a GraphQL query");
          setLoading(tabId, false);
          return;
        }

        // Check for unresolved {{variable}} placeholders before dispatching
        if (!force) {
          if (unresolvedVars.length > 0) {
            setUnresolvedVars(tabId, unresolvedVars);
            setLoading(tabId, false);
            return;
          }
        }
        setUnresolvedVars(tabId, []);

        const effectiveSslVerify =
          tab.sslVerify !== undefined ? tab.sslVerify : sslVerify;
        const effectiveFollowRedirects =
          tab.followRedirects !== undefined
            ? tab.followRedirects
            : followRedirects;

        const response = await runGraphQLRequest(
          {
            url: resolvedRequest.url,
            headers: resolvedRequest.headers,
            auth: tab.auth,
            query,
            variablesJson: resolveVariables(tab.variables),
            operationName: resolveVariables(tab.operationName),
            sslVerify: effectiveSslVerify,
            followRedirects: effectiveFollowRedirects,
            timeoutMs:
              tab.timeoutMs !== undefined
                ? tab.timeoutMs
                : DEFAULT_REQUEST_TIMEOUT_MS,
          },
          abortRef.current.signal,
        );

        setResponse(tabId, response);
        return;
      }

      // ── Pre-request script (sees tab URL/headers only, not globals) ─────────
      // Extract pre-script resolved values (before global base URL and merging)
      const resolvedUrl = resolveVariables(tab.url);
      const resolvedHeaders = tab.headers.map((h) => ({
        ...h,
        key: resolveVariables(h.key),
        value: resolveVariables(h.value),
      }));
      const resolvedBody = {
        ...tab.body,
        content: resolveVariables(tab.body.content),
      };

      let effectiveUrl = resolvedUrl;
      let effectiveHeaders = resolvedHeaders;
      let effectiveBody = resolvedBody;

      if (tab.preScript.trim()) {
        const preResult = runPreScript(
          tab.preScript,
          {
            url: resolvedUrl,
            headers: resolvedHeaders,
            method: tab.method,
            body: resolvedBody,
          },
          envGet,
          envSet,
        );

        allLogs.push(...preResult.logs);

        if (preResult.error) {
          toast.error("Pre-request script error", {
            description: preResult.error,
          });
        }

        if (preResult.requestOverrides) {
          if (preResult.requestOverrides.url !== undefined) {
            effectiveUrl = preResult.requestOverrides.url;
          }
          if (preResult.requestOverrides.headers !== undefined) {
            effectiveHeaders = preResult.requestOverrides.headers;
          }
          if (preResult.requestOverrides.body !== undefined) {
            effectiveBody = preResult.requestOverrides.body;
          }
        }
      }

      // Build final request with effective values after script runs
      const {
        resolvedRequest: finalResolved,
        unresolvedVars: finalUnresolved,
      } = resolveHttpRequestTemplate(
        {
          url: effectiveUrl,
          headers: effectiveHeaders,
          params: tab.params,
          body: effectiveBody,
          globalHeaders,
          globalBaseUrl,
        },
        (text) => text, // Already resolved in pre-script, no further resolution
      );

      // Check for unresolved {{variable}} placeholders before dispatching
      if (!force) {
        if (finalUnresolved.length > 0) {
          setUnresolvedVars(tabId, finalUnresolved);
          setLoading(tabId, false);
          return;
        }
      }
      setUnresolvedVars(tabId, []);

      const finalUrl = finalResolved.url;
      const mergedHeaders = finalResolved.headers;

      const effectiveSslVerify =
        tab.sslVerify !== undefined ? tab.sslVerify : sslVerify;
      const effectiveFollowRedirects =
        tab.followRedirects !== undefined
          ? tab.followRedirects
          : followRedirects;

      const response = await runRequest(
        {
          method: tab.method,
          url: finalUrl,
          headers: mergedHeaders,
          body: effectiveBody,
          auth: tab.auth,
          sslVerify: effectiveSslVerify,
          followRedirects: effectiveFollowRedirects,
          timeoutMs:
            tab.timeoutMs !== undefined
              ? tab.timeoutMs
              : DEFAULT_REQUEST_TIMEOUT_MS,
        },
        abortRef.current.signal,
      );

      setResponse(tabId, response);

      // Evaluate no-code assertions if any are defined
      if (tab.assertions && tab.assertions.length > 0) {
        const results = evaluateAllAssertions(tab.assertions, response);
        setAssertionResults(tabId, results);
      }

      // ── Post-response script ───────────────────────────────────────────────
      if (tab.postScript.trim()) {
        const postResult = runPostScript(
          tab.postScript,
          {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: response.body,
          },
          envGet,
          envSet,
        );

        allLogs.push(...postResult.logs);

        if (postResult.error) {
          toast.error("Post-response script error", {
            description: postResult.error,
          });
        }
      }

      addEntry({
        id: generateId(),
        method: tab.method,
        url: finalUrl,
        status: response.status,
        duration: response.duration,
        size: response.size,
        timestamp: response.timestamp,
        request: tab,
        response,
      });
    } catch (err) {
      const requestError = err as RequestError;
      setError(tabId, requestError);
      toast.error(`Request failed: ${requestError.message}`, {
        description: requestError.cause,
      });
    } finally {
      setScriptLogs(tabId, allLogs);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setLoading(tabId, false);
  }

  function sendForce() {
    return send(true);
  }

  return { send, sendForce, cancel, isLoading };
}
