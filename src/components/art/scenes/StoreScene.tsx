import type { SceneArtProps } from "../types";

const SCARF_COLORS: Record<string, string> = {
  navy: "#1f2d52",
  charcoal: "#3d4046",
  burgundy: "#6e1f2e",
  camel: "#c49a6c",
};

function ScarfStack({ x, y, color, soldOut = false }: { x: number; y: number; color: string; soldOut?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {soldOut ? (
        <g transform="rotate(-8 40 40)">
          <rect x={4} y={30} width={76} height={24} rx={3} fill="#c0392b" />
          <text x={42} y={47} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff" letterSpacing={1}>
            SOLD OUT
          </text>
        </g>
      ) : (
        [0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${(i % 2) * 3} ${60 - i * 15})`}>
            <rect x={0} y={0} width={80} height={16} rx={5} fill={color} />
            <rect x={0} y={0} width={80} height={5} rx={3} fill="#fff" opacity={0.12} />
            {[...Array(6)].map((_, k) => (
              <line key={k} x1={82 + 0} y1={3 + k * 2} x2={88} y2={4 + k * 2} stroke={color} strokeWidth={1.5} />
            ))}
          </g>
        ))
      )}
    </g>
  );
}

function Handbag({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M14 18 Q40 -14 66 18" stroke={color} strokeWidth={5} fill="none" />
      <path d="M4 20 L76 20 L70 64 Q40 70 10 64 Z" fill={color} />
      <rect x={34} y={26} width={12} height={8} rx={2} fill="#e9cf87" />
    </g>
  );
}

export function StoreBack({ variant }: SceneArtProps) {
  return (
    <g>
      <defs>
        <linearGradient id="s-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8f1e5" />
          <stop offset="1" stopColor="#e8dac3" />
        </linearGradient>
        <linearGradient id="s-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a8822f" />
          <stop offset="0.5" stopColor="#f0d58a" />
          <stop offset="1" stopColor="#a8822f" />
        </linearGradient>
        <linearGradient id="s-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4a33" />
          <stop offset="1" stopColor="#4a3122" />
        </linearGradient>
        <radialGradient id="s-glow" cx="50%" cy="20%" r="60%">
          <stop offset="0" stopColor="#fff2cf" stopOpacity={0.55} />
          <stop offset="1" stopColor="#fff2cf" stopOpacity={0} />
        </radialGradient>
      </defs>

      <rect width={1600} height={900} fill="url(#s-wall)" />

      {/* ceiling with recessed lights */}
      <rect x={0} y={0} width={1600} height={58} fill="#fbf6ec" />
      {[...Array(12)].map((_, i) => (
        <g key={i}>
          <ellipse cx={70 + i * 134} cy={30} rx={20} ry={6} fill="#fff6d8" />
          <ellipse cx={70 + i * 134} cy={40} rx={46} ry={22} fill="#fff6d8" opacity={0.25} filter="url(#glow)" />
        </g>
      ))}

      {/* mezzanine balcony */}
      <rect x={0} y={58} width={1600} height={80} fill="#efe4d2" />
      {[...Array(9)].map((_, i) => (
        <g key={i} transform={`translate(${60 + i * 180} 72)`}>
          <rect x={0} y={20} width={120} height={8} fill="#cdbba0" />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={8 + k * 28} y={-4} width={20} height={24} rx={3} fill={["#4b5d7a", "#b8604a", "#e3cfa6", "#5f7d5a"][(i + k) % 4]} opacity={0.8} />
          ))}
        </g>
      ))}
      {[...Array(54)].map((_, i) => (
        <rect key={i} x={i * 30} y={108} width={6} height={30} fill="#fbf8f2" />
      ))}
      <rect x={0} y={104} width={1600} height={6} fill="url(#s-gold)" />
      <rect x={0} y={138} width={1600} height={20} fill="url(#s-wood)" />
      <rect x={0} y={156} width={1600} height={4} fill="url(#s-gold)" />

      {/* chandelier */}
      <g className="sway" style={{ transformOrigin: "800px 0px" }}>
        <line x1={800} y1={0} x2={800} y2={40} stroke="#a8822f" strokeWidth={3} />
        <ellipse cx={800} cy={70} rx={120} ry={60} fill="#fff1c4" opacity={0.3} filter="url(#glow)" className="flicker" />
        <ellipse cx={800} cy={52} rx={70} ry={12} fill="none" stroke="url(#s-gold)" strokeWidth={5} />
        <ellipse cx={800} cy={74} rx={44} ry={9} fill="none" stroke="url(#s-gold)" strokeWidth={5} />
        {[-60, -30, 0, 30, 60].map((dx) => (
          <circle key={dx} cx={800 + dx} cy={52 + Math.abs(dx) / 12} r={6} fill="#fff7d6" />
        ))}
        {[-28, 0, 28].map((dx) => (
          <path key={dx} d={`M${800 + dx} 80 l-5 14 l5 8 l5 -8 Z`} fill="#dff0f5" opacity={0.9} />
        ))}
      </g>

      {/* escalator (left) */}
      <g>
        <path d="M-40 640 L330 160 L400 160 L30 640 Z" fill="#6b7078" />
        <path
          className="escalator"
          d="M-5 640 L365 160"
          stroke="#8e939b"
          strokeWidth={60}
          strokeDasharray="4 16"
          fill="none"
          opacity={0.9}
        />
        <path d="M-60 610 L320 120 L336 132 L-44 626 Z" fill="#cfe6ee" opacity={0.45} />
        <path d="M-60 604 L322 114" stroke="#1d1d1f" strokeWidth={8} strokeLinecap="round" />
        <path d="M30 640 L400 160 L416 172 L50 650 Z" fill="#b9bec5" />
      </g>

      {/* ACCESSORIES sign */}
      <g style={{ fontFamily: "Georgia, serif" }}>
        <text x={800} y={198} textAnchor="middle" fontSize={40} letterSpacing={14} fontWeight={700} fill="#a8822f">
          ACCESSORIES
        </text>
        <text x={800} y={219} textAnchor="middle" fontSize={13} letterSpacing={5} fill="#8a6a2e">
          WHITMORE&apos;S · FIFTH AVENUE · EST. 1921
        </text>
      </g>

      {/* backdrop panel behind the counter */}
      <rect x={640} y={250} width={320} height={370} rx={10} fill="#2f4f4c" />
      <rect x={656} y={266} width={288} height={338} rx={6} fill="none" stroke="url(#s-gold)" strokeWidth={3} />
      <circle cx={800} cy={400} r={110} fill="none" stroke="url(#s-gold)" strokeWidth={2} opacity={0.6} />

      {/* scarf shelving (left) */}
      <g>
        <rect x={430} y={250} width={210} height={370} rx={6} fill="url(#s-wood)" />
        {[0, 1, 2].map((r) =>
          [0, 1].map((c) => <rect key={`${r}-${c}`} x={442 + c * 100} y={262 + r * 116} width={88} height={104} rx={3} fill="#f3eadb" />),
        )}
        <ScarfStack x={446} y={284} color={SCARF_COLORS.navy} soldOut={!!variant.navyOut} />
        <ScarfStack x={546} y={284} color={SCARF_COLORS.charcoal} />
        <ScarfStack x={446} y={400} color={SCARF_COLORS.burgundy} />
        <ScarfStack x={546} y={400} color={SCARF_COLORS.camel} />
        {/* hats on the bottom row */}
        {[0, 1].map((c) => (
          <g key={c} transform={`translate(${486 + c * 100} ${580})`}>
            <ellipse cx={0} cy={0} rx={38} ry={8} fill={c ? "#6b4a33" : "#2f3033"} />
            <path d="M-22 0 Q-22 -34 0 -36 Q22 -34 22 0 Z" fill={c ? "#6b4a33" : "#2f3033"} />
            <rect x={-22} y={-10} width={44} height={6} fill="#c0392b" />
          </g>
        ))}
        <g transform="translate(470 226)">
          <rect x={0} y={0} width={150} height={24} rx={4} fill="#fbf8f2" stroke="#d9c7a0" />
          <text x={75} y={17} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2a1d14">
            Merino scarves · $45
          </text>
        </g>
      </g>

      {/* handbag shelving (right) */}
      <g>
        <rect x={960} y={250} width={210} height={370} rx={6} fill="url(#s-wood)" />
        {[0, 1, 2].map((r) => (
          <rect key={r} x={972} y={262 + r * 116} width={186} height={104} rx={3} fill="#f3eadb" />
        ))}
        <Handbag x={984} y={290} color="#8a4b2d" />
        <Handbag x={1072} y={290} color="#1f1f22" />
        <Handbag x={984} y={406} color="#b8261d" />
        <Handbag x={1072} y={406} color="#c9a36b" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${994 + i * 42} 560)`}>
            <path d="M0 0 Q-6 -30 6 -34 L18 -34 Q26 -26 22 0 Z" fill={["#3b2a22", "#6e1f2e", "#1f2d52", "#c49a6c"][i]} />
          </g>
        ))}
      </g>

      {/* sale banner + directory (right) */}
      <g className="sway" style={{ transformOrigin: "1360px 160px", animationDuration: "7s" }}>
        <line x1={1250} y1={160} x2={1250} y2={180} stroke="#6b4a33" strokeWidth={3} />
        <line x1={1470} y1={160} x2={1470} y2={180} stroke="#6b4a33" strokeWidth={3} />
        <rect x={1230} y={178} width={260} height={150} rx={4} fill="#b8261d" />
        <text x={1360} y={222} textAnchor="middle" fontSize={26} fontWeight={800} letterSpacing={4} fill="#fbf1dc" style={{ fontFamily: "Georgia, serif" }}>
          FALL SALE
        </text>
        <text x={1360} y={266} textAnchor="middle" fontSize={34} fontWeight={900} fill="#fff">
          UP TO 40% OFF
        </text>
        <text x={1360} y={304} textAnchor="middle" fontSize={15} letterSpacing={3} fill="#fbe3c4">
          3RD FLOOR · OUTERWEAR
        </text>
      </g>
      <g transform="translate(1250 338)">
        <rect x={60} y={200} width={12} height={40} fill="#2b2b2b" />
        <rect x={0} y={0} width={132} height={200} rx={6} fill="#23201d" />
        <text x={66} y={26} textAnchor="middle" fontSize={12} letterSpacing={2} fill="#e8cf8a" fontWeight={700}>
          DIRECTORY
        </text>
        {[
          ["4", "Home & Kitchen"],
          ["3", "Men's · Sale"],
          ["2", "Women's"],
          ["1", "Accessories"],
          ["1", "Beauty"],
        ].map(([f, n], i) => (
          <g key={n}>
            <circle cx={18} cy={52 + i * 30} r={9} fill="#e8cf8a" />
            <text x={18} y={56 + i * 30} textAnchor="middle" fontSize={11} fontWeight={800} fill="#23201d">
              {f}
            </text>
            <text x={34} y={56 + i * 30} fontSize={12} fill="#f3eadb">
              {n}
            </text>
          </g>
        ))}
      </g>

      {/* plant */}
      <g transform="translate(1520 640)">
        <rect x={-46} y={-80} width={92} height={90} rx={10} fill="#e8e1d4" stroke="#cfc4b0" />
        {[...Array(9)].map((_, i) => (
          <ellipse
            key={i}
            cx={((i % 3) - 1) * 34}
            cy={-150 - Math.floor(i / 3) * 70}
            rx={30}
            ry={22}
            fill={i % 2 ? "#3f7d4a" : "#4d9a5b"}
            transform={`rotate(${(i % 3) * 40 - 40} ${((i % 3) - 1) * 34} ${-150 - Math.floor(i / 3) * 70})`}
          />
        ))}
        <rect x={-4} y={-320} width={8} height={240} fill="#6b4a33" />
      </g>

      <rect width={1600} height={640} fill="url(#s-glow)" />
    </g>
  );
}

export function StoreFront({ world, slots }: SceneArtProps) {
  const shown = world.includes("item_shown");
  const wrapped = world.includes("gift_wrapped");
  const paid = world.includes("payment_done");
  const scarf = SCARF_COLORS[slots.color] ?? SCARF_COLORS.navy;
  return (
    <g>
      <defs>
        <linearGradient id="s-case" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26304c" />
          <stop offset="1" stopColor="#141a2c" />
        </linearGradient>
      </defs>

      {/* card terminal */}
      <g transform="translate(1250 548)">
        <rect x={0} y={40} width={90} height={26} rx={6} fill="#2b2d31" />
        <path d="M10 44 L20 0 L74 0 L82 44 Z" fill="#3a3c41" />
        <rect x={26} y={6} width={42} height={20} rx={3} fill={paid ? "#7be07b" : "#9fd3e0"} opacity={0.9} />
        {paid && (
          <text x={47} y={20} textAnchor="middle" fontSize={8} fontWeight={800} fill="#0f3b21">
            APPROVED
          </text>
        )}
      </g>

      {/* glass display case */}
      <rect x={0} y={612} width={1600} height={288} fill="url(#s-case)" />
      {[...Array(4)].map((_, col) => (
        <g key={col} transform={`translate(${col * 400} 0)`}>
          <rect x={20} y={700} width={360} height={10} fill="#3a4466" />
          {/* sunglasses, watch, brooch, gloves */}
          <g transform="translate(70 690)">
            <circle cx={0} cy={0} r={14} fill="#111" stroke="#c9a24b" strokeWidth={3} />
            <circle cx={36} cy={0} r={14} fill="#111" stroke="#c9a24b" strokeWidth={3} />
            <path d="M14 -2 Q18 -6 22 -2" stroke="#c9a24b" strokeWidth={3} fill="none" />
          </g>
          <g transform="translate(190 690)">
            <rect x={-8} y={-26} width={16} height={52} rx={4} fill="#5a3b26" />
            <circle cx={0} cy={0} r={13} fill="#f4efe6" stroke="#c9a24b" strokeWidth={3} />
          </g>
          <g transform="translate(300 688)" className="sparkle">
            <circle cx={0} cy={0} r={10} fill="#c9a24b" />
            <path d="M-18 -18 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 l8 -4 Z" fill="#fff8d6" />
          </g>
        </g>
      ))}
      <rect x={0} y={612} width={1600} height={288} fill="#cfe6ee" opacity={0.12} />
      <path d="M120 640 L260 640 L60 900 L-80 900 Z M700 640 L760 640 L560 900 L500 900 Z" fill="#fff" opacity={0.07} />
      {[400, 800, 1200].map((x) => (
        <rect key={x} x={x - 3} y={612} width={6} height={288} fill="url(#s-gold)" />
      ))}
      {/* counter top */}
      <rect x={0} y={604} width={1600} height={16} fill="#eaf4f6" opacity={0.95} />
      <rect x={0} y={600} width={1600} height={6} fill="url(#s-gold)" />

      {/* tissue stack & card holder */}
      <g transform="translate(40 586)">
        <rect x={0} y={0} width={90} height={16} rx={2} fill="#fbf8f2" />
        <rect x={6} y={-6} width={90} height={10} rx={2} fill="#e9dfcc" />
      </g>

      {shown && !wrapped && (
        <g transform="translate(140 548)">
          <path d="M-20 60 L190 60 L176 40 L-6 40 Z" fill="#fbf8f2" opacity={0.95} />
          <rect x={0} y={16} width={170} height={34} rx={10} fill={scarf} />
          <rect x={0} y={16} width={170} height={10} rx={6} fill="#fff" opacity={0.12} />
          {[...Array(9)].map((_, k) => (
            <line key={k} x1={172} y1={20 + k * 3.4} x2={184} y2={22 + k * 3.4} stroke={scarf} strokeWidth={2} />
          ))}
          <g transform="translate(120 -2) rotate(8)">
            <rect x={0} y={0} width={40} height={22} rx={3} fill="#fbf8f2" stroke="#c9b894" />
            <text x={20} y={15} textAnchor="middle" fontSize={11} fontWeight={800} fill="#2a1d14">
              $45
            </text>
          </g>
        </g>
      )}
      {wrapped && (
        <g transform="translate(160 520)">
          <rect x={0} y={20} width={150} height={66} rx={6} fill="#1f5f5b" />
          <rect x={66} y={20} width={18} height={66} fill="#f2b84b" />
          <rect x={0} y={46} width={150} height={14} fill="#f2b84b" />
          <path d="M75 20 Q50 -6 44 14 Q56 24 75 20 Q100 -6 106 14 Q94 24 75 20 Z" fill="#f2b84b" />
        </g>
      )}
      {paid && (
        <g transform="translate(1400 452)">
          <path d="M40 30 Q40 -10 70 -10 Q100 -10 100 30" stroke="#6b4a33" strokeWidth={5} fill="none" />
          <rect x={0} y={24} width={140} height={128} rx={4} fill="#f3eadb" stroke="#d9c7a0" />
          <rect x={0} y={24} width={140} height={14} fill="#1f5f5b" />
          <text x={70} y={100} textAnchor="middle" fontSize={34} fontWeight={700} fill="#1f5f5b" style={{ fontFamily: "Georgia, serif" }}>
            W
          </text>
          <text x={70} y={124} textAnchor="middle" fontSize={10} letterSpacing={2} fill="#6b4a33">
            WHITMORE&apos;S
          </text>
        </g>
      )}
      <rect width={1600} height={900} fill="url(#vignette)" style={{ pointerEvents: "none" }} />
    </g>
  );
}

export const STORE_NPC = { x: 590, y: 170, scale: 1.02 };
