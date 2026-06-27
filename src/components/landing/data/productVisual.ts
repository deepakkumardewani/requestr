export type ProductMethod = "GET" | "POST" | "DELETE";

export interface MockHeader {
  key: string;
  value: string;
  valueClass?: string;
}

export interface MockResponseLine {
  indent: number;
  parts: Array<{ text: string; className?: string }>;
}

export interface MockResponse {
  status: number;
  statusLabel: string;
  timingMs: number;
  sizeKb: number;
  lines: MockResponseLine[];
  loadingMs: number;
}

export interface ProductRequestConfig {
  method: ProductMethod;
  label: string;
  path: string;
  headers: MockHeader[];
  responses: MockResponse[];
}

export const PRODUCT_METHODS: ProductMethod[] = ["GET", "POST", "DELETE"];

export const METHOD_TEXT: Record<ProductMethod, string> = {
  GET: "text-emerald-400",
  POST: "text-blue-400",
  DELETE: "text-red-400",
};

export const METHOD_TAB_HOVER: Record<ProductMethod, string> = {
  GET: "hover:bg-emerald-500/10 hover:border-emerald-500/25",
  POST: "hover:bg-blue-500/10 hover:border-blue-500/25",
  DELETE: "hover:bg-red-500/10 hover:border-red-500/25",
};

export const PRODUCT_REQUESTS: Record<ProductMethod, ProductRequestConfig> = {
  GET: {
    method: "GET",
    label: "users",
    path: "/users",
    headers: [
      {
        key: "Authorization",
        value: "Bearer ••••••••••",
        valueClass: "text-emerald-400/70",
      },
      {
        key: "Accept",
        value: "application/json",
        valueClass: "text-blue-400/70",
      },
    ],
    responses: [
      {
        status: 200,
        statusLabel: "OK",
        timingMs: 38,
        sizeKb: 1.2,
        loadingMs: 520,
        lines: [
          { indent: 0, parts: [{ text: "[" }] },
          { indent: 1, parts: [{ text: "{" }] },
          {
            indent: 2,
            parts: [
              { text: '"id"', className: "text-blue-400/80" },
              { text: ": " },
              { text: "1", className: "text-amber-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 2,
            parts: [
              { text: '"name"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"Alice"', className: "text-emerald-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 2,
            parts: [
              { text: '"role"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"admin"', className: "text-emerald-400/80" },
            ],
          },
          { indent: 1, parts: [{ text: "}" }] },
          { indent: 0, parts: [{ text: "]" }] },
        ],
      },
      {
        status: 200,
        statusLabel: "OK",
        timingMs: 44,
        sizeKb: 2.1,
        loadingMs: 610,
        lines: [
          { indent: 0, parts: [{ text: "[" }] },
          { indent: 1, parts: [{ text: "{" }] },
          {
            indent: 2,
            parts: [
              { text: '"id"', className: "text-blue-400/80" },
              { text: ": " },
              { text: "2", className: "text-amber-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 2,
            parts: [
              { text: '"name"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"Bob"', className: "text-emerald-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 2,
            parts: [
              { text: '"role"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"editor"', className: "text-emerald-400/80" },
            ],
          },
          { indent: 1, parts: [{ text: "}," }] },
          { indent: 1, parts: [{ text: "{" }] },
          {
            indent: 2,
            parts: [
              { text: '"id"', className: "text-blue-400/80" },
              { text: ": " },
              { text: "3", className: "text-amber-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 2,
            parts: [
              { text: '"name"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"Charlie"', className: "text-emerald-400/80" },
            ],
          },
          { indent: 1, parts: [{ text: "}" }] },
          { indent: 0, parts: [{ text: "]" }] },
        ],
      },
      {
        status: 404,
        statusLabel: "Not Found",
        timingMs: 22,
        sizeKb: 0.4,
        loadingMs: 480,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"error"', className: "text-blue-400/80" },
              { text: ": " },
              {
                text: '"users collection not found"',
                className: "text-emerald-400/80",
              },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
      {
        status: 200,
        statusLabel: "OK",
        timingMs: 67,
        sizeKb: 0.2,
        loadingMs: 690,
        lines: [{ indent: 0, parts: [{ text: "[]" }] }],
      },
    ],
  },
  POST: {
    method: "POST",
    label: "auth/login",
    path: "/auth/login",
    headers: [
      {
        key: "Content-Type",
        value: "application/json",
        valueClass: "text-blue-400/70",
      },
      {
        key: "Accept",
        value: "application/json",
        valueClass: "text-blue-400/70",
      },
    ],
    responses: [
      {
        status: 201,
        statusLabel: "Created",
        timingMs: 112,
        sizeKb: 0.8,
        loadingMs: 550,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"token"', className: "text-blue-400/80" },
              { text: ": " },
              {
                text: '"eyJhbGciOiJIUzI1NiJ9…"',
                className: "text-emerald-400/80",
              },
              { text: "," },
            ],
          },
          {
            indent: 1,
            parts: [
              { text: '"expiresIn"', className: "text-blue-400/80" },
              { text: ": " },
              { text: "3600", className: "text-amber-400/80" },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
      {
        status: 200,
        statusLabel: "OK",
        timingMs: 89,
        sizeKb: 0.6,
        loadingMs: 430,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"userId"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"usr_8f2k"', className: "text-emerald-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 1,
            parts: [
              { text: '"session"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"active"', className: "text-emerald-400/80" },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
      {
        status: 401,
        statusLabel: "Unauthorized",
        timingMs: 31,
        sizeKb: 0.3,
        loadingMs: 510,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"error"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"invalid credentials"', className: "text-red-400/80" },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
      {
        status: 422,
        statusLabel: "Unprocessable",
        timingMs: 28,
        sizeKb: 0.5,
        loadingMs: 460,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"email"', className: "text-blue-400/80" },
              { text: ": " },
              {
                text: '"must be a valid address"',
                className: "text-red-400/80",
              },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
    ],
  },
  DELETE: {
    method: "DELETE",
    label: "items/42",
    path: "/items/42",
    headers: [
      {
        key: "Authorization",
        value: "Bearer ••••••••••",
        valueClass: "text-emerald-400/70",
      },
      {
        key: "Accept",
        value: "application/json",
        valueClass: "text-blue-400/70",
      },
    ],
    responses: [
      {
        status: 200,
        statusLabel: "OK",
        timingMs: 54,
        sizeKb: 0.3,
        loadingMs: 490,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"deleted"', className: "text-blue-400/80" },
              { text: ": " },
              { text: "true", className: "text-amber-400/80" },
              { text: "," },
            ],
          },
          {
            indent: 1,
            parts: [
              { text: '"id"', className: "text-blue-400/80" },
              { text: ": " },
              { text: "42", className: "text-amber-400/80" },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
      {
        status: 404,
        statusLabel: "Not Found",
        timingMs: 19,
        sizeKb: 0.2,
        loadingMs: 420,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"error"', className: "text-blue-400/80" },
              { text: ": " },
              { text: '"item 42 not found"', className: "text-red-400/80" },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
      {
        status: 204,
        statusLabel: "No Content",
        timingMs: 41,
        sizeKb: 0,
        loadingMs: 580,
        lines: [
          {
            indent: 0,
            parts: [
              { text: "// empty body", className: "text-muted-foreground/50" },
            ],
          },
        ],
      },
      {
        status: 409,
        statusLabel: "Conflict",
        timingMs: 36,
        sizeKb: 0.4,
        loadingMs: 650,
        lines: [
          { indent: 0, parts: [{ text: "{" }] },
          {
            indent: 1,
            parts: [
              { text: '"error"', className: "text-blue-400/80" },
              { text: ": " },
              {
                text: '"item is referenced elsewhere"',
                className: "text-red-400/80",
              },
            ],
          },
          { indent: 0, parts: [{ text: "}" }] },
        ],
      },
    ],
  },
};

export function statusBadgeClass(status: number): string {
  if (status >= 200 && status < 300)
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/25";
  if (status >= 400 && status < 500)
    return "bg-red-500/20 text-red-400 border-red-500/25";
  return "bg-amber-500/20 text-amber-400 border-amber-500/25";
}

/** Tallest mock response — used to reserve fixed panel height in ProductVisual */
export function getMaxResponseLineCount(): number {
  let max = 0;
  for (const method of PRODUCT_METHODS) {
    for (const response of PRODUCT_REQUESTS[method].responses) {
      max = Math.max(max, response.lines.length);
    }
  }
  return max;
}

export const MAX_RESPONSE_LINE_COUNT = getMaxResponseLineCount();

/** Status row + JSON body area inside the response panel (excludes panel padding) */
export const RESPONSE_CONTENT_MIN_HEIGHT = `calc(1.75rem + ${MAX_RESPONSE_LINE_COUNT} * 1.25rem)`;

/** Full response panel including p-3 padding */
export const RESPONSE_PANEL_MIN_HEIGHT = `calc(1.5rem + ${RESPONSE_CONTENT_MIN_HEIGHT})`;
