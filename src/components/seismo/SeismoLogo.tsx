"use client";

import { cn } from "@/lib/utils";

export function SeismoLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="oklch(0.16 0.01 240)" stroke="oklch(0.82 0.16 75 / 40%)" />
        <circle cx="32" cy="32" r="22" fill="none" stroke="oklch(0.82 0.16 75)" strokeOpacity="0.25" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="oklch(0.82 0.16 75)" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="5" fill="oklch(0.82 0.16 75)" />
        <path d="M8 42 L18 42 L22 32 L28 46 L34 30 L40 42 L56 42" stroke="oklch(0.72 0.13 185)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="font-mono font-semibold tracking-tight leading-none">
        <span className="block text-sm">SEISMO</span>
        <span className="block text-[10px] text-muted-foreground tracking-[0.2em]">PH</span>
      </span>
    </span>
  );
}
