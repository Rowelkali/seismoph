"use client";

import { cn } from "@/lib/utils";

interface Props {
  status: "live" | "degraded" | "down" | "unknown" | "connecting";
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

const COLOR: Record<Props["status"], string> = {
  live: "var(--sev-light)",
  degraded: "var(--sev-moderate)",
  down: "var(--sev-major)",
  unknown: "var(--muted-foreground)",
  connecting: "var(--sev-moderate)",
};

const LABEL: Record<Props["status"], string> = {
  live: "LIVE",
  degraded: "DEGRADED",
  down: "OFFLINE",
  unknown: "UNKNOWN",
  connecting: "CONNECTING",
};

export function StatusIndicator({ status, label, size = "sm", className }: Props) {
  const color = COLOR[status];
  const pulse = status === "live" || status === "connecting";
  const dot = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider", className)}
      role="status"
      aria-label={`Status: ${label ?? LABEL[status]}`}
    >
      <span className="relative inline-flex">
        <span className={cn("rounded-full", dot)} style={{ background: color }} />
        {pulse && (
          <span
            className={cn("absolute inset-0 rounded-full animate-seismo-pulse", dot)}
            style={{ background: color, opacity: 0.6 }}
            aria-hidden="true"
          />
        )}
      </span>
      <span style={{ color }}>{label ?? LABEL[status]}</span>
    </span>
  );
}
