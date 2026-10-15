import { describe, expect, it } from "vitest";
import type { ResponseData, TabState } from "@/types";
import { deriveSuggestions, fillSuggestions, SUGGESTION_COUNT } from "./suggestions";

const httpTab = (type: "http" = "http"): TabState => ({
  tabId: "t1",
  requestId: "r1",
  name: "Test",
  isDirty: false,
  type,
  url: "https://api.test",
  headers: [],
  method: "GET",
  params: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
});

const graphqlTab = (): TabState => ({
  tabId: "t1",
  requestId: "r1",
  name: "Test",
  isDirty: false,
  type: "graphql",
  url: "https://api.test",
  headers: [],
  query: "",
  variables: "",
  operationName: "",
  auth: { type: "none" },
});

const wsTab = (): TabState => ({
  tabId: "t1",
  requestId: "r1",
  name: "Test",
  isDirty: false,
  type: "websocket",
  url: "ws://api.test",
  headers: [],
  messageLog: [],
});

const socketioTab = (): TabState => ({
  tabId: "t1",
  requestId: "r1",
  name: "Test",
  isDirty: false,
  type: "socketio",
  url: "ws://api.test",
  headers: [],
  messageLog: [],
});

const response = (status: number): ResponseData => ({
  status,
  statusText: "OK",
  headers: {},
  body: "response",
  duration: 100,
  size: 10,
  url: "https://api.test",
  method: "GET",
  timestamp: Date.now(),
});

describe("deriveSuggestions", () => {
  it("suggests 'createRequest' when no tab is open", () => {
    expect(deriveSuggestions(null, null)).toEqual(["createRequest"]);
  });

  describe("HTTP tab", () => {
    it("suggests 'whyDidThisFail' and 'checkHeaders' for 5xx status", () => {
      const suggestions = deriveSuggestions(httpTab(), response(500));
      expect(suggestions[0]).toBe("whyDidThisFail");
      expect(suggestions).toContain("checkHeaders");
    });

    it("suggests 'whyDidThisFail' and 'checkHeaders' for 4xx status", () => {
      const suggestions = deriveSuggestions(httpTab(), response(404));
      expect(suggestions[0]).toBe("whyDidThisFail");
      expect(suggestions).toContain("checkHeaders");
    });

    it("suggests 'whyDidThisFail' for 400 boundary status", () => {
      const suggestions = deriveSuggestions(httpTab(), response(400));
      expect(suggestions[0]).toBe("whyDidThisFail");
    });

    it("suggests 'addAssertions' and 'explainResponse' for 2xx with response", () => {
      const suggestions = deriveSuggestions(httpTab(), response(200));
      expect(suggestions[0]).toBe("addAssertions");
      expect(suggestions).toContain("explainResponse");
    });

    it("suggests 'summarizeRequest' and 'checkHeaders' for 2xx without response", () => {
      const suggestions = deriveSuggestions(httpTab(), null);
      expect(suggestions).toContain("summarizeRequest");
      expect(suggestions).toContain("checkHeaders");
    });

    it("never suggests 'whyDidThisFail' for 3xx status", () => {
      const suggestions = deriveSuggestions(httpTab(), response(301));
      expect(suggestions).not.toContain("whyDidThisFail");
    });
  });

  describe("GraphQL tab", () => {
    it("includes failed response suggestion when status is 5xx", () => {
      const suggestions = deriveSuggestions(graphqlTab(), response(500));
      expect(suggestions[0]).toBe("whyDidThisFail");
      expect(suggestions).toContain("graphqlExplainQuery");
    });

    it("omits failed response suggestion when status is 2xx", () => {
      const suggestions = deriveSuggestions(graphqlTab(), response(200));
      expect(suggestions).not.toContain("whyDidThisFail");
      expect(suggestions).toContain("graphqlExplainQuery");
      expect(suggestions).toContain("graphqlAddVariables");
    });

    it("includes 'summarizeRequest' and 'checkHeaders' regardless of response", () => {
      const suggestions = deriveSuggestions(graphqlTab(), null);
      expect(suggestions).toContain("summarizeRequest");
      expect(suggestions).toContain("checkHeaders");
    });

    it("provides all expected GraphQL suggestions", () => {
      const suggestions = deriveSuggestions(graphqlTab(), response(200));
      expect(suggestions).toContain("graphqlExplainQuery");
      expect(suggestions).toContain("graphqlAddVariables");
      expect(suggestions).toContain("summarizeRequest");
      expect(suggestions).toContain("checkHeaders");
    });
  });

  describe("WebSocket tab", () => {
    it("provides WebSocket-specific suggestions", () => {
      const suggestions = deriveSuggestions(wsTab(), null);
      expect(suggestions).toContain("websocketExplainMessages");
      expect(suggestions).toContain("websocketSendMessage");
      expect(suggestions).toContain("summarizeRequest");
      expect(suggestions).toContain("checkHeaders");
    });

    it("never includes 'whyDidThisFail' for WebSocket", () => {
      const suggestions = deriveSuggestions(wsTab(), response(500));
      expect(suggestions).not.toContain("whyDidThisFail");
    });
  });

  describe("Socket.IO tab", () => {
    it("provides Socket.IO-specific suggestions", () => {
      const suggestions = deriveSuggestions(socketioTab(), null);
      expect(suggestions).toContain("socketioExplainEvents");
      expect(suggestions).toContain("socketioSendEvent");
      expect(suggestions).toContain("summarizeRequest");
      expect(suggestions).toContain("checkHeaders");
    });

    it("never includes 'whyDidThisFail' for Socket.IO", () => {
      const suggestions = deriveSuggestions(socketioTab(), response(500));
      expect(suggestions).not.toContain("whyDidThisFail");
    });
  });
});

describe("fillSuggestions", () => {
  it("fills from derived suggestions first", () => {
    const filled = fillSuggestions(["a", "b", "c"], ["a", "d", "e"]);
    expect(filled.slice(0, 3)).toEqual(["a", "b", "c"]);
  });

  it("adds from base suggestions until reaching the limit", () => {
    const filled = fillSuggestions(["a", "b"], ["c", "d", "e", "f", "g"]);
    expect(filled).toHaveLength(SUGGESTION_COUNT);
    expect(filled).toEqual(["a", "b", "c", "d"]);
  });

  it("stops at the suggestion count", () => {
    const filled = fillSuggestions([], ["a", "b", "c", "d", "e", "f"]);
    expect(filled).toHaveLength(SUGGESTION_COUNT);
    expect(filled).toEqual(["a", "b", "c", "d"]);
  });

  it("deduplicates: derived items are not repeated from base", () => {
    const filled = fillSuggestions(["a", "b"], ["a", "b", "c", "d"]);
    expect(filled).toEqual(["a", "b", "c", "d"]);
  });

  it("handles empty derived suggestions by filling entirely from base", () => {
    const filled = fillSuggestions([], ["a", "b", "c", "d"]);
    expect(filled).toEqual(["a", "b", "c", "d"]);
  });

  it("handles duplicates within derived suggestions", () => {
    const filled = fillSuggestions(["a", "a", "b"], ["c", "d"]);
    expect(filled).toHaveLength(SUGGESTION_COUNT);
    expect(filled[0]).toBe("a");
    expect(filled[1]).toBe("b");
  });

  it("keeps all derived suggestions even if longer than the limit", () => {
    const derived = ["a", "b", "c", "d", "e"];
    const filled = fillSuggestions(derived, ["f", "g", "h"]);
    expect(filled).toEqual(["a", "b", "c", "d", "e"]);
  });
});
