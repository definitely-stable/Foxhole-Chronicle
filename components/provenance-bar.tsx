import { provenance } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <span className="tnum text-xs text-ink-muted">{value}</span>
    </div>
  );
}

export function ProvenanceBar() {
  const freshOk = provenance.freshnessSeconds < 900;
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[var(--radius-card)] border border-line-soft bg-surface/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 rounded-full",
            freshOk ? "bg-positive live-dot" : "bg-danger"
          )}
          aria-hidden
        />
        <span className="text-xs font-medium text-ink">
          {freshOk ? "Fresh" : "Stale"}
        </span>
        <span className="tnum text-xs text-ink-faint">
          {provenance.freshnessSeconds}s ago
        </span>
      </div>
      <Field label="Source" value={provenance.source} />
      <Field
        label="As of"
        value={new Date(provenance.asOfIso).toUTCString().replace("GMT", "UTC")}
      />
      <Field label="Resolution" value={provenance.resolution} />
      <Field label="Coverage" value={`${(provenance.coverage * 100).toFixed(1)}%`} />
      <Field label="Metric version" value={provenance.metricVersion} />
    </div>
  );
}
