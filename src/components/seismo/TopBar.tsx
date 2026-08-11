"use client";

import { useState } from "react";
import { SeismoLogo } from "./SeismoLogo";
import { StatusIndicator } from "./StatusIndicator";
import { useSeismo } from "@/lib/store";
import { useSources } from "@/hooks/use-seismo-data";
import { useAlertSound } from "@/hooks/use-alert-sound";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Menu, Search, Bell, Settings, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { LeftNav } from "./LeftNav";
import { cn } from "@/lib/utils";
import { timeAgoPHT } from "@/lib/ui";

export function TopBar({ wsConnected, onOpenSearch }: { wsConnected: boolean; onOpenSearch: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSeismo((s) => s.settings);
  const toggleSetting = useSeismo((s) => s.toggleSetting);
  const { data: sources } = useSources();
  const devActive = sources.some((s) => s.name === "DEV-SEED" && s.status === "HEALTHY");

  const phivolcsSource = sources.find((s) => s.name === "DOST-PHIVOLCS");
  const phivolcsState = phivolcsSource?.status === "HEALTHY" ? "live" : phivolcsSource?.status === "DEGRADED" ? "degraded" : phivolcsSource?.status === "DOWN" ? "down" : "unknown";

  const soundEnabled = useSeismo((s) => s.settings.soundEnabled);
  const soundVolume = useSeismo((s) => s.settings.soundVolume);
  const toggleSound = useSeismo((s) => s.setSetting);
  const { test: testSound, audioReady, unlockAudio } = useAlertSound();

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur">
      {/* mobile menu */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-3">
          <SheetHeader>
            <SheetTitle className="text-sm">Navigation</SheetTitle>
          </SheetHeader>
          <LeftNav className="mt-3" />
        </SheetContent>
      </Sheet>

      <SeismoLogo size={30} />

      <div className="ml-1 hidden items-center gap-2 sm:flex">
        <StatusIndicator status={wsConnected ? "live" : "connecting"} label={wsConnected ? "LIVE" : "CONNECTING"} />
        {devActive && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            DEV DATA
          </span>
        )}
        <span className="hidden items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:flex">
          PHIVOLCS:
          <StatusIndicator status={phivolcsState} label={phivolcsState === "live" ? "HEALTHY" : phivolcsState.toUpperCase()} />
          {phivolcsSource?.lastSuccessAt && phivolcsState === "live" && (
            <span className="ml-1 text-[9px] text-muted-foreground/70">
              · {timeAgoPHT(phivolcsSource.lastSuccessAt)}
            </span>
          )}
          {phivolcsState !== "live" && phivolcsSource?.lastSuccessAt && (
            <span className="ml-1 text-[9px] text-amber-400/80">
              · last update {timeAgoPHT(phivolcsSource.lastSuccessAt)}
            </span>
          )}
        </span>
      </div>

      <div className="flex-1" />

      {/* search */}
      <Button variant="outline" size="sm" onClick={onOpenSearch} className="hidden md:inline-flex h-8 max-w-xs flex-1 justify-start text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span className="truncate">Search Philippine cities…</span>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={onOpenSearch} aria-label="Search">
        <Search className="h-5 w-5" />
      </Button>

      {/* ws indicator (mobile) */}
      <span className="md:hidden">
        {wsConnected ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label={soundEnabled ? "Mute alert sound" : "Enable alert sound"}
        title={soundEnabled ? "Alert sound on" : "Alert sound muted"}
        onClick={() => toggleSound("soundEnabled", !soundEnabled)}
      >
        {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
      </Button>

      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Notifications">
        <Bell className="h-4 w-4" />
      </Button>

      {/* settings */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 p-4">
          <SheetHeader>
            <SheetTitle className="text-sm">Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <SettingRow
              label="Data Saver Mode"
              description="Reduce map effects, animations and update frequency for low-bandwidth connections."
              checked={settings.dataSaver}
              onCheckedChange={() => toggleSetting("dataSaver")}
            />
            <SettingRow
              label="Reduced motion"
              description="Disable pulse, ring and blink animations."
              checked={settings.reducedMotion}
              onCheckedChange={() => toggleSetting("reducedMotion")}
            />
            <SettingRow
              label="Highlight latest earthquake"
              description="Show a pulsing highlighted marker for the single newest earthquake on the map."
              checked={settings.highlightLatest}
              onCheckedChange={() => toggleSetting("highlightLatest")}
            />
            {/* Alert sound settings with audio-enable workflow + volume slider */}
            <div className="space-y-2 rounded-md border border-border bg-card/30 p-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Alert sound</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Severity-based alarm: M3+ beep, M5+ siren, M7+ emergency.
                  </p>
                </div>
                <Switch checked={soundEnabled} onCheckedChange={(c) => toggleSound("soundEnabled", c)} aria-label="Alert sound" />
              </div>

              {/* Audio enable prompt — shows when browser requires user interaction */}
              {!audioReady && soundEnabled && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                  <p className="text-[11px] text-amber-400 leading-snug">
                    🔊 Browser requires interaction to enable sound.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-7 w-full text-[11px] border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    onClick={unlockAudio}
                  >
                    Enable earthquake alert sounds
                  </Button>
                </div>
              )}

              {/* Volume slider */}
              {soundEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                    Volume
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(soundVolume * 100)}
                    onChange={(e) => toggleSound("soundVolume", Number(e.target.value) / 100)}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-muted"
                    style={{
                      background: `linear-gradient(to right, var(--primary) ${soundVolume * 100}%, var(--muted) ${soundVolume * 100}%)`,
                    }}
                    aria-label="Alert volume"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-8 text-right">
                    {Math.round(soundVolume * 100)}%
                  </span>
                </div>
              )}

              {/* Test button */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-[11px]"
                onClick={testSound}
              >
                Test Alert
              </Button>
              <p className="text-[10px] text-muted-foreground italic">
                Test sound — no earthquake detected.
              </p>
            </div>
            <SettingRow
              label="Development data banner"
              description="Show the prominent DEV-SEED fixture banner."
              checked={settings.showDevBanner}
              onCheckedChange={() => toggleSetting("showDevBanner")}
            />
            <div className="rounded-md border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
              All times shown in Philippine Standard Time (PHT, UTC+8). Distances are geodesic (haversine).
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function SettingRow({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
