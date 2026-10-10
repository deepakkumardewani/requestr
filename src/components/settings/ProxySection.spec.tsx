/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enSettings from "../../../messages/en/settings.json";
import { ProxySection } from "./ProxySection";

afterEach(cleanup);

function renderSection(
  overrides: Partial<Parameters<typeof ProxySection>[0]> = {},
) {
  const props = {
    sslVerify: true,
    followRedirects: true,
    proxyUrl: "",
    setSetting: vi.fn(),
    ...overrides,
  };
  render(<ProxySection {...props} />);
  return props;
}

describe("ProxySection", () => {
  it("reflects sslVerify and followRedirects props in the switches", () => {
    renderSection({ sslVerify: true, followRedirects: false });

    expect(screen.getByTestId("ssl-verification-switch")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("follow-redirects-switch")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls setSetting('sslVerify', false) when the SSL switch is turned off", () => {
    const { setSetting } = renderSection({ sslVerify: true });

    fireEvent.click(screen.getByTestId("ssl-verification-switch"));

    expect(setSetting).toHaveBeenCalledWith("sslVerify", false);
  });

  it("calls setSetting('followRedirects', true) when the redirect switch is turned on", () => {
    const { setSetting } = renderSection({ followRedirects: false });

    fireEvent.click(screen.getByTestId("follow-redirects-switch"));

    expect(setSetting).toHaveBeenCalledWith("followRedirects", true);
  });

  it("calls setSetting('proxyUrl', value) when the proxy URL is typed", () => {
    const { setSetting } = renderSection();

    fireEvent.change(screen.getByTestId("proxy-url-input"), {
      target: { value: "http://proxy.test:3128" },
    });

    expect(setSetting).toHaveBeenCalledWith("proxyUrl", "http://proxy.test:3128");
  });

  it("shows the current proxyUrl as the input value", () => {
    renderSection({ proxyUrl: "http://proxy.test:3128" });

    expect(screen.getByTestId("proxy-url-input")).toHaveValue(
      "http://proxy.test:3128",
    );
  });

  it("renders the localized placeholder on the empty proxy URL input", () => {
    renderSection();

    expect(screen.getByTestId("proxy-url-input")).toHaveAttribute(
      "placeholder",
      enSettings.proxy.proxyUrlPlaceholder,
    );
  });
});
