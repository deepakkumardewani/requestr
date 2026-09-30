// GENERATED FILE — do not edit by hand.
// Source of truth: e2e/fixtures/seed/ (data) + src/lib/idbSchema.ts (schema)
// Regenerate with: bun run qa:seed:build
//
// Usage with agent-browser:
//   agent-browser open --init-script e2e/fixtures/qa-seed.init.js http://localhost:3000
(function seedQaData() {
  var FLAG = "e2e-qa-seeded";
  if (sessionStorage.getItem(FLAG)) return;
  sessionStorage.setItem(FLAG, "1");

  var data = {
    environments: [
      {
        id: "qa-env-1",
        name: "QA Environment",
        description: "Seeded for QA walkthrough",
        variables: [
          {
            id: "qa-env-var-baseurl",
            key: "baseUrl",
            initialValue: "https://api.qa-seed.test",
            currentValue: "https://api.qa-seed.test",
            isSecret: false,
          },
        ],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ],
    collections: [
      {
        id: "qa-collection-1",
        name: "QA Collection",
        description: "Seeded for QA walkthrough",
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ],
    requests: [
      {
        id: "qa-req-users",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "Get Users",
        method: "GET",
        url: "{{baseUrl}}/users",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-user-detail",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "Get User Detail",
        method: "GET",
        url: "{{baseUrl}}/users/:id",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-fail",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Failing Request",
        method: "GET",
        url: "https://example.com/api/fail",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-slow",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Slow Request",
        method: "GET",
        url: "https://example.com/api/slow",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-fast",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Fast Request",
        method: "GET",
        url: "https://example.com/api/fast",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-list",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA List Request",
        method: "GET",
        url: "https://example.com/api/list",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-token",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Token Source",
        method: "GET",
        url: "https://example.com/api/token",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-echo",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Echo Target",
        method: "GET",
        url: "https://example.com/api/echo",
        params: [],
        headers: [
          {
            id: "qa-echo-header-1",
            key: "x-qa-token",
            value: "{{qaToken}}",
            enabled: true,
          },
        ],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-echo-eval",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Echo Eval Target",
        method: "GET",
        url: "https://example.com/api/echo",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-parallel-slow",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Parallel Slow",
        method: "GET",
        url: "https://example.com/api/slow",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-parallel-fast",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Parallel Fast",
        method: "GET",
        url: "https://example.com/api/fast",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-sub-body",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Sub Body Request",
        method: "GET",
        url: "https://example.com/api/fast",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-undo-a",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Undo Request A",
        method: "GET",
        url: "https://dummyjson.com/products/1",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-undo-b",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Undo Request B",
        method: "GET",
        url: "https://dummyjson.com/products/2",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
      {
        id: "qa-req-shortcuts",
        collectionId: "qa-collection-1",
        folderId: null,
        name: "QA Shortcuts Request",
        method: "GET",
        url: "https://dummyjson.com/products/1",
        params: [],
        headers: [],
        auth: {
          type: "none",
        },
        body: {
          type: "none",
          content: "",
        },
        preScript: "",
        postScript: "",
      },
    ],
    legacyChainConfig: {
      collectionId: "qa-collection-1",
      edges: [],
      nodePositions: {
        "qa-req-users": {
          x: 100,
          y: 100,
        },
      },
      nodeIds: ["qa-req-users"],
      historyNodes: [],
      delayNodes: [],
      conditionNodes: [],
      displayNodes: [],
    },
    legacyStandaloneChain: {
      id: "qa-legacy-standalone-chain",
      name: "QA - Legacy Standalone Chain",
      createdAt: 1700000000000,
      edges: [],
      nodePositions: {
        "qa-req-users-legacy-standalone": {
          x: 100,
          y: 100,
        },
      },
      nodeIds: ["qa-req-users-legacy-standalone"],
      historyNodes: [
        {
          id: "qa-req-users-legacy-standalone",
          historyEntryId: "qa-req-users-legacy-standalone-entry",
          name: "Get Users (legacy standalone)",
          method: "GET",
          url: "https://dummyjson.com/users",
          params: [],
          headers: [],
          auth: {
            type: "none",
          },
          body: {
            type: "none",
            content: "",
          },
        },
      ],
      delayNodes: [],
      conditionNodes: [],
      displayNodes: [],
    },
    chains: [
      {
        id: "qa-chain-mapping",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Data Mapping",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-users", "qa-req-user-detail"],
        edges: [
          {
            id: "qa-edge-mapping",
            sourceRequestId: "qa-req-users",
            targetRequestId: "qa-req-user-detail",
            targetUrl: "{{baseUrl}}/users/:id",
            injections: [
              {
                sourceJsonPath: "$[0].id",
                targetField: "path",
                targetKey: "id",
              },
            ],
          },
        ],
        nodePositions: {
          "qa-req-users": {
            x: 100,
            y: 100,
          },
          "qa-req-user-detail": {
            x: 400,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-failing",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Failing Request",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-fail"],
        edges: [],
        nodePositions: {
          "qa-req-fail": {
            x: 100,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-slow",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Slow Request (Stop test)",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-slow"],
        edges: [],
        nodePositions: {
          "qa-req-slow": {
            x: 100,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-run-log",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Run Log",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-fast", "qa-req-fail"],
        edges: [],
        nodePositions: {
          "qa-req-fast": {
            x: 100,
            y: 100,
          },
          "qa-req-fail": {
            x: 400,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-undo",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Undo Restore",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-undo-a", "qa-req-undo-b"],
        edges: [],
        nodePositions: {
          "qa-req-undo-a": {
            x: 100,
            y: 100,
          },
          "qa-req-undo-b": {
            x: 400,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-shortcuts",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Shortcuts Overlay",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-shortcuts"],
        edges: [],
        nodePositions: {
          "qa-req-shortcuts": {
            x: 100,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-start-inputs",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Start Inputs to Header",
        createdAt: 1700000000000,
        blocks: [
          {
            id: "qa-start-1",
            type: "start",
            inputs: [
              {
                key: "qaToken",
                defaultValue: "qa-default-token",
                source: "literal",
              },
            ],
          },
        ],
        nodeIds: ["qa-req-echo"],
        edges: [],
        nodePositions: {
          "qa-start-1": {
            x: 100,
            y: 100,
          },
          "qa-req-echo": {
            x: 400,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-evaluate",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Evaluate to Header",
        createdAt: 1700000000000,
        blocks: [
          {
            id: "qa-evaluate-1",
            type: "evaluate",
            code: "return { token: data.response.data.token };",
            outputAlias: "evaluatedHeader",
          },
        ],
        nodeIds: ["qa-req-token", "qa-req-echo-eval"],
        edges: [
          {
            id: "qa-edge-eval-in",
            sourceRequestId: "qa-req-token",
            targetRequestId: "qa-evaluate-1",
            injections: [],
          },
          {
            id: "qa-edge-eval-out",
            sourceRequestId: "qa-evaluate-1",
            targetRequestId: "qa-req-echo-eval",
            injections: [
              {
                sourceJsonPath: "$.token",
                targetField: "header",
                targetKey: "x-qa-evaluated-token",
              },
            ],
          },
        ],
        nodePositions: {
          "qa-req-token": {
            x: 100,
            y: 100,
          },
          "qa-evaluate-1": {
            x: 400,
            y: 100,
          },
          "qa-req-echo-eval": {
            x: 700,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-validate",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Validate 3 Errors",
        createdAt: 1700000000000,
        blocks: [
          {
            id: "qa-validate-1",
            type: "validate",
            sourceJsonPath: "$",
            schema:
              '{"type":"object","required":["missingA","missingB","missingC"]}',
          },
        ],
        nodeIds: ["qa-req-fast"],
        edges: [
          {
            id: "qa-edge-validate-in",
            sourceRequestId: "qa-req-fast",
            targetRequestId: "qa-validate-1",
            injections: [],
          },
        ],
        nodePositions: {
          "qa-req-fast": {
            x: 100,
            y: 100,
          },
          "qa-validate-1": {
            x: 400,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-loop",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Loop 3 Items",
        createdAt: 1700000000000,
        blocks: [
          {
            id: "qa-loop-1",
            type: "loop",
            sourceJsonPath: "$",
            itemAlias: "item",
            maxIterations: 100,
          },
          {
            id: "qa-collect-1",
            type: "collect",
            loopId: "qa-loop-1",
          },
        ],
        nodeIds: ["qa-req-list", "qa-req-fast"],
        edges: [
          {
            id: "qa-edge-loop-in",
            sourceRequestId: "qa-req-list",
            targetRequestId: "qa-loop-1",
            injections: [],
          },
          {
            id: "qa-edge-loop-body",
            sourceRequestId: "qa-loop-1",
            targetRequestId: "qa-req-fast",
            branchId: "body",
            injections: [],
          },
          {
            id: "qa-edge-loop-collect",
            sourceRequestId: "qa-req-fast",
            targetRequestId: "qa-collect-1",
            injections: [],
          },
        ],
        nodePositions: {
          "qa-req-list": {
            x: 100,
            y: 100,
          },
          "qa-loop-1": {
            x: 400,
            y: 100,
          },
          "qa-req-fast": {
            x: 400,
            y: 250,
          },
          "qa-collect-1": {
            x: 700,
            y: 100,
          },
        },
      },
      {
        id: "qa-chain-parallel-lanes",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Parallel Lanes",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-parallel-slow", "qa-req-parallel-fast"],
        edges: [],
        nodePositions: {
          "qa-req-parallel-slow": {
            x: 100,
            y: 100,
          },
          "qa-req-parallel-fast": {
            x: 100,
            y: 300,
          },
        },
      },
      {
        id: "qa-chain-merge-all",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Merge All",
        createdAt: 1700000000000,
        blocks: [
          {
            id: "qa-merge-all-1",
            type: "merge",
            mode: "all",
          },
        ],
        nodeIds: ["qa-req-parallel-slow", "qa-req-parallel-fast"],
        edges: [
          {
            id: "qa-edge-merge-all-slow",
            sourceRequestId: "qa-req-parallel-slow",
            targetRequestId: "qa-merge-all-1",
            injections: [],
          },
          {
            id: "qa-edge-merge-all-fast",
            sourceRequestId: "qa-req-parallel-fast",
            targetRequestId: "qa-merge-all-1",
            injections: [],
          },
        ],
        nodePositions: {
          "qa-req-parallel-slow": {
            x: 100,
            y: 100,
          },
          "qa-req-parallel-fast": {
            x: 100,
            y: 300,
          },
          "qa-merge-all-1": {
            x: 400,
            y: 200,
          },
        },
      },
      {
        id: "qa-chain-merge-any",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Merge Any",
        createdAt: 1700000000000,
        blocks: [
          {
            id: "qa-merge-any-1",
            type: "merge",
            mode: "any",
          },
        ],
        nodeIds: ["qa-req-parallel-fast", "qa-req-parallel-slow"],
        edges: [
          {
            id: "qa-edge-merge-any-slow",
            sourceRequestId: "qa-req-parallel-slow",
            targetRequestId: "qa-merge-any-1",
            injections: [],
          },
          {
            id: "qa-edge-merge-any-fast",
            sourceRequestId: "qa-req-parallel-fast",
            targetRequestId: "qa-merge-any-1",
            injections: [],
          },
        ],
        nodePositions: {
          "qa-req-parallel-slow": {
            x: 100,
            y: 100,
          },
          "qa-req-parallel-fast": {
            x: 100,
            y: 300,
          },
          "qa-merge-any-1": {
            x: 400,
            y: 200,
          },
        },
      },
      {
        id: "qa-chain-subchain-target",
        scope: "standalone",
        schemaVersion: 5,
        name: "QA - Sub-chain Target",
        createdAt: 1700000000000,
        blocks: [],
        nodeIds: ["qa-req-sub-body"],
        edges: [],
        nodePositions: {
          "qa-req-sub-body": {
            x: 100,
            y: 100,
          },
        },
      },
    ],
  };

  // Schema (name/version/stores) mirrors src/lib/idbSchema.ts. Without an
  // explicit version + upgrade handler here, a bare
  // `indexedDB.open("requestly")` on a fresh browser profile
  // creates an empty v1 DB with NO object stores, and every putAll below
  // silently no-ops. Keep this schema in sync with e2e/fixtures/qaSeed.ts.
  var IDB_VERSION = 5;
  var req = indexedDB.open("requestly", IDB_VERSION);
  req.onupgradeneeded = () => {
    var db = req.result;
    if (!db.objectStoreNames.contains("collections")) {
      db.createObjectStore("collections", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("requests")) {
      db.createObjectStore("requests", { keyPath: "id" }).createIndex(
        "by-collection",
        "collectionId",
      );
    }
    if (!db.objectStoreNames.contains("folders")) {
      db.createObjectStore("folders", { keyPath: "id" }).createIndex(
        "by-collection",
        "collectionId",
      );
    }
    if (!db.objectStoreNames.contains("environments")) {
      db.createObjectStore("environments", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("history")) {
      db.createObjectStore("history", { keyPath: "id" }).createIndex(
        "by-timestamp",
        "timestamp",
      );
    }
    if (!db.objectStoreNames.contains("tabs")) {
      db.createObjectStore("tabs", { keyPath: "tabId" });
    }
    if (!db.objectStoreNames.contains("settings")) {
      db.createObjectStore("settings");
    }
    if (!db.objectStoreNames.contains("chainConfigs")) {
      db.createObjectStore("chainConfigs", { keyPath: "collectionId" });
    }
    if (!db.objectStoreNames.contains("chains")) {
      db.createObjectStore("chains", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("chainRuns")) {
      db.createObjectStore("chainRuns", { keyPath: "id" }).createIndex(
        "by-chain",
        "chainId",
      );
    }
  };
  req.onsuccess = () => {
    var db = req.result;

    function putAll(storeName, records) {
      if (
        !db.objectStoreNames.contains(storeName) ||
        !records ||
        records.length === 0
      )
        return;
      var tx = db.transaction(storeName, "readwrite");
      var store = tx.objectStore(storeName);
      var i;
      for (i = 0; i < records.length; i++) store.put(records[i]);
    }

    putAll("environments", data.environments);
    putAll("collections", data.collections);
    putAll("requests", data.requests);
    putAll("chains", data.chains);

    var chainConfigsTx;
    if (db.objectStoreNames.contains("chainConfigs")) {
      chainConfigsTx = db.transaction("chainConfigs", "readwrite");
      chainConfigsTx.objectStore("chainConfigs").put(data.legacyChainConfig);
    }

    db.close();
  };
})();
