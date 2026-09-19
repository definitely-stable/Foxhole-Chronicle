import { SiteHeader } from "@/components/site-header";
import { ProvenanceBar } from "@/components/provenance-bar";
import { WarHeadline } from "@/components/war-headline";
import { CasualtySummary } from "@/components/casualty-summary";
import { CasualtyTimeline } from "@/components/casualty-timeline";
import { PhaseStrip } from "@/components/phase-strip";
import { RegionalActivity } from "@/components/regional-activity";
import { HistoricalContext } from "@/components/historical-context";
import { RecentChanges } from "@/components/recent-changes";
import { Panel, SectionHeading } from "@/components/ui";

export default function OverviewPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-[1280px] px-5 py-6">
        <div className="flex flex-col gap-6">
          <WarHeadline />

          <ProvenanceBar />

          <CasualtySummary />

          {/* Primary analytical surface: casualty timeline */}
          <Panel className="p-5">
            <SectionHeading
              eyebrow="Primary surface"
              title="Casualty timeline"
              aside={
                <span className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-colonial" aria-hidden />
                    Colonial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-warden" aria-hidden />
                    Warden
                  </span>
                </span>
              }
            />
            <CasualtyTimeline />
          </Panel>

          {/* War phase classification */}
          <Panel className="p-5">
            <SectionHeading
              eyebrow="Deterministic"
              title="War phases"
              aside={<span className="text-xs">metric: war-phases@1</span>}
            />
            <PhaseStrip />
          </Panel>

          {/* Two-up analytical detail */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-5">
              <SectionHeading
                eyebrow="Last 24h"
                title="Regional activity"
                aside={<a href="#" className="text-xs text-ink-muted hover:text-ink">All regions →</a>}
              />
              <RegionalActivity />
            </Panel>

            <Panel className="p-5">
              <SectionHeading
                eyebrow="Archive"
                title="Historical context"
              />
              <HistoricalContext />
            </Panel>
          </div>

          {/* Observed objective changes */}
          <Panel className="p-5">
            <SectionHeading
              eyebrow="Observed · not exact events"
              title="Recent objective changes"
              aside={<span className="text-xs">polling window ±15m</span>}
            />
            <RecentChanges />
          </Panel>

          <footer className="border-t border-line-soft pt-5 pb-8 text-xs text-ink-faint">
            <p className="max-w-2xl text-pretty leading-relaxed">
              Foxhole Chronicle is a public historical and analytical World
              Conquest archive — not a map-first tactical tool. Figures shown are
              observed from periodic polling and normalized into elapsed
              war-clock semantics; they are not exact in-game event times. This
              screen is a design prototype using illustrative data.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
