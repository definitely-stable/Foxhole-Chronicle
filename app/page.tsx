import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { StatusBar } from "@/components/status-bar";
import { WarArchiveRail } from "@/components/war-archive-rail";
import { WarTimeline } from "@/components/war-timeline";
import { RecentWarDays } from "@/components/recent-war-days";
import { WarUnusualness } from "@/components/war-unusualness";
import { Panel } from "@/components/ui";

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">{children}</h2>
      {aside ? <div className="shrink-0 text-[11px] text-ink-muted">{aside}</div> : null}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <Hero />
      <StatusBar />

      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4">
          {/* Archive rail + primary timeline surface */}
          <div className="grid gap-4 lg:grid-cols-[236px_1fr]">
            <WarArchiveRail />
            <Panel className="min-w-0 p-5">
              <PanelTitle>War Timeline</PanelTitle>
              <WarTimeline />
            </Panel>
          </div>

          {/* Recent days + comparative intelligence */}
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Panel className="p-5">
              <PanelTitle
                aside={
                  <a href="#" className="transition-colors hover:text-ink">
                    View all days →
                  </a>
                }
              >
                Recent War Days
              </PanelTitle>
              <RecentWarDays />
            </Panel>

            <Panel className="p-5">
              <PanelTitle aside={<span className="text-ink-faint">Compared at Day 23</span>}>
                How Unusual Is This War?
              </PanelTitle>
              <WarUnusualness />
            </Panel>
          </div>

          <footer className="border-t border-line-soft pt-5 pb-10 text-[11px] text-ink-faint">
            <p className="max-w-3xl text-pretty leading-relaxed">
              Foxhole Chronicle is a public historical and analytical World Conquest archive — not a map-first tactical tool. Figures
              are observed from periodic polling and normalized into elapsed war-clock semantics; they are not exact in-game event
              times. This screen is a design prototype using illustrative data.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
