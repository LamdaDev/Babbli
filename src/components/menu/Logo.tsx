export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-12 w-12 drop-shadow-[0_6px_14px_rgba(255,138,61,0.45)]" aria-hidden>
        <path d="M32 6c15 0 26 9.6 26 22.5S47 51 32 51c-2.6 0-5.1-.3-7.4-.9L12 57l3.2-11.2C9.5 41.6 6 35.4 6 28.5 6 15.6 17 6 32 6Z" fill="#ff8a3d" />
        {/* symmetric sound bars, centred in the bubble */}
        <path d="M20 25.5v6M26 22.5v12M32 19.5v18M38 22.5v12M44 25.5v6" stroke="#fff7ea" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
      <span className="font-display text-4xl font-semibold tracking-tight text-cream">
        Babbli<span className="text-tangerine">.</span>
      </span>
    </div>
  );
}
