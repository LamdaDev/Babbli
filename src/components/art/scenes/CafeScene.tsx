import { r2, Steam, Walker } from "../shared";
import type { SceneArtProps } from "../types";

function Croissant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-34 6 Q-30 -22 0 -24 Q30 -22 34 6 Q20 -6 0 -6 Q-20 -6 -34 6 Z" fill="#d99a3e" />
      <path d="M-18 -18 L-14 -4 M0 -24 L0 -6 M18 -18 L14 -4" stroke="#a86a22" strokeWidth={3} />
    </g>
  );
}

function PainAuChocolat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-30} y={-16} width={60} height={30} rx={10} fill="#cf8d3a" />
      <rect x={-24} y={-6} width={48} height={6} rx={3} fill="#4a2616" />
      <path d="M-22 -12 Q0 -18 22 -12" stroke="#a86a22" strokeWidth={2} fill="none" />
    </g>
  );
}

function Car({ color, delay, duration, reverse }: { color: string; delay: number; duration: number; reverse?: boolean }) {
  return (
    <g className={reverse ? "drive-rev" : "drive"} style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s` }}>
      <g transform="translate(0 520)">
        <rect x={0} y={-30} width={130} height={32} rx={12} fill={color} />
        <path d="M24 -30 Q40 -58 70 -58 Q96 -58 106 -30 Z" fill={color} />
        <path d="M34 -32 Q46 -52 66 -52 L66 -32 Z M72 -52 Q92 -52 100 -32 L72 -32 Z" fill="#cfe4f2" opacity={0.8} />
        <circle cx={30} cy={2} r={12} fill="#1a1a1a" />
        <circle cx={102} cy={2} r={12} fill="#1a1a1a" />
      </g>
    </g>
  );
}

export function CafeBack({ variant }: SceneArtProps) {
  const croissantOut = !!variant.croissantOut;
  return (
    <g>
      <defs>
        <linearGradient id="c-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcd9ee" />
          <stop offset="1" stopColor="#f6dcc0" />
        </linearGradient>
        <linearGradient id="c-zinc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe3e6" />
          <stop offset="1" stopColor="#8e969c" />
        </linearGradient>
        <linearGradient id="c-chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b9298" />
          <stop offset="0.5" stopColor="#f2f4f5" />
          <stop offset="1" stopColor="#7c848a" />
        </linearGradient>
        <radialGradient id="c-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffe3a3" stopOpacity={0.6} />
          <stop offset="1" stopColor="#ffe3a3" stopOpacity={0} />
        </radialGradient>
        <clipPath id="c-window">
          <rect x={40} y={150} width={460} height={420} />
        </clipPath>
      </defs>

      {/* walls */}
      <rect width={1600} height={900} fill="#efe1c8" />
      {[...Array(40)].map((_, i) => (
        <rect key={i} x={i * 40} y={0} width={14} height={470} fill="#a9b89a" opacity={0.18} />
      ))}
      <rect x={0} y={470} width={1600} height={180} fill="#4a2e22" />
      {[...Array(10)].map((_, i) => (
        <rect key={i} x={20 + i * 160} y={490} width={130} height={110} rx={4} fill="none" stroke="#3a2319" strokeWidth={5} />
      ))}
      <rect x={0} y={462} width={1600} height={10} fill="#6a4332" />

      {/* street window */}
      <g clipPath="url(#c-window)">
        <rect x={40} y={150} width={460} height={420} fill="url(#c-sky)" />
        {/* Haussmann facade */}
        <rect x={40} y={200} width={460} height={330} fill="#eadcc1" />
        <path d="M40 200 L500 200 L480 170 L60 170 Z" fill="#6f7f8f" />
        {[0, 1, 2, 3].map((c) => (
          <rect key={c} x={90 + c * 110} y={150} width={36} height={30} rx={14} fill="#5d6c7c" />
        ))}
        {[0, 1, 2].map((r) =>
          [0, 1, 2, 3].map((c) => (
            <g key={`${r}-${c}`}>
              <rect x={80 + c * 110} y={220 + r * 90} width={50} height={70} rx={4} fill="#3b4b5c" />
              <rect x={80 + c * 110} y={220 + r * 90} width={50} height={70} rx={4} fill="#9fc3dc" opacity={0.35} />
              <rect x={72 + c * 110} y={282 + r * 90} width={66} height={12} fill="none" stroke="#1d1d1d" strokeWidth={3} />
              {[0, 1, 2, 3, 4].map((b) => (
                <line key={b} x1={76 + c * 110 + b * 14} y1={282 + r * 90} x2={76 + c * 110 + b * 14} y2={294 + r * 90} stroke="#1d1d1d" strokeWidth={2} />
              ))}
            </g>
          )),
        )}
        <rect x={40} y={490} width={460} height={80} fill="#9a9087" />
        <rect x={40} y={530} width={460} height={40} fill="#6d655f" />
        <g>
          <circle cx={120} cy={430} r={50} fill="#6c8f4e" />
          <circle cx={150} cy={400} r={40} fill="#7ea45d" />
          <rect x={126} y={440} width={10} height={80} fill="#5a4230" />
        </g>
        <Car color="#c8413b" delay={0} duration={9} />
        <Car color="#2f5f8a" delay={5} duration={11} reverse />
        <Car color="#e6c14b" delay={12} duration={10} />
        <Walker y={452} delay={1} duration={15} color="#2a2530" />
        <Walker y={456} delay={8} duration={13} color="#3b2f2a" scale={0.95} flip />
      </g>
      {/* awning edge + frame */}
      <path d={`M40 150 L500 150 L500 176 ${[...Array(10)].map((_, i) => `Q${477 - i * 46} 196 ${454 - i * 46} 176`).join(" ")} L40 176 Z`} fill="#c8413b" />
      {[...Array(5)].map((_, i) => (
        <rect key={i} x={40 + i * 92} y={150} width={46} height={26} fill="#f7f1e8" />
      ))}
      <rect x={30} y={140} width={480} height={440} rx={4} fill="none" stroke="#1f3b2d" strokeWidth={20} />
      <rect x={264} y={150} width={12} height={420} fill="#1f3b2d" />
      <text x={270} y={380} textAnchor="middle" fontSize={40} fontStyle="italic" fontWeight={700} fill="#d9b04a" opacity={0.85} style={{ fontFamily: "Georgia, serif" }}>
        Café des Lilas
      </text>

      {/* mirror & chalkboard */}
      <rect x={596} y={140} width={420} height={250} rx={12} fill="#c9a24b" />
      <rect x={612} y={156} width={388} height={218} rx={8} fill="#d8e2e2" />
      <path d="M640 170 L700 170 L630 360 L612 360 Z" fill="#fff" opacity={0.45} />
      <rect x={1070} y={130} width={330} height={250} rx={8} fill="#5b3a25" />
      <rect x={1082} y={142} width={306} height={226} rx={4} fill="#233028" />
      <g fill="#f3efe6" style={{ fontFamily: "var(--font-display)" }}>
        <text x={1235} y={182} textAnchor="middle" fontSize={28} fontWeight={700}>
          La Carte
        </text>
        {[
          ["Café", "2,50"],
          ["Café crème", "4,00"],
          ["Cappuccino", "4,50"],
          ["Chocolat chaud", "4,50"],
          ["Croissant", "1,80"],
          ["Pain au chocolat", "2,00"],
        ].map(([n, p], i) => (
          <g key={n}>
            <text x={1100} y={214 + i * 26} fontSize={19}>
              {n}
            </text>
            <text x={1372} y={214 + i * 26} fontSize={19} textAnchor="end">
              {p}
            </text>
          </g>
        ))}
      </g>

      {/* pendant lamps */}
      {[760, 1060, 1340].map((x, i) => (
        <g key={x} className="sway" style={{ transformOrigin: `${x}px 0px`, animationDelay: `${i * 0.7}s` }}>
          <line x1={x} y1={0} x2={x} y2={78} stroke="#2b2b2b" strokeWidth={3} />
          <circle cx={x} cy={110} r={120} fill="url(#c-lamp)" className="flicker" />
          <path d={`M${x - 36} 110 Q${x - 36} 78 ${x} 78 Q${x + 36} 78 ${x + 36} 110 Z`} fill="#1f3b2d" />
          <ellipse cx={x} cy={112} rx={22} ry={10} fill="#fff4cf" />
        </g>
      ))}

      {/* back bar */}
      <rect x={540} y={392} width={1060} height={80} fill="#3a2319" />
      {[...Array(9)].map((_, i) => (
        <g key={i} transform={`translate(${1440 + (i % 3) * 40} ${230 + Math.floor(i / 3) * 56})`}>
          <rect x={-10} y={0} width={20} height={44} rx={5} fill={["#5b7a3a", "#8a2b2b", "#c6a15a"][i % 3]} opacity={0.9} />
          <rect x={-4} y={-12} width={8} height={14} fill="#2a2a2a" />
        </g>
      ))}
      {/* pastry case */}
      <g transform="translate(560 392)">
        <rect x={0} y={0} width={230} height={80} rx={6} fill="#f7f3ea" opacity={0.25} stroke="#d8d2c4" strokeWidth={3} />
        <rect x={10} y={46} width={100} height={8} rx={3} fill="#c9c2b3" />
        <rect x={120} y={46} width={100} height={8} rx={3} fill="#c9c2b3" />
        {!croissantOut && (
          <>
            <Croissant x={36} y={40} s={0.8} />
            <Croissant x={82} y={38} s={0.8} />
          </>
        )}
        {croissantOut && (
          <g transform="translate(60 26) rotate(-6)">
            <rect x={-40} y={-12} width={80} height={24} rx={4} fill="#fffdf6" stroke="#c8413b" strokeWidth={2} />
            <text x={0} y={6} textAnchor="middle" fontSize={15} fontWeight={700} fill="#c8413b" style={{ fontFamily: "Georgia, serif" }}>
              épuisé
            </text>
          </g>
        )}
        <PainAuChocolat x={150} y={36} s={0.75} />
        <PainAuChocolat x={196} y={38} s={0.75} />
      </g>
      {/* espresso machine + barista */}
      <g className="slurp">
        <g transform="translate(1042 334)">
          <circle cx={0} cy={0} r={26} fill="#e2b38f" />
          <path d="M-26 -6 Q0 -40 26 -6 Q0 -16 -26 -6 Z" fill="#2b1d16" />
          <path d="M-44 36 Q0 16 44 36 L52 120 L-52 120 Z" fill="#2b2b33" />
          <rect x={-40} y={64} width={80} height={56} fill="#f3eee4" />
        </g>
      </g>
      <g transform="translate(1110 360)">
        <rect x={0} y={20} width={230} height={100} rx={14} fill="url(#c-chrome)" />
        <rect x={10} y={0} width={210} height={26} rx={8} fill="#c8413b" />
        {[40, 110, 180].map((x) => (
          <g key={x}>
            <rect x={x - 14} y={80} width={28} height={16} rx={4} fill="#2b2b2b" />
            <rect x={x - 3} y={96} width={6} height={12} fill="#555" />
          </g>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={30 + i * 44} y={-14} width={28} height={16} rx={4} fill="#f4f1ea" />
        ))}
        <Steam x={200} y={60} scale={0.6} opacity={0.5} />
      </g>
      {/* zinc bar top */}
      <rect x={540} y={464} width={1060} height={16} fill="url(#c-zinc)" />

      {/* plant */}
      <g transform="translate(1520 640)">
        <rect x={-40} y={-80} width={80} height={90} rx={10} fill="#b86a3f" />
        {[...Array(7)].map((_, i) => (
          <ellipse key={i} cx={r2(Math.cos(i) * 50)} cy={-140 - (i % 3) * 30} rx={34} ry={16} fill="#3f7d4a" transform={`rotate(${i * 50 - 90} ${r2(Math.cos(i) * 50)} ${-140 - (i % 3) * 30})`} />
        ))}
      </g>
    </g>
  );
}

export function CafeFront({ world, slots, flags, timeSkipped }: SceneArtProps) {
  const served = world.includes("served");
  const bill = world.includes("bill_shown");
  const paid = world.includes("payment_done");
  const food = slots.food;
  return (
    <g>
      <defs>
        <radialGradient id="c-marble" cx="45%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dcd7cf" />
        </radialGradient>
      </defs>
      {/* table */}
      <ellipse cx={800} cy={905} rx={640} ry={250} fill="#b9924a" />
      <ellipse cx={800} cy={898} rx={624} ry={238} fill="url(#c-marble)" />
      {[...Array(6)].map((_, i) => (
        <path key={i} d={`M${300 + i * 170} 740 q40 30 20 60 t30 70`} stroke="#b8b1a6" strokeWidth={2} fill="none" opacity={0.5} />
      ))}

      {/* lilac vase */}
      <g transform="translate(1180 740)">
        <path d="M-18 0 Q-24 -40 -8 -60 L8 -60 Q24 -40 18 0 Z" fill="#cfe6ee" opacity={0.75} />
        <path d="M0 -60 Q-6 -110 -24 -140 M0 -60 Q10 -100 22 -130" stroke="#4f7a3e" strokeWidth={4} fill="none" />
        {[...Array(14)].map((_, i) => (
          <circle key={i} cx={-24 + (i % 4) * 6 + (i > 7 ? 44 : 0)} cy={-140 + Math.floor((i % 8) / 2) * 9} r={6} fill={i % 2 ? "#b79ad9" : "#9d7cc9"} />
        ))}
      </g>


      {served && (
        <g transform="translate(820 838)">
          <ellipse cx={0} cy={20} rx={120} ry={34} fill="#f7f5f0" stroke="#d9d3c7" strokeWidth={3} />
          <path d="M-70 -50 L70 -50 L58 16 Q0 34 -58 16 Z" fill="#fbfaf7" stroke="#dcd6cb" strokeWidth={2} />
          <path d="M70 -34 Q110 -30 100 0 Q92 14 62 8" stroke="#f1eee8" strokeWidth={12} fill="none" />
          <ellipse cx={0} cy={-50} rx={70} ry={16} fill={timeSkipped ? "#8a6a4d" : "#c79262"} />
          {!timeSkipped && (
            <>
              <path d="M-26 -52 Q0 -64 26 -52 Q0 -40 -26 -52 Z" fill="#f4e6d1" />
              <Steam x={0} y={-70} scale={0.8} opacity={0.5} />
            </>
          )}
        </g>
      )}
      {served && (food || slots.food2) && (
        <g transform="translate(520 860)">
          <ellipse cx={0} cy={0} rx={110} ry={32} fill="#fbfaf7" stroke="#d9d3c7" strokeWidth={3} />
          {!timeSkipped && (slots.food === "croissant" ? <Croissant x={0} y={-6} s={1.4} /> : <PainAuChocolat x={0} y={-6} s={1.4} />)}
          {timeSkipped && [...Array(6)].map((_, i) => <circle key={i} cx={-40 + i * 16} cy={(i % 2) * 6 - 2} r={3} fill="#d99a3e" />)}
        </g>
      )}
      {flags.water && (
        <g transform="translate(1330 660)">
          <path d="M-22 0 L22 0 L28 110 Q0 124 -28 110 Z" fill="#d8eef6" opacity={0.6} />
          <path d="M-18 40 L18 40 L24 106 Q0 118 -24 106 Z" fill="#a6d6ea" opacity={0.5} />
        </g>
      )}
      {bill && (
        <g transform="translate(250 820) rotate(-8)">
          <ellipse cx={0} cy={0} rx={70} ry={22} fill="#f7f5f0" stroke="#d9d3c7" strokeWidth={2} />
          <rect x={-34} y={-28} width={68} height={40} fill="#fffdf6" stroke="#d9cfb9" transform="rotate(8)" />
          <text x={0} y={-4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2b2b2b" transform="rotate(8)" style={{ fontFamily: "Georgia, serif" }}>
            L&apos;addition
          </text>
          {paid && <circle cx={40} cy={4} r={10} fill="#d9b55c" />}
        </g>
      )}

      {/* bistro chair */}
      <g transform="translate(1480 560)">
        <path d="M0 0 Q60 -20 120 0 L120 360 L100 360 L100 20 Q60 6 20 20 L20 360 L0 360 Z" fill="#3a2319" />
        <path d="M20 60 Q60 44 100 60 M20 110 Q60 94 100 110" stroke="#3a2319" strokeWidth={10} fill="none" />
      </g>
      <rect width={1600} height={900} fill="url(#vignette)" style={{ pointerEvents: "none" }} />
    </g>
  );
}

export const CAFE_NPC = { x: 600, y: 170, scale: 1.02 };
