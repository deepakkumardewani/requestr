"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DemoVideo } from "./DemoVideo";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
}

export function DemoModal({ open, onOpenChange, src }: DemoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Watch the demo</DialogTitle>
          <DialogDescription>
            A short recording of the real app running a request chain.
          </DialogDescription>
        </DialogHeader>
        <DemoVideo src={src} label="Requestr demo recording" />
      </DialogContent>
    </Dialog>
  );
}
