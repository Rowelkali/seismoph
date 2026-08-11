"use client";

import { useState } from "react";
import { apiPost } from "@/hooks/use-seismo-data";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EarthquakeEvent } from "@/lib/types";

interface Props {
  earthquake: EarthquakeEvent;
  userLocation?: { name: string; latitude: number; longitude: number } | null;
  className?: string;
}

interface AiResult {
  explanation: string;
  disclaimer: string;
  grounded: boolean;
}

/** AI-generated explanation grounded in DB values. Labeled + refuses prediction. */
export function AiExplainer({ earthquake, userLocation, className }: Props) {
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const explain = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiPost<{ data: AiResult }>("/api/ai/explain", {
        earthquakeId: earthquake.id,
        question: question.trim() || undefined,
        userLocation: userLocation
          ? {
              name: userLocation.name,
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }
          : undefined,
      });
      setResult(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI explanation unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card/40 p-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        AI Earthquake Explainer
        <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
          Educational
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        Explains magnitude, depth and intensity using this event&apos;s verified data. The AI
        <strong> cannot predict earthquakes</strong> or issue warnings. Always verify with DOST-PHIVOLCS.
      </p>

      <div className="mt-2 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) explain(); }}
          placeholder="Ask about this earthquake… (optional)"
          className="flex-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Optional question for the AI explainer"
        />
        <Button size="sm" onClick={explain} disabled={loading} className="h-8">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Explain
        </Button>
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
            {result.explanation}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
