import { buildFinalUrl } from "@/lib/utils";
import type {
  AuthConfig,
  BodyConfig,
  EnvironmentModel,
  HttpTab,
  KVPair,
} from "@/types";

const REDACTED = "<REDACTED>";

// ---------------------------------------------------------------------------
// Variable resolution
// ---------------------------------------------------------------------------

/**
 * Builds an env map from the given environment, replacing secret variable
 * values with REDACTED so they are never exposed in generated snippets.
 */
export function resolveTabStateVars(
  tab: HttpTab,
  env: EnvironmentModel | null,
): HttpTab {
  if (!env) return tab;

  const envMap = env.variables.reduce<Record<string, string>>((acc, v) => {
    acc[v.key] = v.isSecret ? REDACTED : v.currentValue || v.initialValue;
    return acc;
  }, {});

  function sub(s: string): string {
    return s.replace(/\{\{(\w+)\}\}/g, (match, key) => envMap[key] ?? match);
  }

  function resolveKV(pairs: KVPair[]): KVPair[] {
    return pairs.map((p) => ({ ...p, key: sub(p.key), value: sub(p.value) }));
  }

  function resolveAuth(auth: AuthConfig): AuthConfig {
    switch (auth.type) {
      case "bearer":
        return { ...auth, token: sub(auth.token) };
      case "basic":
        return {
          ...auth,
          username: sub(auth.username),
          password: sub(auth.password),
        };
      case "api-key":
        return { ...auth, key: sub(auth.key), value: sub(auth.value) };
      default:
        return auth;
    }
  }

  function resolveBody(body: BodyConfig): BodyConfig {
    return {
      ...body,
      content: sub(body.content),
      formData: body.formData ? resolveKV(body.formData) : body.formData,
    };
  }

  return {
    ...tab,
    url: sub(tab.url),
    headers: resolveKV(tab.headers),
    params: resolveKV(tab.params),
    auth: resolveAuth(tab.auth),
    body: resolveBody(tab.body),
  };
}

// ---------------------------------------------------------------------------
// cURL — delegate to the existing generator
// ---------------------------------------------------------------------------

export { generateCurl } from "@/lib/curlGenerator";

// ---------------------------------------------------------------------------
// Helpers shared across generators
// ---------------------------------------------------------------------------

function buildHeadersObject(tab: HttpTab): Record<string, string> {
  const headers: Record<string, string> = {};

  if (tab.auth.type === "bearer") {
    headers.Authorization = `Bearer ${tab.auth.token}`;
  } else if (tab.auth.type === "basic") {
    const encoded = btoa(`${tab.auth.username}:${tab.auth.password}`);
    headers.Authorization = `Basic ${encoded}`;
  } else if (tab.auth.type === "api-key" && tab.auth.addTo === "header") {
    headers[tab.auth.key] = tab.auth.value;
  }

  for (const h of tab.headers.filter((h) => h.enabled && h.key)) {
    headers[h.key] = h.value;
  }

  // Auto content-type for body types that need it
  if (tab.body.type === "json" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  } else if (tab.body.type === "urlencoded" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (tab.body.type === "xml" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/xml";
  }

  return headers;
}

function buildBodyString(tab: HttpTab): string | null {
  if (tab.body.type === "none") return null;

  if (tab.body.type === "form-data" || tab.body.type === "urlencoded") {
    const fields = (tab.body.formData ?? []).filter((f) => f.enabled && f.key);
    if (fields.length === 0) return null;
    return fields
      .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join("&");
  }

  return tab.body.content || null;
}

/**
 * Escapes text for a single-quoted string literal. Shared by JS, Python, Ruby
 * and PHP, which all treat only backslash and the quote as special there.
 * Backslash first so the added escapes are not double-escaped.
 */
function escapeSingleQuoted(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Wraps text in single quotes with escaping. */
function sq(s: string): string {
  return `'${escapeSingleQuoted(s)}'`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

export function generateFetch(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const hasHeadersOrBody = Object.keys(headers).length > 0 || body !== null;
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";

  const lines: string[] = [];
  lines.push(`const response = await fetch(${sq(url)}, {`);
  lines.push(`  method: ${sq(tab.method)},`);

  if (Object.keys(headers).length > 0) {
    lines.push("  headers: {");
    for (const [k, v] of Object.entries(headers)) {
      lines.push(`    ${sq(k)}: ${sq(v)},`);
    }
    lines.push("  },");
  }

  if (body !== null && !isGetHead) {
    lines.push(`  body: ${JSON.stringify(body)},`);
  }

  lines.push("});");
  lines.push("");

  if (!hasHeadersOrBody && isGetHead) {
    // Simplify to one-liner for plain GET
    return [
      `const response = await fetch(${sq(url)});`,
      "",
      "const data = await response.json();",
      "console.log(data);",
    ].join("\n");
  }

  lines.push("const data = await response.json();");
  lines.push("console.log(data);");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// axios
// ---------------------------------------------------------------------------

export function generateAxios(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";

  const lines: string[] = [];
  lines.push("import axios from 'axios';");
  lines.push("");
  lines.push("const response = await axios({");
  lines.push(`  method: '${tab.method.toLowerCase()}',`);
  lines.push(`  url: ${sq(url)},`);

  if (Object.keys(headers).length > 0) {
    lines.push("  headers: {");
    for (const [k, v] of Object.entries(headers)) {
      lines.push(`    ${sq(k)}: ${sq(v)},`);
    }
    lines.push("  },");
  }

  if (body !== null && !isGetHead) {
    lines.push(`  data: ${JSON.stringify(body)},`);
  }

  lines.push("});");
  lines.push("");
  lines.push("console.log(response.data);");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Python requests
// ---------------------------------------------------------------------------

export function generatePython(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";

  const lines: string[] = [];
  lines.push("import requests");
  lines.push("");

  if (Object.keys(headers).length > 0) {
    lines.push("headers = {");
    for (const [k, v] of Object.entries(headers)) {
      lines.push(`    ${sq(k)}: ${sq(v)},`);
    }
    lines.push("}");
    lines.push("");
  }

  const method = tab.method.toLowerCase();
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = body !== null && !isGetHead;

  const args: string[] = [sq(url)];
  if (hasHeaders) args.push("headers=headers");
  if (hasBody) {
    if (tab.body.type === "json") {
      // Use json= kwarg for automatic serialisation
      try {
        const parsed = JSON.parse(body);
        args.push(`json=${pythonRepr(parsed)}`);
      } catch {
        args.push(`data=${JSON.stringify(body)}`);
      }
    } else {
      args.push(`data=${JSON.stringify(body)}`);
    }
  }

  lines.push(`response = requests.${method}(${args.join(", ")})`);
  lines.push("");
  lines.push("print(response.status_code)");
  lines.push("print(response.json())");

  return lines.join("\n");
}

/** Minimal Python-style repr for simple objects/arrays/primitives. */
function pythonRepr(value: unknown, depth = 0): string {
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const inner = value.map((v) => pythonRepr(v, depth + 1)).join(", ");
    return `[${inner}]`;
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    const pad = "    ".repeat(depth + 1);
    const closePad = "    ".repeat(depth);
    const inner = entries
      .map(
        ([k, v]) => `${pad}${JSON.stringify(k)}: ${pythonRepr(v, depth + 1)}`,
      )
      .join(",\n");
    return `{\n${inner},\n${closePad}}`;
  }

  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Ruby Net::HTTP
// ---------------------------------------------------------------------------

export function generateRuby(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";
  const hasBody = body !== null && !isGetHead;

  const lines: string[] = [];
  lines.push("require 'net/http'");
  lines.push("require 'uri'");
  if (hasBody && tab.body.type === "json") lines.push("require 'json'");
  lines.push("");
  lines.push(`uri = URI(${sq(url)})`);
  lines.push("http = Net::HTTP.new(uri.host, uri.port)");
  lines.push("http.use_ssl = uri.scheme == 'https'");
  lines.push("");
  lines.push(
    `request = Net::HTTP::${capitalize(tab.method.toLowerCase())}.new(uri)`,
  );

  for (const [k, v] of Object.entries(headers)) {
    lines.push(`request[${sq(k)}] = ${sq(v)}`);
  }

  if (hasBody) {
    lines.push(`request.body = ${JSON.stringify(body)}`);
  }

  lines.push("");
  lines.push("response = http.request(request)");
  lines.push("puts response.code");
  lines.push("puts response.body");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Java HttpClient (Java 11+)
// ---------------------------------------------------------------------------

export function generateJava(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";
  const hasBody = body !== null && !isGetHead;

  const lines: string[] = [];
  lines.push("import java.net.URI;");
  lines.push("import java.net.http.HttpClient;");
  lines.push("import java.net.http.HttpRequest;");
  lines.push("import java.net.http.HttpResponse;");
  lines.push("");
  lines.push("HttpClient client = HttpClient.newHttpClient();");
  lines.push("");
  lines.push("HttpRequest request = HttpRequest.newBuilder()");
  lines.push(`    .uri(URI.create(${JSON.stringify(url)}))`);

  for (const [k, v] of Object.entries(headers)) {
    lines.push(`    .header(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }

  if (hasBody) {
    lines.push(
      `    .method(${JSON.stringify(tab.method)}, HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)}))`,
    );
  } else {
    lines.push(
      `    .${tab.method === "GET" ? "GET()" : `method(${JSON.stringify(tab.method)}, HttpRequest.BodyPublishers.noBody())`}`,
    );
  }

  lines.push("    .build();");
  lines.push("");
  lines.push(
    "HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());",
  );
  lines.push("System.out.println(response.statusCode());");
  lines.push("System.out.println(response.body());");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// C# HttpClient
// ---------------------------------------------------------------------------

export function generateCSharp(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";
  const hasBody = body !== null && !isGetHead;

  const lines: string[] = [];
  lines.push("using System.Net.Http;");
  lines.push("using System.Text;");
  lines.push("");
  lines.push("var client = new HttpClient();");

  for (const [k, v] of Object.entries(headers)) {
    lines.push(
      `client.DefaultRequestHeaders.Add(${JSON.stringify(k)}, ${JSON.stringify(v)});`,
    );
  }

  lines.push("");

  if (hasBody) {
    const contentType = headers["Content-Type"] ?? "application/json";
    lines.push(
      `var content = new StringContent(${JSON.stringify(body)}, Encoding.UTF8, ${JSON.stringify(contentType)});`,
    );
    lines.push(
      `var response = await client.${capitalize(tab.method.toLowerCase())}Async(${JSON.stringify(url)}, content);`,
    );
  } else {
    const method =
      tab.method === "GET"
        ? "GetAsync"
        : tab.method === "DELETE"
          ? "DeleteAsync"
          : `SendAsync(new HttpRequestMessage(HttpMethod.${capitalize(tab.method.toLowerCase())}, ${JSON.stringify(url)}))`;
    lines.push(
      `var response = await client.${method === "GetAsync" || method === "DeleteAsync" ? `${method}(${JSON.stringify(url)})` : method};`,
    );
  }

  lines.push("var body = await response.Content.ReadAsStringAsync();");
  lines.push("Console.WriteLine((int)response.StatusCode);");
  lines.push("Console.WriteLine(body);");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// PHP cURL
// ---------------------------------------------------------------------------

export function generatePHP(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";
  const hasBody = body !== null && !isGetHead;

  const headerLines = Object.entries(headers).map(
    ([k, v]) => `    ${sq(`${k}: ${v}`)},`,
  );

  const lines: string[] = [];
  lines.push("<?php");
  lines.push("");
  lines.push("$curl = curl_init();");
  lines.push("");
  lines.push("curl_setopt_array($curl, [");
  lines.push(`  CURLOPT_URL => ${sq(url)},`);
  lines.push("  CURLOPT_RETURNTRANSFER => true,");
  lines.push(`  CURLOPT_CUSTOMREQUEST => ${sq(tab.method)},`);

  if (headerLines.length > 0) {
    lines.push("  CURLOPT_HTTPHEADER => [");
    for (const h of headerLines) lines.push(`  ${h}`);
    lines.push("  ],");
  }

  if (hasBody) {
    lines.push(`  CURLOPT_POSTFIELDS => ${JSON.stringify(body)},`);
  }

  lines.push("]);");
  lines.push("");
  lines.push("$response = curl_exec($curl);");
  lines.push("$statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);");
  lines.push("curl_close($curl);");
  lines.push("");
  lines.push('echo $statusCode . "\\n";');
  lines.push('echo $response . "\\n";');

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Go net/http
// ---------------------------------------------------------------------------

export function generateGo(tab: HttpTab): string {
  const url = buildFinalUrl(tab.url, tab.params);
  const headers = buildHeadersObject(tab);
  const body = buildBodyString(tab);
  const isGetHead = tab.method === "GET" || tab.method === "HEAD";
  const hasBody = body !== null && !isGetHead;

  const lines: string[] = [];
  lines.push("package main");
  lines.push("");
  lines.push("import (");

  const imports = ['"fmt"', '"io"', '"net/http"'];
  if (hasBody) imports.push('"strings"');
  for (const imp of imports) {
    lines.push(`\t${imp}`);
  }
  lines.push(")");
  lines.push("");
  lines.push("func main() {");

  if (hasBody) {
    lines.push(`\tbody := strings.NewReader(${JSON.stringify(body)})`);
    lines.push("");
    lines.push(
      `\treq, err := http.NewRequest("${tab.method}", "${url}", body)`,
    );
  } else {
    lines.push(`\treq, err := http.NewRequest("${tab.method}", "${url}", nil)`);
  }

  lines.push("\tif err != nil {");
  lines.push("\t\tpanic(err)");
  lines.push("\t}");
  lines.push("");

  for (const [k, v] of Object.entries(headers)) {
    lines.push(`\treq.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
  }

  if (Object.keys(headers).length > 0) lines.push("");

  lines.push("\tclient := &http.Client{}");
  lines.push("\tresp, err := client.Do(req)");
  lines.push("\tif err != nil {");
  lines.push("\t\tpanic(err)");
  lines.push("\t}");
  lines.push("\tdefer resp.Body.Close()");
  lines.push("");
  lines.push("\tresBody, _ := io.ReadAll(resp.Body)");
  lines.push("\tfmt.Println(resp.Status)");
  lines.push("\tfmt.Println(string(resBody))");
  lines.push("}");

  return lines.join("\n");
}
