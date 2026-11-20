/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/analytics/adapter";
import { ProxySection } from "./ProxySection";

vi.mock("@/lib/analytics/adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/adapter")>()),
  track: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

function renderSection() {
  const setSetting = vi.fn();
  render(
    <ProxySection
      sslVerify
      followRedirects
      proxyUrl=""
      setSetting={setSetting}
    />,
  );
  return setSetting;
}

describe("ProxySection setting_changed events", () => {
  it("emits ssl_verification once per switch change", () => {
    const setSetting = renderSection();

    fireEvent.click(screen.getByTestId("ssl-verification-switch"));

    expect(setSetting).toHaveBeenCalledWith("sslVerify", false);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("setting_changed", {
      setting_id: "ssl_verification",
      value_kind: "bool",
    });
  });

  it("emits follow_redirects once per switch change", () => {
    const setSetting = renderSection();

    fireEvent.click(screen.getByTestId("follow-redirects-switch"));

    expect(setSetting).toHaveBeenCalledWith("followRedirects", false);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("setting_changed", {
      setting_id: "follow_redirects",
      value_kind: "bool",
    });
  });

  it("emits nothing when the proxy URL is edited", () => {
    renderSection();

    fireEvent.change(screen.getByTestId("proxy-url-input"), {
      target: { value: "http://secret.internal:8080" },
    });

    expect(track).not.toHaveBeenCalled();
  });
});
