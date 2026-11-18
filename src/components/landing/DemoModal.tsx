"use client";

import { PlayIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Path without extension, e.g. `/media/relay/relay-full` (`.webm`, `.mp4` must exist). */
  src: string;
  /** Poster image path; defaults to `${src}.webp`. */
  poster?: string;
  /** Optional WebVTT captions track. */
  captionsSrc?: string;
}

/**
 * The dialog content only mounts while open, so the full cut is requested on
 * open (metadata only) and never starts without a click on Play.
 */
export function DemoModal({
  open,
  onOpenChange,
  src,
  poster = `${src}.webp`,
  captionsSrc,
}: DemoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) videoRef.current?.pause();
    onOpenChange(next);
  }

  function handlePlay() {
    // Autoplay policy may still reject; the poster and Play button stay then.
    videoRef.current?.play().catch(() => setStarted(false));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Watch the demo</DialogTitle>
          <DialogDescription>
            The full recording of Relay working in the real app. Waiting steps
            are sped up and marked on screen.
          </DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-lg bg-zinc-950">
          {/* biome-ignore lint/a11y/useMediaCaption: captions track is optional via captionsSrc; the recording has no audio by default */}
          <video
            ref={videoRef}
            className="block h-auto w-full"
            poster={poster}
            aria-label="Requestr demo recording"
            controls={started}
            playsInline
            preload="metadata"
            onPlay={() => setStarted(true)}
            onPause={() => setStarted(false)}
            onEnded={() => setStarted(false)}
          >
            <source src={`${src}.webm`} type="video/webm" />
            <source src={`${src}.mp4`} type="video/mp4" />
            {captionsSrc && (
              <track
                kind="captions"
                src={captionsSrc}
                srcLang="en"
                label="English"
                default
              />
            )}
          </video>
          {!started && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Button type="button" size="lg" onClick={handlePlay}>
                <PlayIcon />
                Play
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
