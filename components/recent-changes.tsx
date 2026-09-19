import { recentChanges } from "@/lib/mock-data";
import { FactionDot } from "@/components/ui";
import { ArrowRight } from "lucide-react";

export function RecentChanges() {
  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {recentChanges.map((c) => (
        <li key={c.objective} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-ink">{c.objective}</div>
            <div className="text-xs text-ink-faint">{c.region}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <FactionDot faction={c.from} />
            <ArrowRight className="size-3 text-ink-faint" />
            <FactionDot faction={c.to} />
          </div>
          <div className="w-16 shrink-0 text-right text-xs text-ink-faint">
            {c.window}
          </div>
        </li>
      ))}
    </ul>
  );
}
