/** @vitest-environment happy-dom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeatureMedia, toDarkSource } from "./FeatureMedia";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    priority,
  }: {
    src: string;
    alt: string;
    className: string;
    priority?: boolean;
  }) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img src={src} alt={alt} className={className} data-priority={String(priority)} />
  ),
}));

const ALT = "Requestr JSON compare view";

function render(src: string, priority?: boolean): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <FeatureMedia screenshot={{ src, alt: ALT }} priority={priority} />,
  );
  return container;
}

describe("toDarkSource", () => {
  it("swaps the -light. suffix for -dark.", () => {
    expect(toDarkSource("/screens/chains-light.webp")).toBe(
      "/screens/chains-dark.webp",
    );
  });

  it("returns the same path when there is no light suffix", () => {
    expect(toDarkSource("/media/relay/relay-poster.webp")).toBe(
      "/media/relay/relay-poster.webp",
    );
  });
});

describe("FeatureMedia", () => {
  it("renders a light and a dark image with the same alt for a light source", () => {
    const imgs = [...render("/screens/chains-light.webp").querySelectorAll("img")];
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual([
      "/screens/chains-light.webp",
      "/screens/chains-dark.webp",
    ]);
    expect(imgs.map((i) => i.getAttribute("alt"))).toEqual([ALT, ALT]);
  });

  it("hides the light image in dark mode and the dark image in light mode", () => {
    const [light, dark] = [
      ...render("/screens/chains-light.webp").querySelectorAll("img"),
    ];
    expect(light.className).toContain("dark:hidden");
    expect(dark.className).toContain("hidden");
    expect(dark.className).toContain("dark:block");
  });

  it("renders a single image when the source has no dark twin", () => {
    const imgs = render("/media/relay/relay-poster.webp").querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("alt")).toBe(ALT);
    expect(imgs[0].className).not.toContain("dark:");
  });

  it("preloads both the light and dark images when priority is set", () => {
    const imgs = [
      ...render("/screens/chains-light.webp", true).querySelectorAll("img"),
    ];
    expect(imgs.map((i) => i.getAttribute("data-priority"))).toEqual([
      "true",
      "true",
    ]);
  });

  it("sets priority on a source with no dark twin when priority is set", () => {
    const [only] = [
      ...render("/media/relay/relay-poster.webp", true).querySelectorAll("img"),
    ];
    expect(only.getAttribute("data-priority")).toBe("true");
  });

  it("does not set priority on either image by default", () => {
    const imgs = [...render("/screens/chains-light.webp").querySelectorAll("img")];
    expect(imgs.map((i) => i.getAttribute("data-priority"))).toEqual([
      "false",
      "false",
    ]);
  });

  it("does not set priority when priority is false", () => {
    const imgs = [
      ...render("/screens/chains-light.webp", false).querySelectorAll("img"),
    ];
    expect(imgs.map((i) => i.getAttribute("data-priority"))).toEqual([
      "false",
      "false",
    ]);
  });
});
