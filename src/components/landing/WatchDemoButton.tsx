"use client";

import { PlayIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Code-split so neither the dialog nor any video is fetched before a click.
const DemoModal = dynamic(() => import("./DemoModal").then((m) => m.DemoModal));

const DEMO_CLIP = "/intro/clip-1";

export function WatchDemoButton() {
  const [requested, setRequested] = useState(false);
  const [open, setOpen] = useState(false);

  function handleClick() {
    setRequested(true);
    setOpen(true);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={handleClick}>
        <PlayIcon />
        Watch the demo
      </Button>
      {requested && (
        <DemoModal open={open} onOpenChange={setOpen} src={DEMO_CLIP} />
      )}
    </>
  );
}
