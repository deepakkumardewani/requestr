"use client";

import { Boarding } from "boarding.js";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";

type Props = {
  onComplete: () => void;
};

export function OnboardingTour({ onComplete }: Props) {
  const router = useRouter();
  const { loadDemoChain } = useCollectionsStore();
  const boardingRef = useRef<Boarding | null>(null);

  useEffect(() => {
    // Ensure a tab is open so url-input and save-button are in the DOM
    const { tabs, openTab } = useTabsStore.getState();
    if (tabs.length === 0) {
      openTab({ type: "http" });
    }

    const boarding = new Boarding({
      animate: true,
      opacity: 0.55,
      padding: 6,
      radius: 6,
      allowClose: true,
      strictClickHandling: false,
      keyboardControl: true,
      overlayColor: "rgb(10 10 15)",
      className: "rq-boarding",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done",
      closeBtnText: "Skip tour",
      onReset: (_el, reason) => {
        onComplete();
        if (reason === "finish") {
          toast.success("You're all set. Press Ctrl+/ to see all shortcuts.");
        }
      },
    });

    boarding.defineSteps([
      {
        element: "[data-slot='url-input']",
        popover: {
          title: "Start here",
          description:
            "Type any URL and press <kbd>Ctrl+Enter</kbd> to fire your first request. Try: <code>https://dummyjson.com/products/1</code>",
          preferredSide: "bottom",
          alignment: "start",
          showButtons: ["next", "close"],
        },
      },
      {
        element: "[data-slot='save-button']",
        popover: {
          title: "Organize your work",
          description:
            "Save this request to a collection to reuse it later. Collections live in the sidebar.",
          preferredSide: "bottom",
          alignment: "start",
          showButtons: ["next", "previous", "close"],
          nextBtnText: "Save it →",
        },
        onNext: () => {
          const saveBtn = document.querySelector<HTMLElement>(
            "[data-slot='save-button']",
          );
          saveBtn?.click();
        },
      },
      {
        element: "[data-slot='chains-section']",
        popover: {
          title: "Now automate it",
          description:
            "Chains let you link requests together — pass data from one response into the next. This is where Requestly goes beyond a simple API client.",
          preferredSide: "right",
          alignment: "start",
          showButtons: ["previous", "close"],
          onPopoverRender: ({ popoverFooter }) => {
            const btn = document.createElement("button");
            btn.className = "boarding-next-btn";
            btn.innerHTML = "Show me →";
            btn.addEventListener("click", () => {
              const collectionId = loadDemoChain();
              boarding.reset();
              router.push(`/chain/${collectionId}`);
            });
            popoverFooter.appendChild(btn);
          },
        },
      },
    ]);

    boardingRef.current = boarding;

    // Wait one frame so React has flushed the new tab render before boarding queries the DOM
    const raf = requestAnimationFrame(() => {
      if (document.querySelector("[data-slot='url-input']")) {
        boarding.start();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      if (boardingRef.current?.isActivated) {
        boardingRef.current.reset(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
