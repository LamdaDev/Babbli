import { badgeDef, type BadgeId, type PinGlyph } from "@/lib/profile/badges";

/** Five-point star, outer radius 10. */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 4.4 : 10.5;
  const a = (i * Math.PI) / 5 - Math.PI / 2;
  return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
}).join(" L");

/** Pin artwork drawn in a ±11 box around 0,0. */
function Glyph({ glyph, fg, bg }: { glyph: PinGlyph; fg: string; bg: string }) {
  const line = { stroke: fg, strokeLinecap: "round" as const, fill: "none" };
  switch (glyph) {
    case "plane":
      return (
        <>
          <path d="M-11 0 L11 -9 L4 10 L-1 3 Z" fill={fg} />
          <path d="M-1 3 L11 -9" stroke={bg} strokeWidth={1.6} />
        </>
      );
    case "bag":
      return (
        <>
          <path d="M-4.5 -3 Q-4.5 -10 0 -10 Q4.5 -10 4.5 -3" {...line} strokeWidth={2.2} />
          <rect x={-9} y={-4} width={18} height={14} rx={2.5} fill={fg} />
        </>
      );
    case "ramen":
      return (
        <>
          <path d="M-5 -5 q-2 -3 0 -6 M0 -5 q-2 -3 0 -6" {...line} strokeWidth={1.5} />
          <path d="M1 -2 L10 -10 M4 -2 L11 -7" {...line} strokeWidth={1.8} />
          <path d="M-11 -1 L11 -1 Q10 9 0 9 Q-10 9 -11 -1 Z" fill={fg} />
        </>
      );
    case "cup":
      return (
        <>
          <path d="M-5 -7 q-2 -2.5 0 -5 M0 -7 q-2 -2.5 0 -5" {...line} strokeWidth={1.4} />
          <path d="M5 -2 Q11 -2 10 2 Q9 5 4 4" {...line} strokeWidth={2} />
          <path d="M-8 -4 L6 -4 L5 5 Q4 8 -1 8 Q-6 8 -7 5 Z" fill={fg} />
          <path d="M-10 10.5 L8 10.5" {...line} strokeWidth={2} />
        </>
      );
    case "key":
      return (
        <>
          <circle cx={-5} cy={0} r={5} {...line} strokeWidth={2.8} />
          <path d="M0 0 L11 0 M7.5 0 L7.5 4.5 M10.5 0 L10.5 3.5" {...line} strokeWidth={2.8} />
        </>
      );
    case "boba":
      // A clear cup of milk tea (the pin's own colour) with a dome lid, a fat straw and dark pearls at the bottom.
      return (
        <>
          <path d="M1.5 -8 L5 -12.5" {...line} strokeWidth={2.8} />
          <path d="M-8 -5 Q0 -12.5 8 -5 Z" fill={fg} />
          <path d="M-7.5 -3.5 L7.5 -3.5 L5.8 10 L-5.8 10 Z" fill="none" stroke={fg} strokeWidth={1.8} strokeLinejoin="round" />
          {[
            [-3.2, 7.6],
            [0, 7.6],
            [3.2, 7.6],
            [-1.6, 4.8],
            [1.6, 4.8],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} fill={fg} />
          ))}
        </>
      );
    case "star":
      return <path d={`M${STAR} Z`} fill={fg} />;
    case "globe":
      return (
        <>
          <circle r={9.5} {...line} strokeWidth={2} />
          <ellipse rx={4} ry={9.5} {...line} strokeWidth={1.6} />
          <path d="M-9.5 0 L9.5 0 M-8 -5 L8 -5 M-8 5 L8 5" {...line} strokeWidth={1.4} />
        </>
      );
    case "wave":
      return <path d="M-11 -3 q2.75 -4 5.5 0 t5.5 0 t5.5 0 t5.5 0 M-11 4 q2.75 -4 5.5 0 t5.5 0 t5.5 0 t5.5 0" {...line} strokeWidth={2.4} />;
  }
}

/** An enamel pin (SVG group centred on 0,0) — for the avatar's outfit. */
export function PinMark({ id, r = 16 }: { id: BadgeId; r?: number }) {
  const b = badgeDef(id);
  return (
    <g>
      <circle r={r} fill={b.bg} stroke="#fff" strokeWidth={r * 0.14} />
      <g transform={`scale(${(r / 15).toFixed(3)})`}>
        <Glyph glyph={b.glyph} fg={b.fg} bg={b.bg} />
      </g>
    </g>
  );
}

/** A standalone pin icon; locked pins are drawn flat grey. */
export function Pin({ id, size = 40, locked = false, className = "" }: { id: BadgeId; size?: number; locked?: boolean; className?: string }) {
  const b = badgeDef(id);
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden>
      {locked ? (
        <>
          <circle r={17} fill="#e6ebf3" stroke="#fff" strokeWidth={2.4} />
          <g opacity={0.45}>
            <Glyph glyph={b.glyph} fg="#8a96ab" bg="#e6ebf3" />
          </g>
        </>
      ) : (
        <>
          <circle r={18.5} fill="#000" opacity={0.08} cy={1.5} />
          <PinMark id={id} r={17} />
        </>
      )}
    </svg>
  );
}
