"use client";

import { useEffect, useState } from "react";
import { useSeismo } from "@/lib/store";
import { apiGet, apiPost } from "@/hooks/use-seismo-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState, EmptyState } from "@/components/seismo/States";
import { Bell, Trash2, Plus, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AlertSubscription, GeoLocation } from "@/lib/types";

/** Alert subscription configuration UI. */
export function AlertsPanel({ className }: { className?: string }) {
  const userLocation = useSeismo((s) => s.userLocation);
  const [list, setList] = useState<AlertSubscription[]>([]);
  const [locs, setLocs] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    label: "",
    locationName: "",
    locationId: "",
    radiusKm: 50,
    minMagnitude: 4.0,
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ data: AlertSubscription[] }>("/api/alerts");
      setList(r.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (form.label.trim().length < 2) {
      toast.error("Give your alert a label (2+ characters).");
      return;
    }
    let lat = userLocation?.latitude;
    let lon = userLocation?.longitude;
    let name = form.locationName || userLocation?.name;
    if (form.locationId) {
      const loc = locs.find((l) => l.id === form.locationId);
      if (loc) { lat = loc.latitude; lon = loc.longitude; name = loc.name; }
    }
    try {
      await apiPost("/api/alerts", {
        label: form.label,
        locationName: name,
        latitude: lat,
        longitude: lon,
        radiusKm: form.radiusKm,
        minMagnitude: form.minMagnitude,
        channels: ["BROWSER", "IN_APP"],
        enabled: form.enabled,
      });
      toast.success("Alert created");
      setForm({ label: "", locationName: "", locationId: "", radiusKm: 50, minMagnitude: 4.0, enabled: true });
      load();
    } catch {
      toast.error("Could not create alert");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      setList((l) => l.filter((a) => a.id !== id));
      toast.success("Alert deleted");
    } catch { toast.error("Could not delete"); }
  };

  const toggle = async (a: AlertSubscription) => {
    await fetch(`/api/alerts/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !a.enabled }) });
    load();
  };

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <h2 className="flex items-center gap-1.5 px-1 pb-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <Bell className="h-3.5 w-3.5 text-primary" /> Earthquake alerts
      </h2>

      <div className="glass rounded-lg p-2.5 space-y-2.5">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</Label>
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Home (Quezon City)" className="h-8 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Radius (km)</Label>
            <Select value={String(form.radiusKm)} onValueChange={(v) => setForm({ ...form, radiusKm: Number(v) })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 250, 500].map((k) => <SelectItem key={k} value={String(k)}>{k} km</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Min magnitude</Label>
            <Select value={String(form.minMagnitude)} onValueChange={(v) => setForm({ ...form, minMagnitude: Number(v) })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 3.5, 4, 4.5, 5, 5.5, 6, 7].map((m) => <SelectItem key={m} value={String(m)}>M {m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          {userLocation ? (
            <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> Using: <strong className="text-foreground">{userLocation.name}</strong></span>
          ) : (
            <span>Set a location in the Locations tab, or it defaults to nationwide.</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-xs">Enabled <Switch checked={form.enabled} onCheckedChange={(c) => setForm({ ...form, enabled: c })} /></Label>
          <Button size="sm" onClick={submit} className="h-7"><Plus className="h-3.5 w-3.5" /> Create alert</Button>
        </div>
      </div>

      <ScrollArea className="mt-2 flex-1 scroll-slim pr-2">
        {loading ? (
          <LoadingState label="Loading alerts…" />
        ) : list.length === 0 ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title="No alert subscriptions yet" description="Create one above to receive in-app + browser notifications when a matching earthquake occurs." />
        ) : (
          <ul className="space-y-1.5">
            {list.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-card/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{a.label}</span>
                  <Switch checked={a.enabled} onCheckedChange={() => toggle(a)} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                  {a.locationName && <span className="rounded bg-muted/40 px-1 py-0.5">{a.locationName}</span>}
                  <span>≥ M {a.minMagnitude}</span>
                  <span>· {a.radiusKm} km</span>
                  <span>· {a.channels.join(", ")}</span>
                  <button onClick={() => remove(a.id)} className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive" aria-label="Delete alert">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
