"use client";

import {
  AnimatedContent,
  Masonry,
  type MasonryItem,
} from "@/components/reactbits";

const SHOTS: MasonryItem[] = [
  {
    id: "response-viewer",
    img: "/screenshots/04-response-viewer.png",
    alt: "Sending a GET request and inspecting the formatted JSON response",
    width: 1280,
    height: 577,
  },
  {
    id: "multi-tab",
    img: "/screenshots/05-multi-tab.png",
    alt: "Multiple requests open across tabs in the workspace",
    width: 1280,
    height: 577,
  },
  {
    id: "import",
    img: "/screenshots/03-import.png",
    alt: "Importing collections from Postman, Insomnia, and cURL",
    width: 1280,
    height: 577,
  },
  {
    id: "collections",
    img: "/screenshots/01-collections.png",
    alt: "Organizing requests in the collections sidebar",
    width: 1280,
    height: 577,
  },
  {
    id: "workspace",
    img: "/screenshots/02-workspace.png",
    alt: "The Requestr workspace start screen with keyboard shortcuts",
    width: 1280,
    height: 577,
  },
];

export function ScreenshotGallery() {
  return (
    <section id="gallery" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
              A look inside
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built for real API work.
            </h2>
          </div>
        </AnimatedContent>

        <Masonry items={SHOTS} />
      </div>
    </section>
  );
}
