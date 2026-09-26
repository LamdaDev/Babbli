/** Small reusable SVG pieces for the illustrated scenes. */

/** Round computed coordinates so server- and client-rendered SVG match exactly (trig results differ in the last digits). */
export const r2 = (n: number) => Math.round(n * 100) / 100;

export function Steam({ x, y, scale = 1, count = 3, opacity = 0.5 }: { x: number; y: number; scale?: number; count?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => (
        <path
          key={i}
          className="steam"
          style={{ animationDelay: `${i * 1.1}s` }}
          d={`M${i * 22 - 22} 0 C ${i * 22 - 40} -30, ${i * 22 - 2} -50, ${i * 22 - 20} -80 S ${i * 22 - 6} -130, ${i * 22 - 24} -160`}
          stroke="#fff"
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          filter="url(#soft-blur)"
        />
      ))}
    </g>
  );
}

export function SharedDefs() {
  return (
    <defs>
      <filter id="soft-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
      <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
        <stop offset="55%" stopColor="#000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
      </radialGradient>
    </defs>
  );
}

export function Lantern({ x, y, label, color = "#d8352a", len = 60 }: { x: number; y: number; label: string; color?: string; len?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="sway" style={{ transformOrigin: "0px 0px" }}>
        <line x1={0} y1={0} x2={0} y2={len} stroke="#2b1a10" strokeWidth={3} />
        <ellipse cx={0} cy={len + 70} rx={120} ry={120} fill={color} opacity={0.22} filter="url(#glow)" className="flicker" />
        <rect x={-30} y={len - 6} width={60} height={14} rx={4} fill="#1d130c" />
        <ellipse cx={0} cy={len + 70} rx={58} ry={72} fill={color} />
        {[-36, -18, 0, 18, 36].map((dy) => (
          <path key={dy} d={`M-${Math.sqrt(1 - (dy / 72) ** 2) * 58} ${len + 70 + dy} Q0 ${len + 76 + dy} ${Math.sqrt(1 - (dy / 72) ** 2) * 58} ${len + 70 + dy}`} stroke="#9b1f17" strokeWidth={2} fill="none" opacity={0.6} />
        ))}
        <ellipse cx={-18} cy={len + 44} rx={14} ry={26} fill="#fff" opacity={0.18} />
        <rect x={-30} y={len + 134} width={60} height={14} rx={4} fill="#1d130c" />
        <line x1={0} y1={len + 148} x2={0} y2={len + 176} stroke="#1d130c" strokeWidth={4} />
        <text x={0} y={len + 88} textAnchor="middle" fontSize={50} fontWeight={700} fill="#1d130c" style={{ fontFamily: "var(--font-jp)" }}>
          {label}
        </text>
      </g>
    </g>
  );
}

/** Vertical Japanese text laid out one glyph per line (ー rotated to 丨). */
export function VerticalJa({ text, x, y, size, fill, weight = 700 }: { text: string; x: number; y: number; size: number; fill: string; weight?: number }) {
  return (
    <g style={{ fontFamily: "var(--font-jp)" }}>
      {[...text].map((ch, i) => (
        <text key={i} x={x} y={y + i * size * 1.05} textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill}>
          {ch === "ー" ? "丨" : ch}
        </text>
      ))}
    </g>
  );
}

export function Walker({ y, delay, duration, scale = 1, color = "#0f0a14", flip = false }: { y: number; delay: number; duration: number; scale?: number; color?: string; flip?: boolean }) {
  return (
    <g className={flip ? "walk-rev" : "walk"} style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s` }}>
      <g transform={`translate(0 ${y}) scale(${scale})`} fill={color}>
        <circle cx={0} cy={0} r={11} />
        <path d="M-14 14 Q0 8 14 14 L18 70 L-18 70 Z" />
        <rect x={-12} y={68} width={9} height={40} rx={4} className="leg-a" />
        <rect x={3} y={68} width={9} height={40} rx={4} className="leg-b" />
      </g>
    </g>
  );
}
