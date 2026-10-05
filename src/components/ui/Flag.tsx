/** SVG flags — emoji flags don't render on Windows. */
export function Flag({ code, className = "h-[0.9em] w-[1.35em]" }: { code: string; className?: string }) {
  const common = { viewBox: "0 0 30 20", className: `inline-block shrink-0 rounded-[3px] align-[-0.1em] shadow-sm ${className}`, "aria-hidden": true } as const;
  if (code === "en")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
          <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
        ))}
        <rect width="13" height={(20 / 13) * 7} fill="#3c3b6e" />
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={2 + c * 3} cy={2 + r * 3.4} r={0.6} fill="#fff" />))}
      </svg>
    );
  if (code === "ja")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#fff" />
        <circle cx="15" cy="10" r="6" fill="#bc002d" />
      </svg>
    );
  if (code === "fr")
    return (
      <svg {...common}>
        <rect width="10" height="20" fill="#0055a4" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#ef4135" />
      </svg>
    );
  if (code === "es")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#aa151b" />
        <rect y="5" width="30" height="10" fill="#f1bf00" />
      </svg>
    );
  if (code === "zh")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#ee1c25" />
        <path d={star(5, 5, 3, -90)} fill="#ffff00" />
        {/* the four small stars each point at the big one */}
        {[
          [10, 2],
          [12, 4],
          [12, 7],
          [10, 9],
        ].map(([x, y]) => (
          <path key={`${x}-${y}`} d={star(x, y, 1, (Math.atan2(5 - y, 5 - x) * 180) / Math.PI)} fill="#ffff00" />
        ))}
      </svg>
    );
  if (code === "ko")
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#fff" />
        {/* the taegeuk: red above, blue below, divided along the diagonal from the top-left corner */}
        <g transform="translate(15 10) rotate(33.69)">
          <circle r="5" fill="#0047a0" />
          <path d="M-5 0A5 5 0 0 1 5 0A2.5 2.5 0 0 0 0 0A2.5 2.5 0 0 1-5 0Z" fill="#cd2e3a" />
        </g>
        {/* the trigrams on the diagonals (a solid bar is true, from the centre out): ☰ top-left, ☵ top-right, ☷ bottom-right, ☲ bottom-left */}
        {TRIGRAMS.map(([angle, bars]) => (
          <g key={angle} transform={`translate(15 10) rotate(${angle})`} fill="#000">
            {bars.map((solid, i) =>
              solid ? (
                <rect key={i} x={BAR_AT[i]} y={-2.5} width={0.85} height={5} />
              ) : (
                <path key={i} d={`M${BAR_AT[i]} -2.5h0.85v2.2h-0.85zM${BAR_AT[i]} 0.3h0.85v2.2h-0.85z`} />
              ),
            )}
          </g>
        ))}
      </svg>
    );
  return null;
}

/** The Korean flag's trigrams: the angle towards their corner, and which bars are solid (from the centre out). */
const TRIGRAMS = [
  [-146.31, [true, true, true]],
  [-33.69, [false, true, false]],
  [33.69, [false, false, false]],
  [146.31, [true, false, true]],
] as const;
const BAR_AT = [8.3, 9.55, 10.8];

/** A five-point star centred at x,y with its first point towards `angle` degrees (rounded so server and client match). */
function star(x: number, y: number, r: number, angle: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = ((angle + i * 36) * Math.PI) / 180;
    const d = i % 2 ? r * 0.382 : r;
    return `${Math.round((x + Math.cos(a) * d) * 100) / 100} ${Math.round((y + Math.sin(a) * d) * 100) / 100}`;
  });
  return `M${points.join(" L")} Z`;
}
