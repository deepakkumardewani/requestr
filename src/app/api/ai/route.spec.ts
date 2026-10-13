/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Mock the entire ai and @ai-sdk/deepseek modules
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn((opts) => opts),
  },
}));

vi.mock("@ai-sdk/deepseek", () => ({
  createDeepSeek: vi.fn(() => vi.fn(() => "mocked-model")),
}));

import { generateText } from "ai";

const mockGenerateText = vi.mocked(generateText);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai", () => {
  beforeEach(() => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("request validation", () => {
    it("returns 400 for an unknown action", async () => {
      const res = await POST(makeRequest({ action: "do-magic", payload: {} }));
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("unknown action");
    });

    it("returns 400 when action is missing", async () => {
      const res = await POST(makeRequest({ payload: {} }));
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("unknown action");
    });

    it("returns 400 for invalid JSON body", async () => {
      const req = new Request("http://localhost/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("failure responses carry only a Relay code", () => {
    const BANNED = /deepseek|openai|anthropic|claude|gpt|api[_-]?key/i;

    it("returns not_configured (500) without naming the env var when the key is absent", async () => {
      vi.stubEnv("DEEPSEEK_API_KEY", "");
      vi.stubEnv("RELAY_API_KEY", "");
      const res = await POST(
        makeRequest({ action: "summarize-response", payload: {} }),
      );
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: "not_configured" });
      expect(text).not.toMatch(BANNED);
    });

    it("drops provider text from an upstream failure", async () => {
      mockGenerateText.mockRejectedValueOnce(
        Object.assign(new Error("DeepSeek says: bad key sk-123 (request_id: x)"), {
          statusCode: 401,
        }),
      );
      const res = await POST(
        makeRequest({ action: "summarize-response", payload: {} }),
      );
      const text = await res.text();
      expect(res.status).toBe(500);
      expect(JSON.parse(text)).toEqual({ error: "not_configured" });
      expect(text).not.toMatch(BANNED);
      expect(text).not.toContain("sk-123");
    });

    it("maps an unknown failure to relay_unavailable", async () => {
      mockGenerateText.mockRejectedValueOnce(new Error("socket hang up"));
      const res = await POST(
        makeRequest({ action: "write-script", payload: {} }),
      );
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "relay_unavailable" });
    });

    it("maps 429 to rate_limited with status 429", async () => {
      mockGenerateText.mockRejectedValueOnce({ statusCode: 429 });
      const res = await POST(
        makeRequest({ action: "write-script", payload: {} }),
      );
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ error: "rate_limited" });
    });
  });

  describe("valid actions return 200", () => {
    it("suggest-assertions returns structured array", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: [
          { source: "status", operator: "eq", expectedValue: "200" },
        ],
      } as any);

      const res = await POST(
        makeRequest({
          action: "suggest-assertions",
          payload: { status: 200, headers: {}, bodySnippet: '{"id":1}' },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("write-script returns { code }", async () => {
      mockGenerateText.mockResolvedValueOnce({ text: "console.log(rq.response.status);" } as any);

      const res = await POST(
        makeRequest({
          action: "write-script",
          payload: { scriptType: "post", description: "log status", context: {} },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { code: string };
      expect(typeof data.code).toBe("string");
    });

    it("explain-error returns { explanation }", async () => {
      mockGenerateText.mockResolvedValueOnce({ text: "The server rejected your request." } as any);

      const res = await POST(
        makeRequest({
          action: "explain-error",
          payload: { status: 422, bodySnippet: "", contentType: "application/json" },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { explanation: string };
      expect(typeof data.explanation).toBe("string");
    });

    it("generate-body returns { content }", async () => {
      mockGenerateText.mockResolvedValueOnce({ text: '{"name":"Alice"}' } as any);

      const res = await POST(
        makeRequest({
          action: "generate-body",
          payload: { description: "user object", bodyType: "json", url: "/users", method: "POST" },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { content: string };
      expect(typeof data.content).toBe("string");
    });

    it("build-request returns structured object", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: {
          method: "GET",
          url: "https://api.example.com/users",
          headers: [],
          params: [{ key: "page", value: "1" }],
          bodyType: "none",
        },
      } as any);

      const res = await POST(
        makeRequest({
          action: "build-request",
          payload: { description: "get users page 1" },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { method: string };
      expect(data.method).toBeDefined();
    });

    it("suggest-jsonpath returns { expression }", async () => {
      mockGenerateText.mockResolvedValueOnce({ text: "$.data[0].email" } as any);

      const res = await POST(
        makeRequest({
          action: "suggest-jsonpath",
          payload: { description: "first user email", bodySnippet: '{"data":[{"email":"a@b.com"}]}' },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { expression: string };
      expect(typeof data.expression).toBe("string");
    });

    it("summarize-response returns { summary }", async () => {
      mockGenerateText.mockResolvedValueOnce({ text: "Response contains 10 users." } as any);

      const res = await POST(
        makeRequest({
          action: "summarize-response",
          payload: { status: 200, headers: {}, bodySnippet: '{"users":[]}' },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { summary: string };
      expect(typeof data.summary).toBe("string");
    });

    it("suggest-headers returns array", async () => {
      mockGenerateText.mockResolvedValueOnce({
        output: [{ key: "Accept", value: "application/json" }],
      } as any);

      const res = await POST(
        makeRequest({
          action: "suggest-headers",
          payload: { url: "https://api.example.com", method: "POST", bodyType: "json", existingKeys: [] },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
