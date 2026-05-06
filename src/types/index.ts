export type TabType = "http" | "graphql" | "websocket" | "socketio";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type KVPair = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  type?: "query" | "path";
};

export type AuthType = "none" | "bearer" | "basic" | "api-key";

export type AuthConfig =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "api-key"; key: string; value: string; addTo: "header" | "query" };

export type BodyType =
  | "none"
  | "json"
  | "xml"
  | "text"
  | "html"
  | "form-data"
  | "urlencoded";

export type BodyConfig = {
  type: BodyType;
  content: string;
  formData?: KVPair[];
};

export type BulkCloseAction =
  | { kind: "others"; keepTabId: string }
  | { kind: "all" };

export type WsMessage = {
  id: string;
  direction: "sent" | "received";
  data: string;
  timestamp: number;
};

export type BaseTab = {
  tabId: string;
  requestId: string | null;
  name: string;
  isDirty: boolean;
  type: TabType;
  url: string;
  headers: KVPair[];
  /** Optional color label (hex or named color) for visual grouping. */
  color?: string;
  /** Optional group name shown as a subtle separator in the tab bar. */
  group?: string;
};

export type HttpTab = BaseTab & {
  type: "http";
  method: HttpMethod;
  params: KVPair[];
  auth: AuthConfig;
  body: BodyConfig;
  preScript: string;
  postScript: string;
  /** Request timeout in milliseconds (default 30_000 at send time if unset). */
  timeoutMs?: number;
  /** No-code assertions evaluated after each response. */
  assertions?: import("@/types/chain").ChainAssertion[];
  /** Per-request SSL verification override (undefined = use global setting). */
  sslVerify?: boolean;
  /** Per-request follow-redirects override (undefined = use global setting). */
  followRedirects?: boolean;
};

export type GraphQLTab = BaseTab & {
  type: "graphql";
  query: string;
  variables: string;
  operationName: string;
  auth: AuthConfig;
  /** Request timeout when sending GraphQL over HTTP (ms). */
  timeoutMs?: number;
  /** Per-request SSL verification override (undefined = use global setting). */
  sslVerify?: boolean;
  /** Per-request follow-redirects override (undefined = use global setting). */
  followRedirects?: boolean;
};

export type WebSocketTab = BaseTab & {
  type: "websocket";
  messageLog: WsMessage[];
};

export type SocketIOTab = BaseTab & {
  type: "socketio";
  messageLog: WsMessage[];
};

export type TabState = HttpTab | GraphQLTab | WebSocketTab | SocketIOTab;

export type RequestModel = {
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KVPair[];
  headers: KVPair[];
  auth: AuthConfig;
  body: BodyConfig;
  preScript: string;
  postScript: string;
  /** Request timeout in milliseconds (optional; default 30_000 at send time). */
  timeoutMs?: number;
  /** Per-request SSL verification override (undefined = use global setting). */
  sslVerify?: boolean;
  /** Per-request follow-redirects override (undefined = use global setting). */
  followRedirects?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type CollectionModel = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
};

export type EnvVariable = {
  id: string;
  key: string;
  initialValue: string;
  currentValue: string;
  isSecret: boolean;
};

export type EnvironmentModel = {
  id: string;
  name: string;
  description?: string;
  variables: EnvVariable[];
  createdAt: number;
  updatedAt: number;
};

export type TimingData = {
  dns: number | null;
  tcp: number | null;
  tls: number | null;
  ttfb: number;
  download: number;
  total: number;
};

export type ResponseData = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  size: number;
  url: string;
  method: HttpMethod;
  timestamp: number;
  timing?: TimingData;
};

export type HistoryEntry = {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  size: number;
  timestamp: number;
  request: HttpTab;
  response: ResponseData;
};

export type AppSettings = {
  theme: "dark" | "light" | "system";
  proxyUrl: string;
  sslVerify: boolean;
  followRedirects: boolean;
  showHealthMonitor: boolean;
  showCodeGen: boolean;
  codeGenLang: string;
  autoExpandExplainer: boolean;
  locale: "en" | "fr" | "ja";
  /** Prepended to relative request URLs (path-only or no scheme). */
  globalBaseUrl: string;
  /** Default headers merged on send; per-request same key wins. */
  globalHeaders: KVPair[];
  /** Request IDs pinned to the top of the sidebar. */
  pinnedRequestIds: string[];
  /** User-selected accent color RGB values for the app theme. */
  accentColor: { r: number; g: number; b: number };
};

export type HealthMetrics = {
  successRate: number;
  p50: number;
  p95: number;
  lastStatus: number;
  entryCount: number;
};

export type RequestError = {
  type: "network" | "timeout" | "parse" | "proxy";
  message: string;
  cause?: string;
};

export type ParsedCurl = {
  method: HttpMethod;
  url: string;
  headers: KVPair[];
  body: BodyConfig;
  auth: AuthConfig;
};
