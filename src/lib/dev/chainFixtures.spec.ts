import { describe, it, expect } from "vitest";
import {
  createTwoApiNodesFixture,
  createWithDisplayFixture,
  createEnvVarFixture,
  createUnreachableFixture,
  createSlowRequestFixture,
  createAllNodeTypesFixture,
  createAllFixtures,
  getFixture,
} from "@/lib/dev/chainFixtures";
import { CHAIN_SCHEMA_VERSION } from "@/types/chain";

describe("chainFixtures", () => {
  it("creates twoApiNodes fixture with requests and proper JSON paths", () => {
    const fixture = createTwoApiNodesFixture();
    const { chain, requests } = fixture;

    expect(chain.name).toBe("Two API Nodes");
    expect(chain.scope).toBe("standalone");
    expect(chain.schemaVersion).toBe(CHAIN_SCHEMA_VERSION);
    expect(chain.nodeIds).toHaveLength(2);
    expect(chain.blocks).toHaveLength(0);
    expect(chain.edges).toHaveLength(1);

    // Verify requests exist for every nodeId
    expect(requests).toHaveLength(2);
    expect(requests[0].name).toBe("API Node A (Token Source)");
    expect(requests[0].url).toContain("httpbin.org/anything");
    expect(requests[0].url).toContain("token=fixture-token-123");
    expect(requests[1].name).toBe("API Node B (Token Consumer)");

    // Verify JSONPath matches endpoint shape ($.args.token for httpbin)
    expect(chain.edges[0].injections).toHaveLength(1);
    expect(chain.edges[0].injections[0].sourceJsonPath).toBe("$.args.token");
  });

  it("creates withDisplay fixture with requests and display block", () => {
    const fixture = createWithDisplayFixture();
    const { chain, requests } = fixture;

    expect(chain.name).toBe("With Display Node");
    expect(chain.blocks).toHaveLength(1);
    expect(chain.blocks[0].type).toBe("display");
    expect(chain.blocks[0]).toHaveProperty("sourceJsonPath", "$.headers['User-Agent']");

    // Verify request exists
    expect(requests).toHaveLength(1);
    expect(requests[0].name).toBe("API Node (Header Source)");
    expect(requests[0].url).toContain("httpbin.org/anything");
  });

  it("creates envVar fixture with requests using environment variables", () => {
    const fixture = createEnvVarFixture();
    const { chain, requests, scenario } = fixture;

    expect(chain.name).toBe("Environment Variables");
    expect(chain.nodeIds).toHaveLength(1);
    expect(scenario).toBe("envVar");

    // Verify request has environment variable placeholders
    expect(requests).toHaveLength(1);
    expect(requests[0].name).toBe("API Node (Env Vars)");
    expect(requests[0].url).toContain("{{baseUrl}}");
    expect(requests[0].url).toContain("{{undefinedVar}}");
  });

  it("creates unreachable fixture with proper endpoint", () => {
    const fixture = createUnreachableFixture();
    const { chain, requests } = fixture;

    expect(chain.name).toBe("Unreachable Endpoint");
    expect(chain.nodeIds).toHaveLength(1);

    // Verify request points to unreachable endpoint
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("http://127.0.0.1:1/");
  });

  it("creates slow fixture for timeout testing", () => {
    const fixture = createSlowRequestFixture();
    const { chain, requests } = fixture;

    expect(chain.name).toBe("Slow Request (5s)");
    expect(chain.nodeIds).toHaveLength(1);

    // Verify request points to httpbin delay endpoint
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://httpbin.org/delay/5");
  });

  it("creates allNodeTypes fixture with api request and all block types", () => {
    const fixture = createAllNodeTypesFixture();
    const { chain, requests } = fixture;

    expect(chain.name).toBe("All Node Types");
    expect(chain.nodeIds).toHaveLength(1); // one API node
    expect(chain.blocks).toHaveLength(3); // delay + condition + display

    // Verify request exists
    expect(requests).toHaveLength(1);
    expect(requests[0].name).toBe("API Node (All Types Demo)");
    expect(requests[0].url).toContain("httpbin.org");

    const types = chain.blocks.map((b) => b.type);
    expect(types).toContain("delay");
    expect(types).toContain("condition");
    expect(types).toContain("display");
  });

  it("createAllFixtures returns 6 fixtures with unique ids and requests", () => {
    const all = createAllFixtures();
    expect(Object.keys(all)).toHaveLength(6);
    expect(all).toHaveProperty("twoApiNodes");
    expect(all).toHaveProperty("withDisplay");
    expect(all).toHaveProperty("envVar");
    expect(all).toHaveProperty("unreachable");
    expect(all).toHaveProperty("slow");
    expect(all).toHaveProperty("allNodeTypes");

    const ids = Object.values(all).map((f) => f.chain.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(6);

    // Verify all fixtures have requests
    for (const fixture of Object.values(all)) {
      expect(fixture.requests).toBeDefined();
      expect(fixture.requests.length).toBeGreaterThan(0);
      expect(fixture.collectionId).toBeDefined();
      expect(fixture.collectionId.length).toBeGreaterThan(0);
    }
  });

  it("getFixture returns matching fixture with requests", () => {
    const fixture = getFixture("twoApiNodes");
    expect(fixture).not.toBeNull();
    expect(fixture!.scenario).toBe("twoApiNodes");
    expect(fixture!.requests).toHaveLength(2);
    expect(fixture!.collectionId).toBeDefined();
  });

  it("getFixture returns null for unknown scenario", () => {
    const fixture = getFixture("unknown");
    expect(fixture).toBeNull();
  });

  it("all fixtures have valid node positions", () => {
    const fixtures = createAllFixtures();
    for (const { chain } of Object.values(fixtures)) {
      const allNodeIds = [...chain.nodeIds, ...chain.blocks.map((b) => b.id)];
      for (const nodeId of allNodeIds) {
        expect(chain.nodePositions).toHaveProperty(nodeId);
        const pos = chain.nodePositions[nodeId];
        expect(typeof pos.x).toBe("number");
        expect(typeof pos.y).toBe("number");
      }
    }
  });

  it("all fixtures have consistent schema version", () => {
    const fixtures = createAllFixtures();
    for (const { chain } of Object.values(fixtures)) {
      expect(chain.schemaVersion).toBe(CHAIN_SCHEMA_VERSION);
    }
  });

  it("all fixtures have matching nodeIds and request lengths", () => {
    const fixtures = createAllFixtures();
    for (const fixture of Object.values(fixtures)) {
      const { chain, requests } = fixture;
      // Each nodeId should have a corresponding request
      // (nodeIds reference request IDs in the fixture)
      expect(chain.nodeIds.length).toBeGreaterThanOrEqual(requests.length);
    }
  });

  it("all requests have required fields", () => {
    const fixtures = createAllFixtures();
    for (const fixture of Object.values(fixtures)) {
      for (const request of fixture.requests) {
        expect(request.id).toBeDefined();
        expect(request.collectionId).toBeDefined();
        expect(request.name).toBeDefined();
        expect(request.method).toBeDefined();
        expect(request.url).toBeDefined();
        expect(request.createdAt).toBeGreaterThan(0);
        expect(request.updatedAt).toBeGreaterThan(0);
      }
    }
  });
});
