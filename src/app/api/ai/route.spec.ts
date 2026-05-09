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
  const originalKey = process.env.DEEPSEEK_API_KEY;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.DEEPSEEK_API_KEY = originalKey;
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

  describe("missing API key", () => {
    it("returns 500 with a readable message when DEEPSEEK_API_KEY is absent", async () => {
      delete process.env.DEEPSEEK_API_KEY;
      // generateText throws because getDeepseek() throws before calling it
      const res = await POST(
        makeRequest({ action: "summarize-response", payload: {} }),
      );
      expect(res.status).toBe(500);
      const data = (await res.json()) as { error: string };
      expect(data.error).toMatch(/DEEPSEEK_API_KEY/);
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
