import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, test } from "@playwright/test";
import { io } from "socket.io-client";
import {
  MOCK_BASE_URL,
  MOCK_HTTPS_URL,
  MOCK_WS_URL,
  TEST_ID_HEADER,
} from "./support/mock-server/mockBaseUrl";

interface LoggedRequest {
  kind: string;
  event: string;
  path?: string;
  headers?: Record<string, string>;
}

const LARGE_BYTES = 200_000;
const BINARY_BYTES = 300;
const DELAY_MS = 300;

/** Each test gets its own id so parallel workers never see each other's traffic. */
function newTestId(): string {
  return `smoke-${randomUUID()}`;
}

async function fetchLog(
  request: APIRequestContext,
  testId: string,
): Promise<LoggedRequest[]> {
  const res = await request.get(`${MOCK_BASE_URL}/__requests`, {
    headers: { [TEST_ID_HEADER]: testId },
  });
  return (await res.json()).requests;
}

test.describe("Mock server smoke", () => {
  test("health endpoint answers", async ({ request }) => {
    const res = await request.get(`${MOCK_BASE_URL}/__health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("echo returns method, headers, query and JSON body", async ({ request }) => {
    const testId = newTestId();
    const res = await request.post(`${MOCK_BASE_URL}/echo?a=1&a=2&b=x`, {
      headers: { [TEST_ID_HEADER]: testId },
      data: { key: "value" },
    });
    const body = await res.json();
    expect(body.method).toBe("POST");
    expect(body.query).toEqual({ a: ["1", "2"], b: "x" });
    expect(body.body).toEqual({ key: "value" });
    expect(body.rawBody).toBe('{"key":"value"}');
    expect(body.headers[TEST_ID_HEADER]).toBe(testId);
  });

  test("echo parses urlencoded and multipart bodies", async ({ request }) => {
    const urlencoded = await request.post(`${MOCK_BASE_URL}/echo`, {
      form: { name: "ada", role: "admin" },
    });
    expect((await urlencoded.json()).body).toEqual({ name: "ada", role: "admin" });

    const multipart = await request.post(`${MOCK_BASE_URL}/echo`, {
      multipart: {
        field: "v",
        upload: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("hi") },
      },
    });
    const body = await multipart.json();
    expect(body.body).toEqual({ field: "v" });
    expect(body.files).toEqual([
      {
        field: "upload",
        name: "a.txt",
        size: 2,
        type: expect.stringContaining("text/plain"),
      },
    ]);
  });

  test("status and delay controls apply to any path", async ({ request }) => {
    const startedAt = Date.now();
    const res = await request.get(
      `${MOCK_BASE_URL}/anything/at/all?status=418&delay=${DELAY_MS}`,
    );
    expect(res.status()).toBe(418);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(DELAY_MS - 20);
  });

  test("redirect honors status and chains hops", async ({ request }) => {
    const single = await request.get(
      `${MOCK_BASE_URL}/redirect?to=/echo&status=307`,
      { maxRedirects: 0 },
    );
    expect(single.status()).toBe(307);
    expect(single.headers().location).toBe("/echo");

    const chained = await request.get(`${MOCK_BASE_URL}/redirect?to=/echo&hops=3`);
    expect(chained.status()).toBe(200);
    expect(new URL(chained.url()).pathname).toBe("/echo");
  });

  test("slow endpoint delays the response", async ({ request }) => {
    const startedAt = Date.now();
    await request.get(`${MOCK_BASE_URL}/slow?delay=${DELAY_MS}`);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(DELAY_MS - 20);
  });

  test("cookies endpoint sends multiple Set-Cookie headers", async ({ request }) => {
    const res = await request.get(`${MOCK_BASE_URL}/cookies`);
    const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
    expect(cookies).toHaveLength(2);
  });

  test("large and binary endpoints return the requested size", async ({ request }) => {
    const large = await request.get(`${MOCK_BASE_URL}/large?bytes=${LARGE_BYTES}`);
    expect((await large.body()).length).toBe(LARGE_BYTES);

    const binary = await request.get(`${MOCK_BASE_URL}/binary?bytes=${BINARY_BYTES}`);
    expect(binary.headers()["content-type"]).toBe("application/octet-stream");
    const bytes = await binary.body();
    expect(bytes.length).toBe(BINARY_BYTES);
    expect(bytes[255]).toBe(255);
    expect(bytes[256]).toBe(0);
  });

  test("request log is namespaced by test id and reset is scoped", async ({ request }) => {
    const mine = newTestId();
    const other = newTestId();
    await request.get(`${MOCK_BASE_URL}/echo?who=mine`, { headers: { [TEST_ID_HEADER]: mine } });
    await request.get(`${MOCK_BASE_URL}/echo?who=other`, { headers: { [TEST_ID_HEADER]: other } });

    const mineLog = await fetchLog(request, mine);
    expect(mineLog).toHaveLength(1);
    expect(mineLog[0].headers?.[TEST_ID_HEADER]).toBe(mine);

    await request.post(`${MOCK_BASE_URL}/__reset`, { headers: { [TEST_ID_HEADER]: mine } });
    expect(await fetchLog(request, mine)).toHaveLength(0);
    expect(await fetchLog(request, other)).toHaveLength(1);
  });

  test("websocket echoes frames and logs connect and close", async ({ request }) => {
    const testId = newTestId();
    const echoed = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`${MOCK_WS_URL}?testId=${testId}`);
      socket.onopen = () => socket.send("ping");
      socket.onmessage = (event) => {
        socket.close();
        resolve(String(event.data));
      };
      socket.onerror = () => reject(new Error("websocket error"));
    });
    expect(echoed).toBe("ping");

    await expect
      .poll(async () => (await fetchLog(request, testId)).map((e) => e.event))
      .toEqual(expect.arrayContaining(["connect", "message", "close"]));
  });

  test("socket.io echoes message and custom events", async () => {
    const socket = io(MOCK_BASE_URL, { query: { testId: newTestId() }, transports: ["websocket"] });
    try {
      const message = new Promise((resolve) => socket.on("message", resolve));
      const custom = new Promise((resolve) => socket.on("custom-event", resolve));
      socket.emit("message", "hello");
      socket.emit("custom-event", { n: 1 });
      expect(await message).toBe("hello");
      expect(await custom).toEqual({ n: 1 });
    } finally {
      socket.close();
    }
  });

  test("socket.io forced failure raises connect_error", async () => {
    const socket = io(`${MOCK_BASE_URL}?fail=1`, {
      query: { testId: newTestId() },
      reconnection: false,
    });
    try {
      const error = await new Promise<Error>((resolve) => socket.on("connect_error", resolve));
      expect(error.message).toBe("forced connect failure");
    } finally {
      socket.close();
    }
  });

  test("graphql supports introspection, header echo, errors and 400", async ({ request }) => {
    const post = (data: object, headers: Record<string, string> = {}) =>
      request.post(`${MOCK_BASE_URL}/graphql`, { data, headers });

    const introspection = await post({
      query: "{__schema{queryType{fields{name args{name}}}}}",
    });
    const fields = (await introspection.json()).data.__schema.queryType.fields;
    expect(fields.find((f: { name: string }) => f.name === "hello").args).toEqual([{ name: "name" }]);

    const echoed = await post({ query: "{ headers }" }, { "x-custom": "yes" });
    expect((await echoed.json()).data.headers).toContain('"x-custom":"yes"');

    const errors = await post({ query: "{ hello }", operationName: "ForceErrors" });
    expect(errors.status()).toBe(200);
    expect((await errors.json()).errors).toHaveLength(1);

    const bad = await post({ query: "{ hello }", operationName: "BadRequest" });
    expect(bad.status()).toBe(400);
  });

  test("https listener serves /echo with a self-signed certificate", async ({ playwright }) => {
    const strict = await playwright.request.newContext();
    await expect(strict.get(`${MOCK_HTTPS_URL}/echo`)).rejects.toThrow();
    await strict.dispose();

    const lenient = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    const res = await lenient.get(`${MOCK_HTTPS_URL}/echo?via=https`);
    expect(res.status()).toBe(200);
    expect((await res.json()).query).toEqual({ via: "https" });
    await lenient.dispose();
  });
});
