"use client";

import { useEffect } from "react";
import { AnimatedContent, BlurText } from "@/components/reactbits";
import { FEATURES } from "./data/features";
import { Footer } from "./Footer";
import { FeaturesGrid } from "./features/FeaturesGrid";
import { Nav } from "./Nav";

export function AllFeaturesPage() {
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Nav />
      <main id="app-main" className="overflow-x-hidden pt-24 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedContent direction="up">
            <div className="mb-10 max-w-2xl">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                <BlurText
                  text="Every tool included."
                  as="span"
                  duration={0.45}
                />{" "}
                <BlurText
                  text="No install required."
                  as="span"
                  className="text-muted-foreground"
                  duration={0.45}
                  delay={0.12}
                />
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                From JSON transforms to visual chains — the complete API
                workflow, right in your browser. No account, ever.
              </p>
            </div>
          </AnimatedContent>

          <AnimatedContent direction="up" delay={0.1}>
            <FeaturesGrid features={FEATURES} />
          </AnimatedContent>
        </div>
      </main>
      <Footer />
    </>
  );
}
