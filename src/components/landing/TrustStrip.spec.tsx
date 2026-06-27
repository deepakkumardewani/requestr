/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrustStrip } from "./TrustStrip";

describe("TrustStrip", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the config manifest with benefit signals", () => {
    render(<TrustStrip />);
    expect(screen.getByText("requestr.manifest")).toBeInTheDocument();
    expect(screen.getByText("No install")).toBeInTheDocument();
    expect(screen.getByText("Privacy-first")).toBeInTheDocument();
    expect(screen.getByText("Zero setup")).toBeInTheDocument();
    expect(screen.getByText(/your requests never leave this tab/)).toBeInTheDocument();
  });

  it("shows manifest keys as developer-native config values", () => {
    render(<TrustStrip />);
    expect(screen.getByText("install")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("setup_time")).toBeInTheDocument();
    expect(screen.getByText("data_location")).toBeInTheDocument();
    expect(screen.getByText("0ms")).toBeInTheDocument();
    expect(screen.getByText('"browser-only"')).toBeInTheDocument();
  });
});
