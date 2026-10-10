import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "./messages";

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("next-intl/server", () => ({
  getRequestConfig:
    (factory: () => Promise<unknown>) => () =>
      factory(),
}));

async function resolveConfig() {
  const { default: config } = await import("./request");
  return (config as unknown as () => Promise<{
    locale: string;
    messages: unknown;
  }>)();
}

describe("i18n request config", () => {
  beforeEach(() => {
    cookieGet.mockReset();
  });

  it.each(["fr", "ja"] as const)(
    "loads the %s bundle when the locale cookie is %s",
    async (locale) => {
      cookieGet.mockReturnValue({ value: locale });
      const config = await resolveConfig();
      expect(config.locale).toBe(locale);
      expect(config.messages).toBe(MESSAGES[locale]);
    },
  );

  it("falls back to en without a cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    const config = await resolveConfig();
    expect(config.locale).toBe("en");
    expect(config.messages).toBe(MESSAGES.en);
  });

  it("falls back to en for an unsupported cookie value", async () => {
    cookieGet.mockReturnValue({ value: "de" });
    const config = await resolveConfig();
    expect(config.locale).toBe("en");
    expect(config.messages).toBe(MESSAGES.en);
  });
});
