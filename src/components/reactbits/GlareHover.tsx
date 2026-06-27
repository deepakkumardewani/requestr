"use client";

import { useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface GlareHoverProps {
  children: React.ReactNode;
  className?: string;
  glareColor?: string;
  glareOpacity?: number;
}

export function GlareHover({
  children,
  className,
  glareColor = "rgba(255,255,255,0.12)",
  glareOpacity = 1,
}: GlareHoverProps) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const card = cardRef.current;
    const glare = glareRef.current;
    if (!card || !glare) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    glare.style.background = `radial-gradient(circle at ${x}% ${y}%, ${glareColor} 0%, transparent 60%)`;
    glare.style.opacity = String(glareOpacity);
  }

  function handleMouseLeave() {
    const glare = glareRef.current;
    if (glare) glare.style.opacity = "0";
  }

  return (
    <div
      ref={cardRef}
      className={cn("relative overflow-hidden", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div
        ref={glareRef}
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
        aria-hidden
      />
    </div>
  );
}
