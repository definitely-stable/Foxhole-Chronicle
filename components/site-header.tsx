import { Hexagon } from "lucide-react";

const NAV = [
  { label: "Overview", active: true },
  { label: "War Analytics" },
  { label: "Daily Chronicle" },
  { label: "Regions" },
  { label: "Compare" },
  { label: "Records" },
  { label: "Archive" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-base/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-5">
        <a href="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-surface-2 text-accent">
            <Hexagon className="size-4" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">
            Foxhole <span className="text-ink-muted">Chronicle</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.label}
              href="#"
              aria-current={item.active ? "page" : undefined}
              className={
                item.active
                  ? "rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink"
                  : "rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-ink-muted sm:flex">
            <span className="live-dot size-1.5 rounded-full bg-positive" aria-hidden />
            Live · War 122
          </span>
          <button className="rounded-md border border-line-soft bg-surface-2 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
            Data &amp; API
          </button>
        </div>
      </div>
    </header>
  );
}
