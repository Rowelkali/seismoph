"use client";

import { cn } from "@/lib/utils";
import { useSeismo, type AppView } from "@/lib/store";
import {
  Activity, Radio, History, BarChart3, MapPin, Bell, Shield, Info,
} from "lucide-react";

const NAV: { view: AppView; label: string; icon: React.ElementType }[] = [
  { view: "live", label: "Live", icon: Radio },
  { view: "earthquakes", label: "Earthquakes", icon: Activity },
  { view: "history", label: "History", icon: History },
  { view: "analytics", label: "Analytics", icon: BarChart3 },
  { view: "locations", label: "Locations", icon: MapPin },
  { view: "alerts", label: "Alerts", icon: Bell },
  { view: "safety", label: "Safety", icon: Shield },
  { view: "about", label: "About", icon: Info },
];

/** Desktop vertical nav. */
export function LeftNav({ className }: { className?: string }) {
  const view = useSeismo((s) => s.view);
  const setView = useSeismo((s) => s.setView);
  return (
    <nav className={cn("space-y-0.5", className)} aria-label="Primary">
      {NAV.map(({ view: v, label, icon: Icon }) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-primary/15 text-foreground border border-primary/40"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground border border-transparent",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}

/** Mobile bottom nav (subset of views; the rest reachable via "More"). */
export function MobileNav({ className }: { className?: string }) {
  const view = useSeismo((s) => s.view);
  const setView = useSeismo((s) => s.setView);
  const items = NAV.slice(0, 5);
  return (
    <nav
      className={cn("grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur", className)}
      aria-label="Primary mobile"
    >
      {items.map(({ view: v, label, icon: Icon }) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export { NAV };
