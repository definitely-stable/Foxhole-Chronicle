import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line-soft bg-surface",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-balance text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      {aside ? <div className="shrink-0 text-sm text-ink-muted">{aside}</div> : null}
    </div>
  );
}

export function FactionDot({
  faction,
  className,
}: {
  faction: "colonial" | "warden" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        faction === "colonial" && "bg-colonial",
        faction === "warden" && "bg-warden",
        faction === "neutral" && "bg-ink-faint",
        className
      )}
      aria-hidden
    />
  );
}

export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-2 px-2.5 py-1 text-xs text-ink-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
