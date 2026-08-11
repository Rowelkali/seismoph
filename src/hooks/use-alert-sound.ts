"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useSeismo } from "@/lib/store";
import { getAlertConfig, MIN_AUDIBLE_MAGNITUDE, type AlertSeverity } from "@/lib/alert-config";

/**
 * SEISMO PH — Emergency alert sound synthesizer (Web Audio API).
 *
 * FIXES from previous version:
 * 1. Proper AudioContext unlocking — tracks `audioReady` state and exposes it
 *    so the UI can show an "Enable sound" prompt when the browser requires
 *    a user gesture. The old `{ once: true }` listener was unreliable.
 * 2. Severity-based volume + pattern — uses EARTHQUAKE_ALERT_CONFIG to play
 *    different sounds for M3/M4/M5/M6/M7+ (beep → double-beep → triple-beep
 *    → siren → emergency).
 * 3. User volume control — multiplies the severity volume by the user's
 *    master volume setting (0.0–1.0).
 * 4. Deduplication — `triggerForEarthquake(id, magnitude)` checks the store's
 *    `triggeredAlarms` Set before playing.
 */

export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const enabled = useSeismo((s) => s.settings.soundEnabled);
  const volume = useSeismo((s) => s.settings.soundVolume);
  const markAlarmTriggered = useSeismo((s) => s.markAlarmTriggered);
  const hasAlarmTriggered = useSeismo((s) => s.hasAlarmTriggered);

  // Lazily create the AudioContext (does NOT unlock it — a user gesture is
  // needed for that). Call `unlockAudio()` from a click handler.
  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!ctxRef.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctor();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  // Unlock audio on the FIRST user interaction. This is required by all modern
  // browsers — audio cannot play without a prior user gesture.
  const unlockAudio = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => setAudioReady(true));
    } else if (ctx.state === "running") {
      setAudioReady(true);
    }
  }, [ensureCtx]);

  // Listen for the first user interaction to unlock audio.
  useEffect(() => {
    if (audioReady) return; // already unlocked
    const handler = () => unlockAudio();
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [audioReady, unlockAudio]);

  // Also check if the context is already running (some browsers allow it).
  // This runs inside unlockAudio (called from user gesture) to avoid
  // setState-in-effect lint errors.

  /** Play a sound based on severity config. */
  const play = useCallback(
    (severity: AlertSeverity | "test") => {
      const ctx = ensureCtx();
      if (!ctx) return;

      // If the context is suspended, try to resume (may fail without gesture).
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const isTest = severity === "test";
      const config = isTest
        ? { volume: 0.25, pattern: "double-beep" as const, cycles: 2, cycleDuration: 0.3, frequency: 880, secondaryFrequency: 740 }
        : getAlertConfig(severity === "informational" ? MIN_AUDIBLE_MAGNITUDE : 
            severity === "minor" ? 3.5 : 
            severity === "moderate" ? 4.5 : 
            severity === "strong" ? 5.5 : 
            severity === "major" ? 6.5 : 7.5);

      // Silent pattern = no sound
      if (config.pattern === "silent" && !isTest) return;

      // Apply user's master volume multiplier
      const effectiveVolume = Math.min(1.0, config.volume * volume);

      const master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc1.connect(master);
      osc2.connect(master);

      const now = ctx.currentTime;
      const cycles = config.cycles || 1;
      const cycleDur = config.cycleDuration || 0.3;
      const totalDur = cycles * cycleDur;
      const gap = config.pattern === "beep" || config.pattern === "double-beep" || config.pattern === "triple-beep" ? cycleDur * 0.4 : 0;

      // Envelope: fade in/out to avoid clicks
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(effectiveVolume, now + 0.03);

      if (config.pattern === "beep" || config.pattern === "double-beep" || config.pattern === "triple-beep") {
        // Discrete beeps with gaps
        for (let i = 0; i < cycles; i++) {
          const t = now + i * (cycleDur + gap);
          // Beep on
          master.gain.setValueAtTime(effectiveVolume, t);
          master.gain.setValueAtTime(effectiveVolume, t + cycleDur - 0.02);
          master.gain.exponentialRampToValueAtTime(0.0001, t + cycleDur);
          // Gap
          if (i < cycles - 1) {
            master.gain.setValueAtTime(0.0001, t + cycleDur);
          }
          osc1.frequency.setValueAtTime(config.frequency, t);
          osc2.frequency.setValueAtTime(config.secondaryFrequency, t);
        }
      } else {
        // Siren / emergency — alternating two-tone
        for (let i = 0; i < cycles; i++) {
          const t = now + i * cycleDur;
          osc1.frequency.setValueAtTime(i % 2 === 0 ? config.frequency : config.secondaryFrequency, t);
          osc2.frequency.setValueAtTime(i % 2 === 0 ? config.frequency * 0.5 : config.secondaryFrequency * 0.5, t);
        }
        master.gain.setValueAtTime(effectiveVolume, now + 0.03);
        master.gain.setValueAtTime(effectiveVolume, now + totalDur - 0.1);
        master.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);
      }

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + totalDur + 0.05);
      osc2.stop(now + totalDur + 0.05);
    },
    [ensureCtx, volume],
  );

  /** Trigger a sound for a specific earthquake. Checks deduplication + enabled. */
  const triggerForEarthquake = useCallback(
    (earthquakeId: string, magnitude: number) => {
      // Check if sound is enabled
      if (!enabled) return;
      // Check if audio context is ready (user has interacted)
      if (!audioReady) return;
      // Deduplicate — don't play for the same earthquake twice
      if (hasAlarmTriggered(earthquakeId)) return;
      // Check minimum magnitude
      if (magnitude < MIN_AUDIBLE_MAGNITUDE) return;

      const severity: AlertSeverity =
        magnitude >= 7.0 ? "great" :
        magnitude >= 6.0 ? "major" :
        magnitude >= 5.0 ? "strong" :
        magnitude >= 4.0 ? "moderate" : "minor";

      play(severity);
      markAlarmTriggered(earthquakeId);
    },
    [enabled, audioReady, hasAlarmTriggered, markAlarmTriggered, play],
  );

  /** Test sound — always plays (used by Settings "Test Alert" button). */
  const test = useCallback(() => {
    // Force unlock on the click event
    unlockAudio();
    setTimeout(() => play("test"), 50);
  }, [unlockAudio, play]);

  return { triggerForEarthquake, test, enabled, audioReady, unlockAudio };
}
