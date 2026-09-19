import { NAV } from "@/lib/mock-data";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-base/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-line-soft text-ink-muted transition-colors hover:text-ink"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-px w-4 bg-current" />
            <span className="h-px w-4 bg-current" />
            <span className="h-px w-4 bg-current" />
          </span>
        </button>

        <div className="shrink-0 text-sm font-semibold tracking-[0.18em]">
          <span className="text-ink">FOXHOLE</span>{" "}
          <span className="text-ink-faint">CHRONICLE</span>
        </div>

        <nav className="ml-2 hidden items-center gap-6 lg:flex" aria-label="Primary">
          {NAV.map((item, i) => (
            <a
              key={item}
              href="#"
              className={
                i === 0
                  ? "relative text-sm font-medium text-ink after:absolute after:-bottom-[19px] after:left-0 after:h-[2px] after:w-full after:bg-ink"
                  : "text-sm text-ink-muted transition-colors hover:text-ink"
              }
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <label className="hidden items-center gap-2 rounded-md border border-line-soft bg-surface px-3 py-1.5 text-ink-faint md:flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search wars, regions, objectives…"
              className="w-48 bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint xl:w-64"
            />
          </label>

          <p className="hidden text-right text-[10px] font-medium uppercase leading-tight tracking-[0.14em] text-ink-faint xl:block">
            A more complete history.
            <br />A more informed tomorrow.
          </p>
        </div>
      </div>
    </header>
  );
}
