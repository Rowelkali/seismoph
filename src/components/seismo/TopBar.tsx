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
  const toggleSound = useSeismo((s) => s.setSetting);
  const { test: testSound } = useAlertSound();

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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Alert sound</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  Plays an emergency siren when a significant new earthquake (M4.0+) is detected.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Switch checked={settings.soundEnabled} onCheckedChange={(c) => toggleSound("soundEnabled", c)} aria-label="Alert sound" />
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={testSound}>
                  Test
                </Button>
              </div>
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
