"use client";

// SEISMO PH — AI Caption generator.
// Calls POST /api/ai/caption with one of 5 styles and renders the grounded
// caption + mandatory DOST-PHIVOLCS disclaimer. Copy button lets the user
// paste the caption into a social post.

import { useState } from "react";
import { apiPost } from "@/hooks/use-seismo-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, AlertTriangle, Copy, Check, PenLine } from "lucide-react";
import { toast } from "sonner";
import type { EarthquakeEvent } from "@/lib/types";

interface Props {
  earthquake: EarthquakeEvent;
  className?: string;
}

type CaptionStyle = "informative" | "short" | "taglish" | "formal" | "community";

const STYLES: { id: CaptionStyle; label: string; hint: string }[] = [
  { id: "informative", label: "Informative", hint: "Factual news-style" },
  { id: "short", label: "Short", hint: "One-line punchy" },
  { id: "taglish", label: "Taglish", hint: "Tagalog + English mix" },
  { id: "formal", label: "Formal", hint: "Bulletin register" },
  { id: "community", label: "Community Alert", hint: "Resident-facing" },
];

interface CaptionResult {
  caption: string;
  disclaimer: string;
  style: CaptionStyle;
  grounded: boolean;
}

export function AiCaption({ earthquake, className }: Props) {
  const [style, setStyle] = useState<CaptionStyle>("informative");
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const r = await apiPost<{ data: CaptionResult }>("/api/ai/caption", {
        earthquakeId: earthquake.id,
        style,
      });
      setResult(r.data);
    } catch (e) {
      const err = e as Error & { status?: number; code?: string };
      setError(
        err?.status === 429
          ? "Too many requests — please wait a moment and try again."
          : e instanceof Error
            ? e.message
            : "AI caption unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard?.writeText(result.caption);
      setCopied(true);
      toast.success("Caption copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — please select the text manually.");
    }
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card/40 p-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <PenLine className="h-4 w-4 text-primary" />
        AI Caption
        <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          Social post
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        Drafts a shareable caption grounded in this event&apos;s verified data. The AI
        <strong> cannot predict earthquakes</strong>, invent intensities, or claim official warnings.
      </p>

      {/* Style selector */}
      <div className="mt-2">
        <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Style
        </div>
        <div className="flex flex-wrap gap-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              title={s.hint}
              aria-pressed={style === s.id}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                style === s.id
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={generate} disabled={loading} className="h-8 flex-1">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "Generating caption…" : result ? "Regenerate" : "Generate AI Caption"}
        </Button>
        {result && !loading && (
          <Button size="sm" variant="outline" onClick={copy} className="h-8">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs leading-relaxed whitespace-pre-wrap">
            {result.caption}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {result.disclaimer}
          </p>
          <p className="text-[10px] text-muted-foreground">
            AI-generated. Always verify with DOST-PHIVOLCS before publishing.
          </p>
        </div>
      )}
    </div>
  );
}
