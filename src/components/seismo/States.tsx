"use client";

import { cn } from "@/lib/utils";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 p-8 text-center", className)}>
      {icon && <div className="text-muted-foreground/70">{icon}</div>}
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = "Couldn't load data", description, onRetry, className }: { title?: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center", className)}>
      <p className="font-medium text-destructive">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/40">
          Retry
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground", className)}>
      <span className="h-3 w-3 animate-seismo-blink rounded-full bg-primary" aria-hidden="true" />
      {label}
    </div>
  );
}
