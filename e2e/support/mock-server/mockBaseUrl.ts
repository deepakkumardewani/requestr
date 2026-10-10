/** Single source of truth for mock-server addresses, shared by the server and by specs. */
export const MOCK_HOST = "127.0.0.1";
export const MOCK_HTTP_PORT = Number(process.env.MOCK_PORT ?? 3333);
export const MOCK_HTTPS_PORT = Number(process.env.MOCK_HTTPS_PORT ?? 3334);

export const MOCK_BASE_URL =
  process.env.MOCK_BASE_URL ?? `http://${MOCK_HOST}:${MOCK_HTTP_PORT}`;
export const MOCK_HTTPS_URL =
  process.env.MOCK_HTTPS_URL ?? `https://${MOCK_HOST}:${MOCK_HTTPS_PORT}`;
export const MOCK_WS_URL =
  process.env.MOCK_WS_URL ?? `ws://${MOCK_HOST}:${MOCK_HTTP_PORT}/ws`;

/** Header specs send so concurrent workers never see each other's traffic. */
export const TEST_ID_HEADER = "x-test-id";
export const DEFAULT_TEST_ID = "default";
