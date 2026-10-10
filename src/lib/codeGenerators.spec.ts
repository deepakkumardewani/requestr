import { describe, expect, it } from "vitest";
import type { EnvironmentModel, HttpTab, KVPair } from "@/types";
import {
  generateAxios,
  generateCSharp,
  generateCurl,
  generateFetch,
  generateGo,
  generateJava,
  generatePHP,
  generatePython,
  generateRuby,
  resolveTabStateVars,
} from "./codeGenerators";

function pair(
  key: string,
  value: string,
  opts: { enabled?: boolean; type?: "path" | "query" } = {}
): KVPair {
  return {
    id: `id-${key}`,
    key,
    value,
    enabled: opts.enabled ?? true,
    ...(opts.type ? { type: opts.type } : {}),
  };
}

function baseTab(overrides: Partial<HttpTab> = {}): HttpTab {
  return {
    tabId: "t1",
    requestId: null,
    name: "T",
    isDirty: false,
    type: "http",
    method: "GET",
    url: "https://api.example.com/items/:id",
    headers: [],
    params: [
      pair("id", "42", { type: "path" }),
      pair("q", "hello", { type: "query" }),
    ],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    ...overrides,
  };
}

describe("resolveTabStateVars", () => {
  it("returns tab unchanged when env is null", () => {
    const tab = baseTab();
    expect(resolveTabStateVars(tab, null)).toBe(tab);
  });

  it("substitutes values and redacts secrets", () => {
    const env: EnvironmentModel = {
      id: "e1",
      name: "E",
      variables: [
        {
          id: "v1",
          key: "TOKEN",
          initialValue: "init",
          currentValue: "sekret",
          isSecret: true,
        },
        {
          id: "v2",
          key: "HOST",
          initialValue: "",
          currentValue: "https://x.test",
          isSecret: false,
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const tab = baseTab({
      url: "{{HOST}}/v1",
      headers: [pair("Authorization", "Bearer {{TOKEN}}")],
      auth: { type: "bearer", token: "{{TOKEN}}" },
    });
    const out = resolveTabStateVars(tab, env);
    expect(out.url).toBe("https://x.test/v1");
    expect(out.headers[0].value).toBe("Bearer <REDACTED>");
    expect(out.auth).toEqual({ type: "bearer", token: "<REDACTED>" });
  });
});

const URL_RESOLVED = "https://api.example.com/items/42?q=hello";
const joinLines = (...lines: string[]) => lines.join("\n");

const postJson = (content = '{"a":1}') =>
  baseTab({ method: "POST", body: { type: "json", content } });

describe("generateFetch", () => {
  it("emits a one-liner snippet for a plain GET", () => {
    expect(generateFetch(baseTab())).toBe(
      joinLines(
        `const response = await fetch('${URL_RESOLVED}');`,
        "",
        "const data = await response.json();",
        "console.log(data);"
      )
    );
  });

  it("emits method, content-type header and escaped body for a JSON POST", () => {
    expect(generateFetch(postJson())).toBe(
      joinLines(
        `const response = await fetch('${URL_RESOLVED}', {`,
        "  method: 'POST',",
        "  headers: {",
        "    'Content-Type': 'application/json',",
        "  },",
        '  body: "{\\"a\\":1}",',
        "});",
        "",
        "const data = await response.json();",
        "console.log(data);"
      )
    );
  });

  it("omits the body for GET even when a body is configured", () => {
    const s = generateFetch(
      baseTab({ body: { type: "json", content: '{"a":1}' } })
    );
    expect(s).toBe(
      joinLines(
        `const response = await fetch('${URL_RESOLVED}', {`,
        "  method: 'GET',",
        "  headers: {",
        "    'Content-Type': 'application/json',",
        "  },",
        "});",
        "",
        "const data = await response.json();",
        "console.log(data);"
      )
    );
  });

  it("keeps a user-supplied Content-Type instead of the automatic one", () => {
    const s = generateFetch(
      baseTab({
        method: "POST",
        headers: [pair("Content-Type", "application/vnd.api+json")],
        body: { type: "json", content: "{}" },
      })
    );
    expect(s).toContain("    'Content-Type': 'application/vnd.api+json',");
    expect(s).not.toContain("application/json");
  });

  it("skips disabled and keyless headers", () => {
    const s = generateFetch(
      baseTab({
        headers: [
          pair("X-Off", "no", { enabled: false }),
          pair("", "orphan"),
          pair("X-On", "yes"),
        ],
      })
    );
    expect(s).toContain("    'X-On': 'yes',");
    expect(s).not.toContain("X-Off");
    expect(s).not.toContain("orphan");
  });

  it("emits a bearer Authorization header", () => {
    const s = generateFetch(
      baseTab({ auth: { type: "bearer", token: "tok" } })
    );
    expect(s).toContain("    'Authorization': 'Bearer tok',");
  });

  it("emits a base64 Basic Authorization header", () => {
    // btoa("alice:secret") === "YWxpY2U6c2VjcmV0"
    const s = generateFetch(
      baseTab({
        auth: { type: "basic", username: "alice", password: "secret" },
      })
    );
    expect(s).toContain("    'Authorization': 'Basic YWxpY2U6c2VjcmV0',");
  });

  it("emits an api-key as a header when addTo is header", () => {
    const s = generateFetch(
      baseTab({
        auth: {
          type: "api-key",
          key: "X-Api-Key",
          value: "k1",
          addTo: "header",
        },
      })
    );
    expect(s).toContain("    'X-Api-Key': 'k1',");
  });

  // Characterization: the generators never append an api-key to the URL query.
  it("drops an api-key whose addTo is query (neither header nor URL)", () => {
    const s = generateFetch(
      baseTab({
        auth: { type: "api-key", key: "api_key", value: "k1", addTo: "query" },
      })
    );
    expect(s).toBe(generateFetch(baseTab()));
    expect(s).not.toContain("k1");
  });

  it("serialises urlencoded fields as an encoded body with form content-type", () => {
    const s = generateFetch(
      baseTab({
        method: "POST",
        body: {
          type: "urlencoded",
          content: "",
          formData: [
            pair("a b", "c&d"),
            pair("off", "x", { enabled: false }),
            pair("e", "f"),
          ],
        },
      })
    );
    expect(s).toContain(
      "    'Content-Type': 'application/x-www-form-urlencoded',"
    );
    expect(s).toContain('  body: "a%20b=c%26d&e=f",');
  });

  // Characterization: form-data is flattened to a urlencoded string, with no
  // multipart boundary and no Content-Type header.
  it("flattens form-data into a urlencoded body without a content-type", () => {
    const s = generateFetch(
      baseTab({
        method: "POST",
        body: { type: "form-data", content: "", formData: [pair("k", "v")] },
      })
    );
    expect(s).toContain('  body: "k=v",');
    expect(s).not.toContain("Content-Type");
  });

  it("omits the body when form fields are all disabled", () => {
    const s = generateFetch(
      baseTab({
        method: "POST",
        body: {
          type: "urlencoded",
          content: "",
          formData: [pair("k", "v", { enabled: false })],
        },
      })
    );
    expect(s).not.toContain("body:");
  });

  it("escapes double quotes and newlines in a text body", () => {
    const s = generateFetch(
      baseTab({
        method: "POST",
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('  body: "say \\"hi\\"\\nbye",');
  });

});

describe("generateAxios", () => {
  it("emits lowercase method, url and no data for GET", () => {
    expect(generateAxios(baseTab())).toBe(
      joinLines(
        "import axios from 'axios';",
        "",
        "const response = await axios({",
        "  method: 'get',",
        `  url: '${URL_RESOLVED}',`,
        "});",
        "",
        "console.log(response.data);"
      )
    );
  });

  it("emits headers and escaped data for a JSON POST", () => {
    expect(generateAxios(postJson())).toBe(
      joinLines(
        "import axios from 'axios';",
        "",
        "const response = await axios({",
        "  method: 'post',",
        `  url: '${URL_RESOLVED}',`,
        "  headers: {",
        "    'Content-Type': 'application/json',",
        "  },",
        '  data: "{\\"a\\":1}",',
        "});",
        "",
        "console.log(response.data);"
      )
    );
  });

  it("emits a Bearer Authorization header", () => {
    const s = generateAxios(
      baseTab({ auth: { type: "bearer", token: "tok" } })
    );
    expect(s).toContain("    'Authorization': 'Bearer tok',");
  });

  it("escapes double quotes and newlines in a text body", () => {
    const s = generateAxios(
      baseTab({
        method: "POST",
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('  data: "say \\"hi\\"\\nbye",');
  });
});

describe("generatePython", () => {
  it("emits a bare requests.get call for GET", () => {
    expect(generatePython(baseTab())).toBe(
      joinLines(
        "import requests",
        "",
        `response = requests.get('${URL_RESOLVED}')`,
        "",
        "print(response.status_code)",
        "print(response.json())"
      )
    );
  });

  it("passes a valid JSON body through json= as a Python literal", () => {
    expect(
      generatePython(
        postJson('{"x": 1, "ok": true, "none": null, "list": [1, "a"]}')
      )
    ).toBe(
      joinLines(
        "import requests",
        "",
        "headers = {",
        "    'Content-Type': 'application/json',",
        "}",
        "",
        `response = requests.post('${URL_RESOLVED}', headers=headers, json={`,
        '    "x": 1,',
        '    "ok": True,',
        '    "none": None,',
        '    "list": [1, "a"],',
        "})",
        "",
        "print(response.status_code)",
        "print(response.json())"
      )
    );
  });

  it("falls back to data= when a json-typed body is not valid JSON", () => {
    const s = generatePython(postJson("{oops"));
    expect(s).toContain(
      `response = requests.post('${URL_RESOLVED}', headers=headers, data="{oops")`
    );
  });

  it("uses data= with an escaped string for a text body", () => {
    const s = generatePython(
      baseTab({
        method: "POST",
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain(
      `response = requests.post('${URL_RESOLVED}', data="say \\"hi\\"\\nbye")`
    );
  });

  it("emits Basic auth, urlencoded body and form content-type", () => {
    const s = generatePython(
      baseTab({
        method: "POST",
        auth: { type: "basic", username: "alice", password: "secret" },
        body: {
          type: "urlencoded",
          content: "",
          formData: [pair("a", "1"), pair("b", "2")],
        },
      })
    );
    expect(s).toContain("    'Authorization': 'Basic YWxpY2U6c2VjcmV0',");
    expect(s).toContain(
      "    'Content-Type': 'application/x-www-form-urlencoded',"
    );
    expect(s).toContain(
      `response = requests.post('${URL_RESOLVED}', headers=headers, data="a=1&b=2")`
    );
  });
});

describe("generateRuby", () => {
  it("emits Net::HTTP boilerplate without json require for GET", () => {
    expect(generateRuby(baseTab())).toBe(
      joinLines(
        "require 'net/http'",
        "require 'uri'",
        "",
        `uri = URI('${URL_RESOLVED}')`,
        "http = Net::HTTP.new(uri.host, uri.port)",
        "http.use_ssl = uri.scheme == 'https'",
        "",
        "request = Net::HTTP::Get.new(uri)",
        "",
        "response = http.request(request)",
        "puts response.code",
        "puts response.body"
      )
    );
  });

  it("requires json, sets header and body for a JSON POST", () => {
    expect(generateRuby(postJson())).toBe(
      joinLines(
        "require 'net/http'",
        "require 'uri'",
        "require 'json'",
        "",
        `uri = URI('${URL_RESOLVED}')`,
        "http = Net::HTTP.new(uri.host, uri.port)",
        "http.use_ssl = uri.scheme == 'https'",
        "",
        "request = Net::HTTP::Post.new(uri)",
        "request['Content-Type'] = 'application/json'",
        'request.body = "{\\"a\\":1}"',
        "",
        "response = http.request(request)",
        "puts response.code",
        "puts response.body"
      )
    );
  });

  it("does not require json for a non-JSON body", () => {
    const s = generateRuby(
      baseTab({ method: "POST", body: { type: "text", content: "hi" } })
    );
    expect(s).not.toContain("require 'json'");
    expect(s).toContain('request.body = "hi"');
  });

  it("escapes double quotes and newlines in the body", () => {
    const s = generateRuby(
      baseTab({
        method: "POST",
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('request.body = "say \\"hi\\"\\nbye"');
  });

  it("emits a Bearer Authorization header", () => {
    const s = generateRuby(baseTab({ auth: { type: "bearer", token: "tok" } }));
    expect(s).toContain("request['Authorization'] = 'Bearer tok'");
  });
});

describe("generateJava", () => {
  it("uses the GET() shortcut for GET requests", () => {
    expect(generateJava(baseTab())).toBe(
      joinLines(
        "import java.net.URI;",
        "import java.net.http.HttpClient;",
        "import java.net.http.HttpRequest;",
        "import java.net.http.HttpResponse;",
        "",
        "HttpClient client = HttpClient.newHttpClient();",
        "",
        "HttpRequest request = HttpRequest.newBuilder()",
        `    .uri(URI.create("${URL_RESOLVED}"))`,
        "    .GET()",
        "    .build();",
        "",
        "HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());",
        "System.out.println(response.statusCode());",
        "System.out.println(response.body());"
      )
    );
  });

  it("emits header and ofString body publisher for a JSON POST", () => {
    const s = generateJava(postJson());
    expect(s).toContain('    .header("Content-Type", "application/json")');
    expect(s).toContain(
      '    .method("POST", HttpRequest.BodyPublishers.ofString("{\\"a\\":1}"))'
    );
  });

  it("uses noBody publisher for a bodiless DELETE", () => {
    expect(generateJava(baseTab({ method: "DELETE" }))).toContain(
      '    .method("DELETE", HttpRequest.BodyPublishers.noBody())'
    );
  });

  it("escapes quotes and newlines in headers and body", () => {
    const s = generateJava(
      baseTab({
        method: "POST",
        headers: [pair("X-Note", 'a"b')],
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('    .header("X-Note", "a\\"b")');
    expect(s).toContain('ofString("say \\"hi\\"\\nbye")');
  });
});

describe("generateCSharp", () => {
  it("uses GetAsync for GET", () => {
    expect(generateCSharp(baseTab())).toBe(
      joinLines(
        "using System.Net.Http;",
        "using System.Text;",
        "",
        "var client = new HttpClient();",
        "",
        `var response = await client.GetAsync("${URL_RESOLVED}");`,
        "var body = await response.Content.ReadAsStringAsync();",
        "Console.WriteLine((int)response.StatusCode);",
        "Console.WriteLine(body);"
      )
    );
  });

  it("uses DeleteAsync for DELETE without body", () => {
    expect(generateCSharp(baseTab({ method: "DELETE" }))).toContain(
      `var response = await client.DeleteAsync("${URL_RESOLVED}");`
    );
  });

  it("uses SendAsync with HttpRequestMessage for bodiless PUT", () => {
    expect(generateCSharp(baseTab({ method: "PUT" }))).toContain(
      `var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Put, "${URL_RESOLVED}"));`
    );
  });

  it("uses PatchAsync with StringContent for PATCH with body", () => {
    const s = generateCSharp(
      baseTab({
        method: "PATCH",
        body: { type: "json", content: '{"a":true}' },
      })
    );
    expect(s).toContain(
      'var content = new StringContent("{\\"a\\":true}", Encoding.UTF8, "application/json");'
    );
    expect(s).toContain(
      `var response = await client.PatchAsync("${URL_RESOLVED}", content);`
    );
  });

  // Characterization: a text body without a Content-Type header still gets
  // application/json as the StringContent media type.
  it("defaults StringContent media type to application/json for text bodies", () => {
    const s = generateCSharp(
      baseTab({ method: "POST", body: { type: "text", content: "hi" } })
    );
    expect(s).toContain(
      'var content = new StringContent("hi", Encoding.UTF8, "application/json");'
    );
  });

  it("escapes quotes and newlines in headers and body", () => {
    const s = generateCSharp(
      baseTab({
        method: "POST",
        headers: [pair("X-Note", 'a"b')],
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('client.DefaultRequestHeaders.Add("X-Note", "a\\"b");');
    expect(s).toContain('new StringContent("say \\"hi\\"\\nbye"');
  });
});

describe("generatePHP", () => {
  it("emits curl_setopt_array with CUSTOMREQUEST and no headers for PUT", () => {
    expect(generatePHP(baseTab({ method: "PUT" }))).toBe(
      joinLines(
        "<?php",
        "",
        "$curl = curl_init();",
        "",
        "curl_setopt_array($curl, [",
        `  CURLOPT_URL => '${URL_RESOLVED}',`,
        "  CURLOPT_RETURNTRANSFER => true,",
        "  CURLOPT_CUSTOMREQUEST => 'PUT',",
        "]);",
        "",
        "$response = curl_exec($curl);",
        "$statusCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);",
        "curl_close($curl);",
        "",
        'echo $statusCode . "\\n";',
        'echo $response . "\\n";'
      )
    );
  });

  it("emits HTTPHEADER and POSTFIELDS for a JSON POST", () => {
    const s = generatePHP(postJson());
    expect(s).toContain(
      joinLines(
        "  CURLOPT_HTTPHEADER => [",
        "      'Content-Type: application/json',",
        "  ],",
        '  CURLOPT_POSTFIELDS => "{\\"a\\":1}",'
      )
    );
  });

  it("emits Basic Authorization in HTTPHEADER", () => {
    const s = generatePHP(
      baseTab({
        auth: { type: "basic", username: "alice", password: "secret" },
      })
    );
    expect(s).toContain("      'Authorization: Basic YWxpY2U6c2VjcmV0',");
  });

  it("escapes quotes and newlines in the body", () => {
    const s = generatePHP(
      baseTab({
        method: "POST",
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('  CURLOPT_POSTFIELDS => "say \\"hi\\"\\nbye",');
  });
});

describe("generateGo", () => {
  it("emits net/http boilerplate with nil body for GET", () => {
    expect(generateGo(baseTab())).toBe(
      joinLines(
        "package main",
        "",
        "import (",
        '\t"fmt"',
        '\t"io"',
        '\t"net/http"',
        ")",
        "",
        "func main() {",
        `\treq, err := http.NewRequest("GET", "${URL_RESOLVED}", nil)`,
        "\tif err != nil {",
        "\t\tpanic(err)",
        "\t}",
        "",
        "\tclient := &http.Client{}",
        "\tresp, err := client.Do(req)",
        "\tif err != nil {",
        "\t\tpanic(err)",
        "\t}",
        "\tdefer resp.Body.Close()",
        "",
        "\tresBody, _ := io.ReadAll(resp.Body)",
        "\tfmt.Println(resp.Status)",
        "\tfmt.Println(string(resBody))",
        "}"
      )
    );
  });

  it("imports strings and sends the JSON body via strings.NewReader", () => {
    const s = generateGo(postJson());
    expect(s).toContain('\t"strings"');
    expect(s).toContain('\tbody := strings.NewReader("{\\"a\\":1}")');
    expect(s).toContain(
      `\treq, err := http.NewRequest("POST", "${URL_RESOLVED}", body)`
    );
    expect(s).toContain('\treq.Header.Set("Content-Type", "application/json")');
  });

  it("escapes quotes and newlines in the body", () => {
    const s = generateGo(
      baseTab({
        method: "POST",
        body: { type: "text", content: 'say "hi"\nbye' },
      })
    );
    expect(s).toContain('strings.NewReader("say \\"hi\\"\\nbye")');
  });
});

describe("generateCurl (re-export)", () => {
  it("emits the exact curl command with resolved path and query params", () => {
    expect(generateCurl(baseTab())).toBe(`curl -X GET '${URL_RESOLVED}'`);
  });
});

describe("single-quote escaping in single-quoted literals", () => {
  const quoted = baseTab({
    url: "https://api.example.com/it's",
    params: [],
    headers: [pair("X-Note", "it's a\\b"), pair("X-It's", "v")],
  });

  it("escapes quotes and backslashes in fetch", () => {
    const s = generateFetch(quoted);
    expect(s).toContain("fetch('https://api.example.com/it\\'s'");
    expect(s).toContain("    'X-Note': 'it\\'s a\\\\b',");
    expect(s).toContain("    'X-It\\'s': 'v',");
  });

  it("escapes quotes and backslashes in axios", () => {
    const s = generateAxios(quoted);
    expect(s).toContain("  url: 'https://api.example.com/it\\'s',");
    expect(s).toContain("    'X-Note': 'it\\'s a\\\\b',");
    expect(s).toContain("    'X-It\\'s': 'v',");
  });

  it("escapes quotes and backslashes in python", () => {
    const s = generatePython(quoted);
    expect(s).toContain("    'X-Note': 'it\\'s a\\\\b',");
    expect(s).toContain("requests.get('https://api.example.com/it\\'s'");
  });

  it("escapes quotes and backslashes in ruby", () => {
    const s = generateRuby(quoted);
    expect(s).toContain("uri = URI('https://api.example.com/it\\'s')");
    expect(s).toContain("request['X-Note'] = 'it\\'s a\\\\b'");
    expect(s).toContain("request['X-It\\'s'] = 'v'");
  });

  it("escapes quotes and backslashes in php", () => {
    const s = generatePHP(quoted);
    expect(s).toContain("CURLOPT_URL => 'https://api.example.com/it\\'s',");
    expect(s).toContain("'X-Note: it\\'s a\\\\b',");
  });
});
