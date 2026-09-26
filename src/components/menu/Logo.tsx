import { useId } from "react";

/** Speech-bubble outlines in the mark's own coordinates (viewBox below). */
const BACK_BUBBLE =
  "M66 16H196C258 16 298 52 298 110C298 176 248 222 160 222C132 222 104 214 86 204C76 199 70 194 65 189L27 207Q18 211 18 202C18 194 26 180 32 170C36 162 35 152 30 142C25 130 22 114 22 96V60C22 34 40 16 66 16Z";
const FRONT_BUBBLE =
  "M186 164C262 164 318 196 318 252V298C318 318 310 330 302 342C302 358 308 372 316 386Q318 392 311 390C292 384 276 376 262 366C240 378 214 382 180 382H70C44 382 24 364 24 338V282C24 214 96 164 186 164Z";

/** The Babbli mark: two chatting speech bubbles — a light one behind, a navy one in front. */
export function LogoMark({ className = "", decorative = false }: { className?: string; decorative?: boolean }) {
  const clip = `babbli-front-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="14 12 308 384" className={className} {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "Babbli" })}>
      <defs>
        <clipPath id={clip}>
          <path d={FRONT_BUBBLE} />
        </clipPath>
      </defs>
      <path d={BACK_BUBBLE} fill="#1b57cb" />
      <path d={FRONT_BUBBLE} fill="#0f3780" />
      {/* where the bubbles overlap, the back one shows through a shade darker */}
      <path d={BACK_BUBBLE} fill="#092b68" clipPath={`url(#${clip})`} />
      <g fill="#fff">
        <ellipse cx="111" cy="103" rx="8" ry="14.5" transform="rotate(-8 111 103)" />
        <ellipse cx="197" cy="91" rx="8" ry="14.5" transform="rotate(-8 197 91)" />
        <path d="M189 288L231 283C232 302 222 316 209 316C197 316 189 305 189 288Z" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M146 125C150 135 170 136 177 120" strokeWidth="9" />
        <path d="M147 279C147 263 175 262 175 279" strokeWidth="8" />
        <path d="M236 267C236 250 262 249 263 265" strokeWidth="8" />
      </g>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-12 w-auto" decorative />
      <span className="font-display text-4xl font-bold tracking-tight text-navy">Babbli</span>
    </div>
  );
}
