/**
 * Secret shapes the redaction layer must never let through (FR-60). Fixtures
 * only: none of these are real credentials, and none names a vendor.
 */

export type SecretSample = {
  name: string;
  /** The literal that must not survive redaction. */
  secret: string;
};

export const JWT_SECRET =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PjVzJxYy7yQ4";

/** Shapes recognised by their own format, wherever they appear in text. */
export const TOKEN_SHAPE_CORPUS: readonly SecretSample[] = [
  { name: "JWT", secret: JWT_SECRET },
  { name: "sk- live key", secret: "sk-live-4eC39HqLyjWDarjtT1zdp7dc" },
  { name: "sk- project key", secret: "sk-proj-abcdEFGH1234ijklMNOP5678" },
  { name: "sk- namespaced key", secret: "sk-ant-api03-Zk3mQw9xLpVb7TnR2yHd" },
  { name: "repo token", secret: "ghp_1234567890abcdefghijABCDEFGHIJ123456" },
  { name: "cloud access key id", secret: "AKIAIOSFODNN7EXAMPLE" },
];

/** A password that has no recognisable shape and is only known by its slot. */
export const PLAIN_PASSWORD = "hunter2-correct-horse";
export const BASIC_CREDENTIALS = "dXNlcjpwYXNzd29yZDEyMzQ1";
export const SESSION_COOKIE = "session=abc123def456ghi789; theme=dark";

/** A resolved secret-typed environment value, known only through the environment. */
export const ENV_SECRET_VALUE = "plain-env-secret-value-9981";

/**
 * Secrets a GraphQL, WebSocket or Socket.IO tab can carry: auth, headers,
 * variables and message payloads (FR-144). Each `secret` must never reach the model.
 */
export const TAB_REQUEST_AUTH_TOKEN = "tab-auth-token-5f2c91a7d3e84b60";
export const TAB_REQUEST_API_KEY = "tab-api-key-0b7e44c1a9d25f38";
export const TAB_REQUEST_CORPUS: readonly SecretSample[] = [
  { name: "tab bearer auth token", secret: TAB_REQUEST_AUTH_TOKEN },
  { name: "tab api key header", secret: TAB_REQUEST_API_KEY },
  { name: "JWT in a message payload", secret: JWT_SECRET },
];
