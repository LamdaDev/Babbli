/**
 * A slim progress bar. With a value (0 to 1) it fills; without one it sweeps, for waits with no known
 * end (e.g. ElevenLabs writing the character's review).
 */
export function ProgressBar({ value, label, onDark = false, className = "" }: { value?: number | null; label: string; onDark?: boolean; className?: string }) {
  const known = typeof value === "number";
  const fill = onDark ? "bg-cream" : "bg-brand";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(value * 100) : undefined}
      className={`relative h-1.5 w-full overflow-hidden rounded-full ${onDark ? "bg-cream/20" : "bg-ink/10"} ${className}`}
    >
      {known ? (
        <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill}`} style={{ width: `${Math.max(4, Math.min(100, value * 100))}%` }} />
      ) : (
        <div className={`progress-sweep absolute inset-y-0 w-1/3 rounded-full ${fill}`} />
      )}
    </div>
  );
}
