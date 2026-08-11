"use client";

import { Shield, AlertTriangle, Phone, ExternalLink, Hand, Home, Heart } from "lucide-react";
import { IntensityScale } from "@/components/seismo/IntensityScale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SafetyPanel({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="h-5 w-5 text-primary" /> Earthquake safety
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          General preparedness guidance. In an emergency, follow instructions from local authorities
          and official emergency agencies.
        </p>
      </div>
      <ScrollArea className="flex-1 scroll-slim">
        <div className="space-y-4 p-4 max-w-3xl">
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> During an emergency
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">
              This platform is an information visualization service. It does <strong>not</strong> replace
              official government warnings, emergency instructions, or PHIVOLCS advisories. Always follow
              instructions from <strong>DOST-PHIVOLCS</strong>, the <strong>NDRRMC</strong>, and your local
              disaster risk reduction & management office.
            </p>
          </div>

          <Section icon={Hand} title="Drop, Cover, and Hold On">
            <ol className="ml-4 list-decimal space-y-1 text-sm leading-relaxed">
              <li><strong>Drop</strong> to your hands and knees before the earthquake knocks you down.</li>
              <li><strong>Cover</strong> your head and neck (and your whole body if possible) under a sturdy table. If no shelter is nearby, cover your head and neck with your arms against an interior wall.</li>
              <li><strong>Hold on</strong> to your shelter (or your head and neck) until the shaking stops. Be ready to move with your shelter.</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Do not run outside during shaking. Most injuries occur from falling objects, not collapsing buildings.</p>
          </Section>

          <Section icon={Home} title="After the earthquake">
            <ul className="ml-4 list-disc space-y-1 text-sm leading-relaxed">
              <li>Check yourself and others for injuries. Provide first aid if trained.</li>
              <li>Expect aftershocks. Drop, Cover, and Hold On if you feel one.</li>
              <li>Inspect your surroundings for damage, gas leaks, or fire hazards. If you smell gas, shut off the main valve and leave.</li>
              <li>Use flashlights, not candles — broken gas lines can ignite.</li>
              <li>Listen to a battery or hand-crank radio for official information.</li>
              <li>Stay away from damaged buildings, downed power lines, and coastal areas until officials issue an all-clear.</li>
              <li>If near the coast and shaking is strong or long, move to higher ground immediately — a tsunami may follow. Do not wait for an official warning.</li>
            </ul>
          </Section>

          <Section icon={Shield} title="Before — preparedness">
            <ul className="ml-4 list-disc space-y-1 text-sm leading-relaxed">
              <li>Fasten heavy furniture and appliances to walls. Secure hanging objects away from beds.</li>
              <li>Prepare a <strong>go-bag</strong>: water (≥3 litres/person/day), non-perishable food, first-aid kit, medications, flashlight, whistle, spare batteries, important documents (sealed), cash.</li>
              <li>Identify safe spots in each room (under sturdy tables, against interior walls) and dangerous spots (near windows, mirrors, tall furniture).</li>
              <li>Agree on a family meeting point and an out-of-area contact.</li>
              <li>Know your building&apos;s evacuation routes and your community&apos;s designated safe areas.</li>
              <li>Participate in national earthquake drills (e.g. the quarterly Nationwide Simultaneous Earthquake Drill).</li>
            </ul>
          </Section>

          <Section icon={Phone} title="Official information sources">
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li><strong>DOST-PHIVOLCS</strong> — phivolcs.dost.gov.ph — earthquake bulletins, intensity maps, fault data, tsunami information.</li>
              <li><strong>NDRRMC</strong> — ndrrmc.gov.ph — emergency coordination and official advisories.</li>
              <li><strong>PAGASA</strong> — pagasa.dost.gov.ph — weather and tsunami-related information.</li>
              <li>Your <strong>local government / barangay</strong> DRRM office for evacuation orders.</li>
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Always verify safety guidance with these official channels. The information on this page is
              general preparedness guidance and may not reflect the latest official advisory.
            </p>
          </Section>

          <Section icon={Heart} title="Understanding intensity">
            <p className="text-sm leading-relaxed">
              The PHIVOLCS Earthquake Intensity Scale (PEIS) describes how strongly shaking is felt at a
              location. It is <strong>different from magnitude</strong> (the energy at the source).
            </p>
            <IntensityScale className="mt-2" />
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card/30 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}
