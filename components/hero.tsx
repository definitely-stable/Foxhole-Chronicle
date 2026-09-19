export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line-soft">
      {/* Cinematic war landscape backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/war-landscape.png)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--color-base) 0%, color-mix(in oklab, var(--color-base) 82%, transparent) 34%, color-mix(in oklab, var(--color-base) 30%, transparent) 62%, color-mix(in oklab, var(--color-base) 55%, transparent) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(0deg, var(--color-base) 2%, transparent 40%)" }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[300px] max-w-[1360px] flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.32em] text-ink-muted">
          Strategic Data Observatory
        </p>
        <h1 className="text-balance text-5xl font-semibold leading-[0.92] tracking-tight text-ink sm:text-6xl md:text-7xl">
          Foxhole
          <br />
          Chronicle
        </h1>
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.16em] text-ink-muted sm:text-base">
          World Conquest, remembered and measured.
        </p>
        <p className="mt-2 text-sm text-ink-faint">
          Historical archive · War analytics · Comparative intelligence
        </p>

        <p className="absolute right-6 top-6 hidden text-right text-[10px] font-medium uppercase leading-tight tracking-[0.18em] text-ink-muted md:block">
          Same wars.
          <br />
          Deeper understanding.
        </p>
      </div>
    </section>
  );
}
