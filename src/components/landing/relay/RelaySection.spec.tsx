/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  RELAY_EYEBROW,
  RELAY_HEADLINE,
  RELAY_LEDE,
  RELAY_LOOP_SRC,
  RELAY_POSTER_SRC,
} from "../constants";
import { RelaySection } from "./RelaySection";

const BANNED_COPY = [
  "cards",
  "undone",
  "seamlessly",
  "leverage",
  "unlock",
  "supercharge",
];

let intersect: () => void;

/** Captures only the DemoVideo observer (identified by its rootMargin); motion's whileInView observers are inert. */
class FakeObserver {
  constructor(
    cb: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    if (options?.rootMargin !== "200px") return;
    intersect = () =>
      cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("RelaySection", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.stubGlobal(
      "matchMedia",
      () =>
        ({
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useSettingsStore.setState({ reducedMotion: "system" });
  });

  it("is a labelled section with the headline, eyebrow and lede", () => {
    render(<RelaySection />);
    const section = screen.getByRole("region", { name: RELAY_HEADLINE });
    expect(section).toHaveAttribute("id", "relay");
    expect(
      screen.getByRole("heading", { level: 2, name: RELAY_HEADLINE }),
    ).toBeInTheDocument();
    expect(screen.getByText(RELAY_EYEBROW)).toBeInTheDocument();
    expect(screen.getByText(RELAY_LEDE)).toBeInTheDocument();
  });

  it("shows the full headline text at once under reduced motion", () => {
    useSettingsStore.setState({ reducedMotion: "on" });
    render(<RelaySection />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      RELAY_HEADLINE,
    );
  });

  it("renders the loop poster with alt text and no dialog or video yet", () => {
    const { container } = render(<RelaySection />);
    expect(
      screen.getByAltText(/Relay editing requests in a collection/),
    ).toHaveAttribute("src", RELAY_POSTER_SRC);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mounts a muted, looping, inline loop video once near the viewport", () => {
    const { container } = render(<RelaySection />);
    act(() => intersect());
    const video = container.querySelector("video");
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(container.querySelector("source")).toHaveAttribute(
      "src",
      `${RELAY_LOOP_SRC}.webm`,
    );
  });

  it("opens the demo modal from the play affordance", async () => {
    const user = userEvent.setup();
    render(<RelaySection />);
    await user.click(screen.getByRole("button", { name: "Play the full demo" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Requestr demo recording").querySelector("source"),
    ).toHaveAttribute("src", "/media/relay/relay-full.webm");
  });

  it("opens the demo modal from the Watch the demo button and can reopen", async () => {
    const user = userEvent.setup();
    render(<RelaySection />);
    const button = screen.getByRole("button", { name: /watch the demo/i });
    await user.click(button);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("contains no banned copy", () => {
    const { container } = render(<RelaySection />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const word of BANNED_COPY) expect(text).not.toContain(word);
  });
});
