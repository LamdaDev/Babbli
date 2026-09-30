import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * The results page before the session arrives: the page's own shape (header, score tiles, review)
 * as placeholders, so it reads as "your results are coming" rather than a blank screen.
 */
export function ResultsLoading({ label = "Loading your results…" }: { label?: string }) {
  const block = "shimmer rounded-2xl bg-ink/10";
  return (
    <main className="min-h-dvh bg-page pb-20 text-ink" aria-busy="true">
      <div className="bg-navy text-cream">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <div className="text-sm font-bold text-cream/80">← Babbli</div>
          <div className="mt-6 space-y-3">
            <div className="shimmer h-3 w-40 rounded-full bg-cream/20" />
            <div className="shimmer h-9 w-72 max-w-full rounded-xl bg-cream/20" />
            <div className="shimmer h-4 w-96 max-w-full rounded-full bg-cream/15" />
          </div>
          <div className="mt-6 max-w-sm" role="status" aria-live="polite">
            <div className="text-sm font-bold text-cream">{label}</div>
            <ProgressBar label={label} onDark className="mt-2" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-5">
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`${block} h-36`} />
          ))}
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${block} h-28`} />
          ))}
        </div>
        <div className={`${block} mt-10 h-40`} />
      </div>
    </main>
  );
}
