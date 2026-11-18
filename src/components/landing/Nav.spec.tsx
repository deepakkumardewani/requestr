/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_URL } from "./constants";
import { Nav } from "./Nav";

let mockPathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));
vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}));

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let ioCallback: IOCallback | null = null;
const observed: string[] = [];
const disconnect = vi.fn();

// next/link also creates observers (prefetch); only the scroll-spy one passes a threshold list.
class FakeIntersectionObserver {
  private readonly isScrollSpy: boolean;
  constructor(cb: IOCallback, options?: IntersectionObserverInit) {
    this.isScrollSpy = Array.isArray(options?.threshold);
    if (this.isScrollSpy) ioCallback = cb;
  }
  observe(el: Element) {
    if (this.isScrollSpy) observed.push(el.id);
  }
  unobserve() {}
  disconnect() {
    if (this.isScrollSpy) disconnect();
  }
}

function addSections() {
  for (const id of ["hero", "how-it-works", "features", "compare"]) {
    const el = document.createElement("section");
    el.id = id;
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
  }
}

function intersect(id: string, ratio: number, isIntersecting = true) {
  act(() => {
    ioCallback?.([
      {
        target: document.getElementById(id) as Element,
        isIntersecting,
        intersectionRatio: ratio,
      },
    ]);
  });
}

describe("Nav", () => {
  beforeEach(() => {
    mockPathname = "/";
    ioCallback = null;
    observed.length = 0;
    disconnect.mockClear();
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("has no Docs link in the header", () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByRole("link", { name: /docs/i })).toBeNull();
  });

  it("renders brand, section links, GitHub and the app CTA", () => {
    render(<Nav />);
    expect(screen.getByAltText("Requestr logo")).toBeInTheDocument();
    for (const label of ["Home", "How it works", "Features", "Compare"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: "Requestr on GitHub" }),
    ).toHaveAttribute("href", GITHUB_URL);
    expect(screen.getByRole("link", { name: "Open the app" })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("marks Home active on the home page initially", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Features" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("scrolls to top for Home and to the section for others", () => {
    addSections();
    render(<Nav />);
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
    fireEvent.click(screen.getByRole("link", { name: "Features" }));
    expect(
      document.getElementById("features")?.scrollIntoView,
    ).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("does not throw when the target section is missing", () => {
    render(<Nav />);
    expect(() =>
      fireEvent.click(screen.getByRole("link", { name: "Compare" })),
    ).not.toThrow();
  });

  it("links to /#section off the home page and shows no active link", () => {
    mockPathname = "/privacy";
    render(<Nav />);
    const link = screen.getByRole("link", { name: "Compare" });
    expect(link).toHaveAttribute("href", "/#compare");
    expect(link).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(ioCallback).toBeNull();
  });

  it("closes the mobile menu when an off-home link is clicked", () => {
    mockPathname = "/terms";
    render(<Nav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const mobile = document.getElementById("mobile-menu") as HTMLElement;
    const link = mobile.querySelector('a[href="/#features"]') as HTMLElement;
    fireEvent.click(link);
    expect(document.getElementById("mobile-menu")).toBeNull();
  });

  it("condenses once scrolled past 48px and relaxes again", () => {
    render(<Nav />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("bg-transparent");
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.className).toContain("shadow-sm");
    act(() => {
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.className).toContain("bg-transparent");
  });

  it("observes every section and highlights the most visible one", () => {
    addSections();
    render(<Nav />);
    expect(observed).toEqual(["hero", "how-it-works", "features", "compare"]);
    intersect("how-it-works", 0.3);
    intersect("features", 0.6);
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    intersect("features", 0, false);
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("keeps the previous active section when nothing is visible", () => {
    addSections();
    render(<Nav />);
    intersect("compare", 0.5);
    intersect("compare", 0, false);
    expect(screen.getByRole("link", { name: "Compare" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<Nav />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("toggles the mobile menu and lists GitHub there", () => {
    render(<Nav />);
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "Close menu" }),
    ).toHaveAttribute("aria-expanded", "true");
    const mobile = document.getElementById("mobile-menu") as HTMLElement;
    expect(mobile.querySelector(`a[href="${GITHUB_URL}"]`)).toHaveTextContent(
      "GitHub",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(document.getElementById("mobile-menu")).toBeNull();
  });

  it("closes the menu after choosing a mobile link and via GitHub link", () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const mobile = document.getElementById("mobile-menu") as HTMLElement;
    fireEvent.click(mobile.querySelector(`a[href="${GITHUB_URL}"]`) as Element);
    expect(document.getElementById("mobile-menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const again = document.getElementById("mobile-menu") as HTMLElement;
    fireEvent.click(again.querySelector('a[href="#compare"]') as Element);
    expect(document.getElementById("mobile-menu")).toBeNull();
  });

  it("closes on Escape and returns focus to the toggle; ignores other keys", () => {
    render(<Nav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(document.getElementById("mobile-menu")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.getElementById("mobile-menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  });
});
