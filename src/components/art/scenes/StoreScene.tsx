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
            Merino scarves · $39.99
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

/* ---------- the glass display case: four sections, each with its own kind of accessory ---------- */

const GOLD = "#e0b64e";
const SILVER = "#d6dde6";
const ROSE = "#d9967a";
const VELVET = "#efe6d6";
const VELVET_SHADE = "#d6c7ab";
const EMERALD = "#2e8b6e";
const RUBY = "#c0392b";
const AQUA = "#7fc4d8";
const DIAMOND = "#eef8fc";

/** Points along a U-shaped strand (quadratic curve), for pearls and chains. */
function strand(n: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1];
  });
}
/** Points around an ellipse (bracelets and coiled strands lying flat). */
function ring(n: number, rx: number, ry: number) {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * rx, Math.sin((i / n) * Math.PI * 2) * ry]);
}
const BUST_PEARLS = strand(11, -17, -34, 0, -4, 17, -34);

/** Cream velvet neck form wearing pearls or a gold pendant. */
function NecklaceBust({ x, y, pearls = false, gem = EMERALD }: { x: number; y: number; pearls?: boolean; gem?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-28 0 L-25 -20 Q-21 -32 -9 -36 L-8 -56 Q0 -60 8 -56 L9 -36 Q21 -32 25 -20 L28 0 Z" fill={VELVET} />
      <path d="M3 -58 Q6 -58 8 -56 L9 -36 Q21 -32 25 -20 L28 0 L16 0 Q17 -26 4 -35 Z" fill={VELVET_SHADE} opacity={0.7} />
      {pearls ? (
        BUST_PEARLS.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={2.6} fill="#fdfaf2" stroke="#cbbfa8" strokeWidth={0.8} />)
      ) : (
        <>
          <path d="M-15 -36 Q0 -14 15 -36" stroke={GOLD} strokeWidth={1.8} fill="none" />
          <path d="M0 -26 l4.5 5.5 l-4.5 6.5 l-4.5 -6.5 Z" fill={gem} stroke={GOLD} strokeWidth={1.2} />
        </>
      )}
    </g>
  );
}

/** Gold T-bar stand with two pendant necklaces. */
function NecklaceStand({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-15} y={-3} width={30} height={3} rx={1.5} fill={GOLD} />
      <rect x={-1.5} y={-60} width={3} height={58} fill={GOLD} />
      <path d="M-29 -59 Q-21 -22 -13 -59" stroke={GOLD} strokeWidth={1.4} fill="none" />
      <circle cx={-21} cy={-37} r={3.6} fill={AQUA} stroke={GOLD} strokeWidth={1.2} />
      <path d="M13 -59 Q21 -18 29 -59" stroke={SILVER} strokeWidth={1.4} fill="none" />
      <path d="M21 -30 C16 -34 17 -39 21 -36.5 C25 -39 26 -34 21 -30 Z" fill={RUBY} />
      <rect x={-33} y={-63} width={66} height={4} rx={2} fill={GOLD} />
    </g>
  );
}

/** Velvet cone stacked with gold, silver and rose-gold bangles. */
function BangleCone({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-8 -58 Q0 -61 8 -58 L20 0 L-20 0 Z" fill={VELVET} />
      <path d="M3 -60 Q7 -59.5 8 -58 L20 0 L11 0 Z" fill={VELVET_SHADE} opacity={0.7} />
      <ellipse cx={0} cy={-42} rx={11.5} ry={3.6} fill="none" stroke={GOLD} strokeWidth={3} />
      <ellipse cx={0} cy={-29} rx={14.5} ry={4.2} fill="none" stroke={SILVER} strokeWidth={3} />
      <ellipse cx={0} cy={-16} rx={17.5} ry={4.8} fill="none" stroke={ROSE} strokeWidth={3.2} />
    </g>
  );
}

/** Wristwatch on a display pillow. */
function WatchPillow({ x, y, strap = "#5a3b26", metal = GOLD }: { x: number; y: number; strap?: string; metal?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-7} y={-56} width={14} height={40} rx={4} fill={strap} />
      <rect x={-24} y={-20} width={48} height={20} rx={9} fill={VELVET} />
      <rect x={14} y={-38} width={3.5} height={5} rx={1} fill={metal} />
      <circle cx={0} cy={-36} r={12.5} fill="#f7f3ea" stroke={metal} strokeWidth={3} />
      <path d="M0 -36 L0 -43 M0 -36 L5 -33" stroke="#2a1d14" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

/** Bracelets draped over a padded display bar. */
function BraceletBar({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-33} y={-3} width={66} height={3} rx={1.5} fill={GOLD} />
      <rect x={-30} y={-44} width={3} height={42} fill={GOLD} />
      <rect x={27} y={-44} width={3} height={42} fill={GOLD} />
      <ellipse cx={-17} cy={-38} rx={8} ry={12} fill="none" stroke={SILVER} strokeWidth={2.4} />
      <ellipse cx={0} cy={-36} rx={8} ry={14} fill="none" stroke={GOLD} strokeWidth={2.6} strokeDasharray="2.4 1.4" />
      <ellipse cx={17} cy={-38} rx={8} ry={12} fill="none" stroke={ROSE} strokeWidth={2.6} />
      <rect x={-36} y={-54} width={72} height={10} rx={5} fill={VELVET} />
    </g>
  );
}

/** Open ring box with a solitaire. */
function RingBox({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-17 -28 L17 -28 L15 -52 L-15 -52 Z" fill="#7a2332" />
      <path d="M-12 -31 L12 -31 L11 -48 L-11 -48 Z" fill="#f3eadb" opacity={0.9} />
      <rect x={-18} y={-28} width={36} height={28} rx={3} fill="#8a2a3a" />
      <rect x={-12} y={-24} width={24} height={9} rx={4} fill="#3a1820" />
      <circle cx={0} cy={-25} r={6.5} fill="none" stroke={GOLD} strokeWidth={2.6} />
      <path d="M0 -40 l4.5 4 l-4.5 5 l-4.5 -5 Z" fill={DIAMOND} stroke={AQUA} strokeWidth={1} />
    </g>
  );
}

/** Ring cone with three stacked rings. */
function RingCone({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={-2} rx={14} ry={4} fill={GOLD} />
      <path d="M-5 -56 Q0 -60 5 -56 L10 -4 L-10 -4 Z" fill={VELVET} />
      <ellipse cx={0} cy={-44} rx={6.5} ry={2.4} fill="none" stroke={SILVER} strokeWidth={2.6} />
      <circle cx={0} cy={-47.5} r={2.4} fill={RUBY} />
      <ellipse cx={0} cy={-32} rx={7.8} ry={2.8} fill="none" stroke={GOLD} strokeWidth={2.8} />
      <circle cx={0} cy={-35.5} r={2.6} fill={EMERALD} />
      <ellipse cx={0} cy={-19} rx={9} ry={3.2} fill="none" stroke={ROSE} strokeWidth={3} />
    </g>
  );
}

/** Earrings on a card: gold hoops and emerald drops. */
function EarringCard({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-12 0 L-6 -12 M12 0 L6 -12" stroke={GOLD} strokeWidth={2} />
      <rect x={-19} y={-58} width={38} height={48} rx={3} fill="#fbf8f2" />
      <rect x={-19} y={-58} width={38} height={7} rx={3} fill="#1f5f5b" />
      <circle cx={-8} cy={-39} r={5} fill="none" stroke={GOLD} strokeWidth={2} />
      <circle cx={8} cy={-39} r={5} fill="none" stroke={GOLD} strokeWidth={2} />
      {[-8, 8].map((ex) => (
        <g key={ex}>
          <circle cx={ex} cy={-26} r={1.6} fill={GOLD} />
          <path d={`M${ex} -25 l3 5 l-3 4.5 l-3 -4.5 Z`} fill={EMERALD} />
        </g>
      ))}
    </g>
  );
}

/** Sunglasses on a nose-bridge stand. */
function SunglassesStand({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-12} y={-3} width={24} height={3} rx={1.5} fill="#c9a24b" />
      <rect x={-2} y={-36} width={4} height={34} fill="#c9a24b" />
      <circle cx={-17} cy={-40} r={13} fill="#111" stroke="#c9a24b" strokeWidth={3} />
      <circle cx={17} cy={-40} r={13} fill="#111" stroke="#c9a24b" strokeWidth={3} />
      <path d="M-4 -42 Q0 -46 4 -42" stroke="#c9a24b" strokeWidth={3} fill="none" />
      <path d="M-24 -42 L-19 -47 M10 -42 L15 -47" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
    </g>
  );
}

/** Sparkling brooch on a velvet pillow. */
function BroochPillow({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-22} y={-18} width={44} height={18} rx={8} fill={VELVET} />
      <g transform="translate(0 -30)" className="sparkle">
        <circle cx={0} cy={0} r={11} fill="#c9a24b" />
        <circle cx={0} cy={0} r={5.5} fill={AQUA} />
        <path d="M-18 -16 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 l8 -4 Z" fill="#fff8d6" />
      </g>
    </g>
  );
}

/** Open leather box of cufflinks. */
function CufflinkBox({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-20 -22 L20 -22 L17 -42 L-17 -42 Z" fill="#23201d" />
      <path d="M-15 -25 L15 -25 L13 -38 L-13 -38 Z" fill="#f3eadb" opacity={0.85} />
      <rect x={-21} y={-22} width={42} height={22} rx={3} fill="#2c2926" />
      <rect x={-17} y={-19} width={34} height={11} rx={3} fill="#f3eadb" />
      {[-7.5, 7.5].map((cx) => (
        <g key={cx}>
          <rect x={cx - 4.5} y={-18.5} width={9} height={9} rx={2} fill={SILVER} stroke="#8e9aa8" strokeWidth={1} />
          <circle cx={cx} cy={-14} r={2} fill="#1f5f5b" />
        </g>
      ))}
    </g>
  );
}

/** Slanted velvet board on the lower tier (items rest on it face-on). */
function Board({ fill, children }: { fill: string; children: React.ReactNode }) {
  return (
    <g>
      <path d="M44 772 L356 772 L368 826 L32 826 Z" fill={fill} />
      <path d="M44 772 L356 772 L358 780 L42 780 Z" fill="#fff" opacity={0.06} />
      <rect x={20} y={826} width={360} height={8} fill="#3a4466" />
      {children}
    </g>
  );
}

/** One section of the case: a label, a shelf of stands and a board of smaller pieces. */
function CaseSection({ col, label, children }: { col: number; label: string; children: React.ReactNode }) {
  return (
    <g transform={`translate(${col * 400} 0)`}>
      <text x={200} y={642} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={4} fill="#c9a24b" opacity={0.9} style={{ fontFamily: "Georgia, serif" }}>
        {label}
      </text>
      <rect x={20} y={716} width={360} height={8} fill="#3a4466" />
      {children}
    </g>
  );
}

const COILED_PEARLS = ring(22, 26, 9);
const TENNIS = ring(18, 22, 7.5);

function DisplayCase() {
  return (
    <g>
      <CaseSection col={0} label="NECKLACES">
        <NecklaceBust x={80} y={716} pearls />
        <NecklaceStand x={200} y={716} />
        <NecklaceBust x={320} y={716} gem={RUBY} />
        <Board fill="#4a1f2a">
          {/* a coiled pearl strand, a gold locket and a long chain */}
          <g transform="translate(110 800)">
            {COILED_PEARLS.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r={2.8} fill="#fdfaf2" stroke="#cbbfa8" strokeWidth={0.8} />
            ))}
          </g>
          <g transform="translate(200 790)">
            <path d="M-20 -8 Q0 20 20 -8" stroke={GOLD} strokeWidth={1.6} fill="none" />
            <ellipse cx={0} cy={11} rx={7} ry={9} fill={GOLD} />
            <ellipse cx={0} cy={11} rx={4} ry={5.5} fill="none" stroke="#a8822f" strokeWidth={1.2} />
          </g>
          <path d="M262 812 Q280 780 300 800 T336 790" stroke={SILVER} strokeWidth={1.8} fill="none" strokeDasharray="3 1.5" />
          <circle cx={336} cy={790} r={3.2} fill={AQUA} stroke={SILVER} strokeWidth={1} />
        </Board>
      </CaseSection>

      <CaseSection col={1} label="BRACELETS & WATCHES">
        <BangleCone x={80} y={716} />
        <WatchPillow x={200} y={716} />
        <BraceletBar x={320} y={716} />
        <Board fill="#1d4744">
          {/* tennis bracelet, charm bracelet and a steel watch */}
          <g transform="translate(105 800)">
            {TENNIS.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r={2.1} fill={DIAMOND} stroke={SILVER} strokeWidth={0.7} />
            ))}
          </g>
          <g transform="translate(200 796)">
            <ellipse cx={0} cy={0} rx={22} ry={8} fill="none" stroke={GOLD} strokeWidth={2} strokeDasharray="2.6 1.4" />
            <path d="M-10 8 C-13 5 -12 2 -10 4 C-8 2 -7 5 -10 8 Z" fill={RUBY} />
            <path d="M0 9 l1.6 3.2 l3.5 0.5 l-2.5 2.4 l0.6 3.5 l-3.2 -1.7 l-3.2 1.7 l0.6 -3.5 l-2.5 -2.4 l3.5 -0.5 Z" fill={GOLD} />
            <circle cx={11} cy={10} r={3} fill={AQUA} />
          </g>
          <g transform="translate(300 800)">
            <rect x={-30} y={-5} width={60} height={10} rx={4} fill="#aab4c0" />
            <circle cx={0} cy={0} r={11} fill="#20283a" stroke={SILVER} strokeWidth={3} />
            <path d="M0 0 L0 -6 M0 0 L5 2" stroke="#e8eef5" strokeWidth={1.4} strokeLinecap="round" />
          </g>
        </Board>
      </CaseSection>

      <CaseSection col={2} label="RINGS & EARRINGS">
        <RingBox x={80} y={716} />
        <RingCone x={200} y={716} />
        <EarringCard x={320} y={716} />
        <Board fill="#2b2f3d">
          {/* a tray of rings and a row of studs */}
          <rect x={80} y={782} width={170} height={34} rx={4} fill="#3b1c26" />
          {[0, 1].map((row) =>
            [0, 1, 2, 3, 4, 5].map((i) => {
              const rx = 96 + i * 27.5;
              const ry = 793 + row * 14;
              const gem = [DIAMOND, RUBY, EMERALD, AQUA, GOLD, DIAMOND][(i + row * 3) % 6];
              return (
                <g key={`${row}-${i}`}>
                  <ellipse cx={rx} cy={ry} rx={5.5} ry={3.6} fill="none" stroke={(i + row) % 2 ? SILVER : GOLD} strokeWidth={2} />
                  <circle cx={rx} cy={ry - 3.8} r={2.1} fill={gem} />
                </g>
              );
            }),
          )}
          <g transform="translate(305 800)">
            <rect x={-36} y={-12} width={72} height={24} rx={4} fill="#fbf8f2" />
            {[-24, -8, 8, 24].map((sx, i) => (
              <circle key={sx} cx={sx} cy={0} r={3.4} fill={[DIAMOND, "#fdfaf2", EMERALD, GOLD][i]} stroke={i === 1 ? "#cbbfa8" : SILVER} strokeWidth={0.8} />
            ))}
          </g>
        </Board>
      </CaseSection>

      <CaseSection col={3} label="EYEWEAR & LEATHER">
        <SunglassesStand x={80} y={716} />
        <BroochPillow x={200} y={716} />
        <CufflinkBox x={320} y={716} />
        <Board fill="#4a3526">
          {/* leather gloves, a wallet and a coiled belt */}
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${92 + i * 26} 800) rotate(${i ? 14 : -10})`}>
              <rect x={-10} y={6} width={20} height={12} rx={3} fill="#5a3b26" />
              <rect x={-11} y={-10} width={22} height={18} rx={6} fill="#7a5236" />
              {[-8, -3, 2, 7].map((fx, k) => (
                <rect key={fx} x={fx - 2.2} y={-22 + Math.abs(k - 1.5) * 2} width={4.4} height={14} rx={2.2} fill="#7a5236" />
              ))}
              <ellipse cx={-12} cy={-2} rx={3} ry={7} fill="#7a5236" transform="rotate(-25 -12 -2)" />
            </g>
          ))}
          <g transform="translate(200 800)">
            <rect x={-24} y={-14} width={48} height={28} rx={4} fill="#1f5f5b" />
            <rect x={-20} y={-10} width={40} height={20} rx={3} fill="none" stroke="#e8dcc0" strokeWidth={1} strokeDasharray="2.5 2" />
            <rect x={-24} y={-14} width={48} height={9} rx={4} fill="#184d4a" />
          </g>
          <g transform="translate(300 800)">
            {[18, 13, 8].map((r) => (
              <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="#2f1f16" strokeWidth={4.5} />
            ))}
            <rect x={14} y={-7} width={12} height={14} rx={2} fill="none" stroke={GOLD} strokeWidth={2.4} />
          </g>
        </Board>
      </CaseSection>
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
      <DisplayCase />
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
          <g transform="translate(112 -2) rotate(8)">
            <rect x={0} y={0} width={52} height={22} rx={3} fill="#fbf8f2" stroke="#c9b894" />
            <text x={26} y={15} textAnchor="middle" fontSize={11} fontWeight={800} fill="#2a1d14">
              $39.99
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
