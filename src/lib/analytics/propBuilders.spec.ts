import { describe, expect, it } from "vitest";
import {
  buildChainRunProps,
  buildLandingProps,
  buildRequestSentProps,
  landingPathEnum,
  methodEnum,
  referrerDomain,
  statusClass,
} from "@/lib/analytics/propBuilders";

/** Distinct sentinels standing in for user data that must never reach track(). */
const SEEDED = {
  url: "https://api.secret-corp.test/v1/users/42?token=abc123",
  host: "api.secret-corp.test",
  header: "Authorization: Bearer s3cr3t-header-value",
  body: '{"password":"hunter2-body"}',
  env: "ENV_VALUE_zq9x",
  prompt: "summarise my private invoice",
  shareId: "share-id-7f3k2",
  blockName: "my-secret-block",
};
const SEEDED_STRINGS = Object.values(SEEDED);

const ALLOWED_KEYS = {
  request_sent: ["method", "protocol", "status_class", "duration_bucket", "source"],
  chain_run: ["status", "node_count_bucket", "duration_bucket", "has_loop", "has_subchain"],
  landing_viewed: ["path", "referrer_domain"],
} as const;

const expectClean = (props: Record<string, unknown>, allowed: readonly string[]) => {
  expect(Object.keys(props).sort()).toEqual([...allowed].sort());
  const serialised = JSON.stringify(props);
  expect(SEEDED_STRINGS.length).toBeGreaterThan(0);
  for (const seed of SEEDED_STRINGS) {
    expect(serialised).not.toContain(seed);
  }
  for (const value of Object.values(props)) {
    expect(["string", "boolean"]).toContain(typeof value);
  }
};

describe("methodEnum", () => {
  it.each([
    ["get", "GET"],
    ["Post", "POST"],
    ["DELETE", "DELETE"],
    ["options", "OPTIONS"],
  ])("normalises %s to %s", (input, expected) => {
    expect(methodEnum(input)).toBe(expected);
  });

  it.each(["PROPFIND", "", "other", SEEDED.url])("buckets %j as other", (input) => {
    expect(methodEnum(input)).toBe("other");
  });
});

describe("statusClass", () => {
  it.each([
    [200, "2xx"],
    [299, "2xx"],
    [301, "3xx"],
    [404, "4xx"],
    [503, "5xx"],
    [599, "5xx"],
  ])("maps %i to %s", (status, expected) => {
    expect(statusClass(status)).toBe(expected);
  });

  it.each([undefined, 0, 101, 199, 600, -1, Number.NaN])("maps %s to error", (status) => {
    expect(statusClass(status)).toBe("error");
  });
});

describe("landingPathEnum", () => {
  it.each([
    ["/", "/"],
    ["/features", "/features"],
    ["/compare", "/compare"],
    ["/privacy", "/privacy"],
    ["/terms", "/terms"],
    ["/features/", "/features"],
    ["/features///", "/features"],
    ["/features?ref=abc", "/features"],
    ["/privacy#section", "/privacy"],
    ["/?x=1", "/"],
  ])("passes known path %s as %s", (input, expected) => {
    expect(landingPathEnum(input)).toBe(expected);
  });

  it.each(["/app", "/share/share-id-7f3k2", "/featuresx", "", "/Features", "?only=query"])(
    "buckets %j as other",
    (input) => {
      expect(landingPathEnum(input)).toBe("other");
    },
  );
});

describe("referrerDomain", () => {
  it.each([
    ["https://news.ycombinator.com/item?id=1", "news.ycombinator.com"],
    ["https://GitHub.com/org/repo", "github.com"],
    ["https://www.google.com/search?q=secret", "www.google.com"],
    ["https://user:pw@evil.example/path?q=1#h", "evil.example"],
  ])("keeps only the hostname of %s", (referrer, expected) => {
    expect(referrerDomain(referrer)).toBe(expected);
  });

  it.each(["", "not a url", "/relative/path", "://broken"])("treats %j as direct", (referrer) => {
    expect(referrerDomain(referrer)).toBe("direct");
  });

  it("treats same-site referrers as direct, ignoring www and case", () => {
    expect(referrerDomain("https://www.requestly.dev/features", "requestly.dev")).toBe("direct");
    expect(referrerDomain("https://requestly.dev/", "WWW.Requestly.dev")).toBe("direct");
  });

  it("does not treat other hosts as same-site", () => {
    expect(referrerDomain("https://other.dev/", "requestly.dev")).toBe("other.dev");
  });

  it.each([
    "http://localhost:3000/app",
    "http://foo.localhost/",
    "http://192.168.1.10/admin",
    "http://127.0.0.1:8080/",
    "http://[::1]:3000/",
  ])("records internal host %s as other", (referrer) => {
    expect(referrerDomain(referrer)).toBe("other");
  });
});

describe("buildRequestSentProps leak test", () => {
  it("emits only allowlisted bucketed values for hostile input", () => {
    const props = buildRequestSentProps({
      method: SEEDED.url,
      protocol: "http",
      status: 200,
      durationMs: 250,
      source: "manual",
    });
    expectClean(props, ALLOWED_KEYS.request_sent);
    expect(props).toEqual({
      method: "other",
      protocol: "http",
      status_class: "2xx",
      duration_bucket: "<500ms",
      source: "manual",
    });
  });

  it("reports a failed request as error with a fast bucket", () => {
    expect(
      buildRequestSentProps({ method: "get", protocol: "graphql", durationMs: 5, source: "chain" }),
    ).toEqual({
      method: "GET",
      protocol: "graphql",
      status_class: "error",
      duration_bucket: "<100ms",
      source: "chain",
    });
  });

  it("buckets a slow 5xx", () => {
    const props = buildRequestSentProps({
      method: "PUT",
      protocol: "websocket",
      status: 502,
      durationMs: 9000,
      source: "relay",
    });
    expect(props.status_class).toBe("5xx");
    expect(props.duration_bucket).toBe("2s+");
  });
});

describe("buildChainRunProps leak test", () => {
  it("never echoes block names or ids passed as block types", () => {
    const props = buildChainRunProps({
      status: "passed",
      nodeCount: 7,
      durationMs: 1500,
      blockTypes: [SEEDED.blockName, SEEDED.env, "loop"],
    });
    expectClean(props, ALLOWED_KEYS.chain_run);
    expect(props).toEqual({
      status: "success",
      node_count_bucket: "6-20",
      duration_bucket: "<2s",
      has_loop: true,
      has_subchain: false,
    });
  });

  it.each([
    ["failed", "failed"],
    ["stopped", "stopped"],
  ] as const)("passes %s status through", (status, expected) => {
    const props = buildChainRunProps({ status, nodeCount: 0, durationMs: 0, blockTypes: [] });
    expect(props.status).toBe(expected);
    expect(props.node_count_bucket).toBe("0");
    expect(props.has_loop).toBe(false);
  });

  it("detects a subchain", () => {
    const props = buildChainRunProps({
      status: "passed",
      nodeCount: 200,
      durationMs: 3000,
      blockTypes: ["request", "subchain"],
    });
    expect(props.has_subchain).toBe(true);
    expect(props.has_loop).toBe(false);
    expect(props.node_count_bucket).toBe("100+");
  });
});

describe("buildLandingProps leak test", () => {
  it("drops path segments, query and share ids from pathname and referrer", () => {
    const props = buildLandingProps({
      pathname: `/share/${SEEDED.shareId}?env=${SEEDED.env}`,
      referrer: `https://${SEEDED.host}/${SEEDED.prompt}?q=${SEEDED.body}#${SEEDED.header}`,
    });
    expect(Object.keys(props).sort()).toEqual([...ALLOWED_KEYS.landing_viewed].sort());
    expect(props.path).toBe("other");
    expect(props.referrer_domain).toBe(SEEDED.host);
    const serialised = JSON.stringify(props);
    for (const seed of [SEEDED.url, SEEDED.header, SEEDED.body, SEEDED.env, SEEDED.prompt, SEEDED.shareId]) {
      expect(serialised).not.toContain(seed);
    }
  });

  it("fails if a raw referrer URL is passed through", () => {
    const props = buildLandingProps({ pathname: "/", referrer: SEEDED.url });
    expect(props.referrer_domain).not.toContain("/");
    expect(props.referrer_domain).not.toContain("token");
  });

  it("reports direct for an empty or same-site referrer", () => {
    expect(buildLandingProps({ pathname: "/features/", referrer: "" })).toEqual({
      path: "/features",
      referrer_domain: "direct",
    });
    expect(
      buildLandingProps({
        pathname: "/",
        referrer: "https://www.requestly.dev/compare",
        ownHost: "requestly.dev",
      }).referrer_domain,
    ).toBe("direct");
  });
});
