/** @vitest-environment happy-dom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ImportSection } from "./ImportSection";

describe("ImportSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the section with the correct id for nav scroll-spy", () => {
    const { container } = render(<ImportSection />);
    expect(container.querySelector("#import")).toBeInTheDocument();
  });

  it("renders the Import and backup eyebrow and both group headings", () => {
    render(<ImportSection />);
    expect(screen.getByText("Import and backup")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Import" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Backup" }),
    ).toBeInTheDocument();
  });

  it("lists every import format", () => {
    render(<ImportSection />);
    for (const chip of ["cURL", "Postman v2.1", "Insomnia", "OpenAPI 3", "Swagger 2"]) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
  });

  it("does not render a dead 'see import formats' link", () => {
    render(<ImportSection />);
    expect(
      screen.queryByRole("link", { name: /see import formats/i }),
    ).not.toBeInTheDocument();
  });

  it("says what an import becomes", () => {
    render(<ImportSection />);
    expect(screen.getByText(/request ready to send/)).toBeInTheDocument();
  });

  it("describes Export and Restore with the dialog verbs", () => {
    render(<ImportSection />);
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Restore")).toBeInTheDocument();
  });

  it("renders light and dark import screenshots with alt text", () => {
    render(<ImportSection />);
    const images = screen.getAllByRole("img", { hidden: true });
    expect(images).toHaveLength(2);
    for (const img of images) expect(img).toHaveAttribute("alt");
  });

  it("gives both import screenshots descriptive alt text", () => {
    render(<ImportSection />);
    const images = screen.getAllByRole("img", { hidden: true });
    for (const img of images) {
      expect(img.getAttribute("alt")).toMatch(/import api resources page.*curl import tab/i);
    }
  });

  it("serves a light and a dark source, each hidden in the opposite theme", () => {
    render(<ImportSection />);
    const [light, dark] = screen.getAllByRole("img", { hidden: true });
    expect(decodeURIComponent(light.getAttribute("src") ?? "")).toContain(
      "/screens/import-light.webp",
    );
    expect(light).toHaveClass("dark:hidden");
    expect(decodeURIComponent(dark.getAttribute("src") ?? "")).toContain(
      "/screens/import-dark.webp",
    );
    expect(dark).toHaveClass("hidden", "dark:block");
  });

  it("renders the section headline", () => {
    render(<ImportSection />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Bring what you have. Keep what you build.",
      }),
    ).toBeInTheDocument();
  });

  it("describes the import group lede", () => {
    render(<ImportSection />);
    expect(screen.getByText(/Paste a cURL command or drop a Postman/)).toBeInTheDocument();
  });

  it("renders the backup group copy and both item descriptions", () => {
    render(<ImportSection />);
    const backup = screen.getByRole("group", { name: "Backup" });
    expect(backup).toHaveTextContent(/restore it on any machine/);
    expect(backup).toHaveTextContent(/save them as one file/);
    expect(backup).toHaveTextContent(/review what it contains/);
  });

  it("keeps the backup group text-only", () => {
    render(<ImportSection />);
    const backup = screen.getByRole("group", { name: "Backup" });
    expect(within(backup).queryAllByRole("img", { hidden: true })).toHaveLength(0);
  });

  it("puts the import screenshots inside the Import group", () => {
    render(<ImportSection />);
    const group = screen.getByRole("group", { name: "Import" });
    expect(within(group).getAllByRole("img", { hidden: true })).toHaveLength(2);
  });
});
