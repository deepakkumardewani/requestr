/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { BlurHeadline } from "./BlurHeadline";

const TEXT = "Every request, one keystroke away";

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("BlurHeadline", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", NoopObserver);
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
    vi.unstubAllGlobals();
    useSettingsStore.setState({ reducedMotion: "system" });
  });

  it("renders each word in order inside the aria-hidden layer", () => {
    const { container } = render(<BlurHeadline text={TEXT} />);
    const hidden = container.querySelector('[aria-hidden="true"]');
    const words = [...(hidden?.children ?? [])].map((el) => el.textContent);
    expect(words).toEqual(["Every", "request,", "one", "keystroke", "away"]);
  });

  it("exposes the full sentence once as sr-only text", () => {
    render(<BlurHeadline text={TEXT} />);
    const full = screen.getByText(TEXT);
    expect(full).toHaveClass("sr-only");
  });

  it("starts words hidden and blurred, and spaces all but the first", () => {
    const { container } = render(<BlurHeadline text={TEXT} />);
    const words = [
      ...(container.querySelector('[aria-hidden="true"]')?.children ?? []),
    ] as HTMLElement[];
    expect(words[0]).not.toHaveClass("ml-[0.25em]");
    expect(words[1]).toHaveClass("ml-[0.25em]");
    for (const word of words) {
      expect(word).toHaveClass("inline-block");
      expect(word.style.opacity).toBe("0");
      expect(word.style.filter).toBe("blur(8px)");
    }
  });

  it("applies the className to the wrapper", () => {
    const { container } = render(
      <BlurHeadline text={TEXT} className="headline" />,
    );
    expect(container.firstElementChild).toHaveClass("headline");
  });

  it("renders the final text with no animation layer under reduced motion", () => {
    useSettingsStore.setState({ reducedMotion: "on" });
    const { container } = render(
      <BlurHeadline text={TEXT} className="headline" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("headline");
    expect(root.textContent).toBe(TEXT);
    expect(root.children).toHaveLength(0);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelector(".sr-only")).toBeNull();
    expect(root.querySelector("[style]")).toBeNull();
  });
});
