"use client";

import { useRef, useCallback, useEffect } from "react";
import { useSeismo } from "@/lib/store";

/**
 * SEISMO PH — emergency alert sound synthesizer (Web Audio API).
 *
 * Generates a two-tone alternating siren reminiscent of public emergency alert
 * systems (EAS-style attention signal). No audio file is bundled — the tone is
 * synthesized on demand, so it works offline and adds zero payload.
 *
 * Sound is opt-in by default for significant events (M4.0+) but can be toggled
 * in Settings. Browsers require a user gesture before audio can play, so the
 * first interaction (any click) unlocks the AudioContext.
 */

type SirenKind = "major" | "minor" | "test";

export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabled = useSeismo((s) => s.settings.soundEnabled);

  // Lazily create / resume the AudioContext (must follow a user gesture).
  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctor();
      }
      if (ctxRef.current.state === "suspended") {
        void ctxRef.current.resume();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  // Unlock on first user interaction (any pointerdown).
  useEffect(() => {
    const unlock = () => { ensureCtx(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensureCtx]);

  /** Play the alert siren. `kind` controls intensity/duration. */
  const play = useCallback((kind: SirenKind = "major") => {
    const ctx = ensureCtx();
    if (!ctx) return;

    // Master gain (envelope) — keeps the tone from clipping and lets us fade out.
    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    // Two oscillators alternating tones (the classic two-tone attention signal).
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc1.connect(master);
    osc2.connect(master);

    const now = ctx.currentTime;

    // Pattern: alternate between two frequencies several times.
    // Major event: 970Hz ↔ 670Hz, 8 cycles over ~2.6s, louder.
    // Minor event: single short 880Hz burst, ~0.5s.
    // Test: full pattern but quieter.
    const cycles = kind === "minor" ? 1 : 6;
    const cycleDur = kind === "minor" ? 0.5 : 0.36;
    const totalDur = cycles * cycleDur;
    const highFreq = 970;
    const lowFreq = 670;

    const peakGain = kind === "test" ? 0.18 : kind === "minor" ? 0.14 : 0.26;

    // Fade in / out envelope.
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(peakGain, now + 0.04);
    master.gain.setValueAtTime(peakGain, now + totalDur - 0.12);
    master.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);

    if (kind === "minor") {
      osc1.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(660, now);
    } else {
      // Alternating two-tone siren.
      for (let i = 0; i < cycles; i++) {
        const t = now + i * cycleDur;
        osc1.frequency.setValueAtTime(i % 2 === 0 ? highFreq : lowFreq, t);
        osc2.frequency.setValueAtTime(i % 2 === 0 ? highFreq * 0.5 : lowFreq * 0.5, t);
      }
    }

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + totalDur + 0.05);
    osc2.stop(now + totalDur + 0.05);
  }, [ensureCtx]);

  /** Public trigger: respects the user's sound-enabled setting. */
  const trigger = useCallback((kind: SirenKind = "major") => {
    if (!enabled && kind !== "test") return;
    play(kind);
  }, [enabled, play]);

  /** Always plays (used by the Settings "Test alert" button). */
  const test = useCallback(() => play("test"), [play]);

  return { trigger, test, enabled };
}
