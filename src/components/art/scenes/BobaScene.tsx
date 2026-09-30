import { ICE, SUGAR, TOPPINGS, bobaTotal, drinkZh, type Topping } from "@/lib/scenarios/boba";
import { r2, Steam, Walker } from "../shared";
import type { SceneArtProps } from "../types";

/** 晴茶 · Qing Cha: a bright, minimalist tea shop in Jing'an (warm white, pale ash wood, matte black, one tea green). */
const INK = "#1d1d1f";
const GREEN = "#7fb89a";
const GREEN_DARK = "#4f8f6e";
const SC = { fontFamily: "var(--font-sc)" };
const MONO = "Consolas, ui-monospace, monospace";
const SOLD_RED = "#d8352a";

/** Toppings drawn in a cup: pearls, translucent lychee cubes, dark grass-jelly cubes. */
function ToppingLayer({ topping, width, bottom }: { topping: string; width: number; bottom: number }) {
  if (topping === "tapioca")
    return (
      <g fill="#3a2418">
        {Array.from({ length: Math.round(width / 11) * 3 }).map((_, i) => {
          const row = i % 3;
          const col = Math.floor(i / 3);
          return <circle key={i} cx={r2(-width / 2 + 7 + col * 11 + (row % 2) * 5)} cy={r2(bottom - 7 - row * 9)} r={5} />;
        })}
      </g>
    );
  if (topping === "lychee_jelly" || topping === "grass_jelly") {
    const dark = topping === "grass_jelly";
    return (
      <g>
        {Array.from({ length: Math.round(width / 16) * 2 }).map((_, i) => {
          const row = i % 2;
          const col = Math.floor(i / 2);
          const x = r2(-width / 2 + 4 + col * 16 + row * 7);
          const y = r2(bottom - 15 - row * 12);
          return (
            <g key={i} transform={`rotate(${(i * 23) % 30 - 15} ${x + 6} ${y + 6})`}>
              <rect x={x} y={y} width={12} height={12} rx={3} fill={dark ? "#20251f" : "#f4f1e6"} opacity={dark ? 1 : 0.9} stroke={dark ? "#3b4337" : "#e2dccb"} strokeWidth={1} />
              <rect x={x + 2} y={y + 2} width={4} height={3} rx={1} fill="#fff" opacity={dark ? 0.25 : 0.7} />
            </g>
          );
        })}
      </g>
    );
  }
  return null;
}

/** A small clear cup of milk tea (menu board and sample tray). */
function MiniCup({ x, y, s = 1, topping, tea = "#d9b48f", straw = true }: { x: number; y: number; s?: number; topping: string; tea?: string; straw?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-22 -4 L22 -4 L18 58 L-18 58 Z" fill={tea} />
      <path d="M-22 -4 L22 -4 L21.4 6 L-21.4 6 Z" fill="#fff" opacity={0.55} />
      <ToppingLayer topping={topping} width={34} bottom={57} />
      <path d="M-22 -4 L22 -4 L18 58 L-18 58 Z" fill="none" stroke="#c9ccd1" strokeWidth={1.5} />
      <ellipse cx={0} cy={-4} rx={22} ry={4} fill="#fbfaf7" stroke="#d9dcdf" strokeWidth={1} />
      {straw && <rect x={4} y={-40} width={7} height={40} rx={3} fill={GREEN} transform="rotate(12 7 -4)" />}
    </g>
  );
}

/** The round 晴 monogram. */
function Monogram({ x, y, r, color = GREEN, stroke = 3 }: { x: number; y: number; r: number; color?: string; stroke?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth={stroke} />
      <text x={x} y={r2(y + r * 0.42)} textAnchor="middle" fontSize={r2(r * 1.2)} fontWeight={700} fill={color} style={SC}>
        晴
      </text>
    </g>
  );
}

/** A generic QR code (no payment-app branding): three finder squares and a fixed pattern. */
function QrCode({ x, y, size }: { x: number; y: number; size: number }) {
  const n = 13;
  const c = size / n;
  const inFinder = (i: number, j: number) => (i < 4 && j < 4) || (i < 4 && j > 8) || (i > 8 && j < 4);
  const cells: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!inFinder(i, j) && (i * 7 + j * 11 + i * j) % 5 < 2) cells.push([i, j]);
  const finder = (i: number, j: number) => (
    <g key={`f${i}-${j}`}>
      <rect x={r2(x + j * c)} y={r2(y + i * c)} width={r2(c * 3.4)} height={r2(c * 3.4)} fill={INK} />
      <rect x={r2(x + j * c + c * 0.6)} y={r2(y + i * c + c * 0.6)} width={r2(c * 2.2)} height={r2(c * 2.2)} fill="#fff" />
      <rect x={r2(x + j * c + c * 1.1)} y={r2(y + i * c + c * 1.1)} width={r2(c * 1.2)} height={r2(c * 1.2)} fill={INK} />
    </g>
  );
  return (
    <g>
      {cells.map(([i, j]) => (
        <rect key={`${i}-${j}`} x={r2(x + j * c)} y={r2(y + i * c)} width={r2(c)} height={r2(c)} fill={INK} />
      ))}
      {finder(0, 0)}
      {finder(0, 9.6)}
      {finder(9.6, 0)}
    </g>
  );
}

function Pendant({ x, len }: { x: number; len: number }) {
  return (
    <g transform={`translate(${x} 28)`}>
      <g className="sway" style={{ transformOrigin: "0px 0px" }}>
        <line x1={0} y1={0} x2={0} y2={len} stroke={INK} strokeWidth={2} />
        <ellipse cx={0} cy={len + 70} rx={110} ry={90} fill="#ffe7ae" opacity={0.25} filter="url(#glow)" className="flicker" />
        <path d={`M-34 ${len + 30} Q-34 ${len} 0 ${len} Q34 ${len} 34 ${len + 30} Z`} fill={INK} />
        <ellipse cx={0} cy={len + 30} rx={34} ry={5} fill="#fff4d2" />
      </g>
    </g>
  );
}

/** A London plane tree canopy (Jing'an's streets are lined with them). */
function PlaneTree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-8 60 L-6 250 L10 250 L8 60 Z" fill="#b9ae93" />
      <path d="M-6 110 q6 8 12 0 M-4 170 q7 6 11 -2 M-6 215 q5 9 13 1" stroke="#8f866f" strokeWidth={4} fill="none" opacity={0.7} />
      <circle cx={-6} cy={96} r={7} fill="#e2dac5" opacity={0.8} />
      {[
        [-70, 40, 58, "#7aa35c"],
        [0, 10, 70, "#8fb86a"],
        [70, 44, 60, "#7aa35c"],
        [-30, 70, 52, "#a6c97c"],
        [38, 80, 50, "#94bd70"],
      ].map(([cx, cy, r, fill]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={fill as string} />
      ))}
      {[
        [-40, 20],
        [20, -8],
        [60, 30],
        [-10, 60],
      ].map(([cx, cy]) => (
        <circle key={`h${cx}-${cy}`} cx={cx} cy={cy} r={16} fill="#c3dc9a" opacity={0.55} />
      ))}
    </g>
  );
}

/** An e-scooter rider passing in the street. */
function Scooter() {
  return (
    <g className="drive" style={{ animationDuration: "7s", animationDelay: "1.5s" }}>
      <g transform="translate(40 522)">
        <circle cx={0} cy={0} r={11} fill="#2a2a2c" />
        <circle cx={62} cy={0} r={11} fill="#2a2a2c" />
        <path d="M-4 -6 L66 -6 L60 -14 L6 -14 Z" fill="#8a9098" />
        <path d="M58 -14 L64 -58" stroke="#5c6269" strokeWidth={5} />
        <path d="M22 -16 Q20 -40 28 -58 L40 -58 Q44 -36 40 -16 Z" fill="#5b7f95" />
        <circle cx={34} cy={-70} r={11} fill="#e5b58f" />
        <path d="M22 -72 Q24 -86 34 -86 Q46 -86 47 -72 Z" fill="#f2f2f0" />
        <path d="M40 -50 L62 -56" stroke="#5b7f95" strokeWidth={6} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Ahao at the drinks bar behind Xiaoyu (black tee and cap, tea-green apron): shaking a drink once an order is in. */
function Ahao({ shaking }: { shaking: boolean }) {
  return (
    <g transform="translate(1134 322)">
      <path d="M-50 200 Q-48 76 0 68 Q48 76 50 200 Z" fill="#2c2c2e" />
      <path d="M50 200 L48 102 Q46 80 26 72 Q40 112 34 200 Z" fill={INK} />
      <path d="M-30 200 L-30 114 Q0 106 30 114 L30 200 Z" fill={GREEN} />
      <path d="M-24 114 L-12 74 M24 114 L12 74" stroke={GREEN} strokeWidth={5} strokeLinecap="round" />
      <rect x={-9} y={38} width={18} height={32} rx={7} fill="#d9a882" />
      <circle cx={0} cy={16} r={28} fill="#eab98f" />
      <path d="M-29 10 Q-28 -20 0 -22 Q28 -20 29 10 Q14 0 0 0 Q-14 0 -29 10 Z" fill={INK} />
      <ellipse cx={-4} cy={6} rx={30} ry={6} fill={INK} />
      <circle cx={-9} cy={18} r={2.6} fill="#2a1d18" />
      <circle cx={9} cy={18} r={2.6} fill="#2a1d18" />
      <path d="M-6 30 Q0 35 6 30" stroke="#8a4a3a" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <g className={shaking ? "shake" : undefined}>
        <path d="M-40 150 Q-30 118 -8 110 M40 150 Q30 118 10 110" stroke="#2c2c2e" strokeWidth={16} strokeLinecap="round" fill="none" />
        <circle cx={-8} cy={110} r={9} fill="#eab98f" />
        <circle cx={10} cy={110} r={9} fill="#eab98f" />
        <path d="M-10 64 L12 64 L8 114 L-6 114 Z" fill="url(#b-steel)" />
        <rect x={-12} y={56} width={26} height={10} rx={4} fill="#9aa0a8" />
      </g>
    </g>
  );
}

/** A delivery rider in plain grey, waiting at the pickup shelf, eyes on their phone. */
function Rider() {
  return (
    <g transform="translate(1524 380)">
      <path d="M-58 240 Q-56 96 0 88 Q56 96 58 240 Z" fill="#7d848c" />
      <path d="M0 92 L0 240" stroke="#5f656c" strokeWidth={3} />
      <rect x={-10} y={58} width={20} height={34} rx={8} fill="#d6a47f" />
      <circle cx={0} cy={40} r={30} fill="#e2b38c" />
      <path d="M-36 38 Q-36 -8 0 -10 Q36 -8 36 38 L28 38 Q26 16 0 16 Q-26 16 -28 38 Z" fill="#a7adb3" />
      <path d="M-30 18 Q0 4 30 18 L28 26 Q0 14 -28 26 Z" fill="#5f656c" />
      <path d="M-28 38 Q-24 64 -8 68 M28 38 Q24 64 8 68" stroke="#5f656c" strokeWidth={2.5} fill="none" />
      <path d="M-14 50 Q-10 53 -6 50 M6 50 Q10 53 14 50" stroke="#2a1d18" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M-44 180 Q-30 140 -4 132" stroke="#7d848c" strokeWidth={16} strokeLinecap="round" fill="none" />
      <rect x={-12} y={116} width={22} height={34} rx={4} fill={INK} transform="rotate(-12 -1 133)" />
      <circle cx={-8} cy={136} r={8} fill="#e2b38c" />
    </g>
  );
}

/** Queue numbers around the learner's, so the pickup screen reads like the real thing. */
function around(number: string, offset: number) {
  const m = /^([A-Z]*)(\d+)$/.exec(number);
  if (!m) return number;
  return `${m[1]}${String(Number(m[2]) + offset).padStart(m[2].length, "0")}`;
}

export function BobaBack({ variant, world, timeSkipped }: SceneArtProps) {
  const soldOut = String(variant.soldOut ?? "");
  const number = String(variant.number ?? "A128");
  const paid = world.includes("payment_done");
  const making = paid && !timeSkipped ? [around(number, -1), number] : [around(number, timeSkipped ? 1 : -1)];
  const ready = timeSkipped ? [around(number, -2), around(number, -1), number] : [around(number, -3), around(number, -2)];
  return (
    <g style={SC}>
      <defs>
        <linearGradient id="b-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3f2" />
          <stop offset="1" stopColor="#eef7fb" />
        </linearGradient>
        <linearGradient id="b-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa0a8" />
          <stop offset="0.45" stopColor="#e4e7ea" />
          <stop offset="1" stopColor="#8d939b" />
        </linearGradient>
        <linearGradient id="b-lightbox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f3f1ec" />
        </linearGradient>
        <radialGradient id="b-sun" cx="10%" cy="20%" r="80%">
          <stop offset="0" stopColor="#fff1c9" stopOpacity={0.55} />
          <stop offset="1" stopColor="#fff1c9" stopOpacity={0} />
        </radialGradient>
        <clipPath id="b-window">
          <rect x={36} y={150} width={350} height={416} />
        </clipPath>
      </defs>

      {/* walls: warm white with a soft concrete feel */}
      <rect width={1600} height={900} fill="#f6f4f0" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={1180 + i * 120} y={28} width={1} height={600} fill="#e6e1d9" />
      ))}
      <rect x={0} y={0} width={1600} height={28} fill="#e7e3dc" />
      <rect x={0} y={27} width={1600} height={2} fill="#d6d1c8" />

      {/* window onto a Jing'an street: plane trees, a lane of low houses, an e-scooter passing */}
      <g clipPath="url(#b-window)">
        <rect x={36} y={150} width={350} height={416} fill="url(#b-sky)" />
        <circle cx={330} cy={196} r={46} fill="#fff8e0" opacity={0.9} filter="url(#glow)" />
        <rect x={36} y={300} width={128} height={220} fill="#e6dac3" />
        <rect x={164} y={272} width={120} height={248} fill="#d8d3cb" />
        <rect x={284} y={318} width={102} height={202} fill="#c9ab93" />
        <path d="M284 318 L335 292 L386 318 Z" fill="#8f7a6a" />
        {[...Array(12)].map((_, i) => (
          <rect key={i} x={50 + (i % 3) * 36} y={318 + Math.floor(i / 3) * 44} width={20} height={26} fill="#9fb4c2" opacity={0.7} />
        ))}
        {[...Array(12)].map((_, i) => (
          <rect key={`b${i}`} x={178 + (i % 3) * 36} y={292 + Math.floor(i / 3) * 50} width={22} height={30} fill="#b9c6cf" opacity={0.75} />
        ))}
        <path d="M318 520 L318 452 Q335 430 352 452 L352 520 Z" fill="#6f5a4b" />
        <rect x={36} y={500} width={350} height={22} fill="#d9d1c3" />
        <rect x={36} y={520} width={350} height={46} fill="#a3a8ae" />
        <path d="M36 543 L386 543" stroke="#f2f2f0" strokeWidth={3} strokeDasharray="22 18" />
        <Walker y={396} delay={0} duration={16} scale={0.85} color="#5b6470" />
        <Walker y={400} delay={7} duration={13} scale={0.8} color="#7a6a5a" flip />
        <Scooter />
        <PlaneTree x={110} y={150} />
        <PlaneTree x={330} y={170} s={0.9} />
        <path d="M60 150 L120 150 L50 566 L36 566 Z" fill="#fff" opacity={0.18} />
      </g>
      <rect x={36} y={150} width={350} height={416} fill="none" stroke={INK} strokeWidth={10} />
      <rect x={207} y={150} width={8} height={416} fill={INK} />
      <rect x={24} y={564} width={374} height={14} rx={3} fill="#dcc6a3" />

      {/* plant by the window */}
      <g>
        <rect x={16} y={470} width={78} height={130} rx={6} fill="#c9c5bd" />
        {[
          [30, 440, -30],
          [70, 420, 20],
          [40, 380, -10],
          [80, 360, 30],
          [50, 330, 0],
          [20, 400, -45],
        ].map(([x, y, rot]) => (
          <g key={`${x}-${y}`} transform={`rotate(${rot} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={22} ry={34} fill="#3f7d4a" />
            <path d={`M${x} ${y - 30} L${x} ${y + 30}`} stroke="#5f9a68" strokeWidth={2} />
          </g>
        ))}
        <path d="M55 470 L52 340" stroke="#5a4636" strokeWidth={5} />
      </g>

      {/* drinks bar: grey tile backsplash, steel shelves, the long back counter */}
      <rect x={396} y={230} width={782} height={290} fill="#ebe8e2" />
      {[...Array(13)].map((_, i) => (
        <rect key={`t${i}`} x={396} y={242 + i * 22} width={782} height={1.5} fill="#dcd7cf" />
      ))}
      {[...Array(17)].map((_, i) => (
        <rect key={`v${i}`} x={396 + i * 48 + ((i % 2) * 24)} y={230} width={1.5} height={290} fill="#dcd7cf" opacity={0.7} />
      ))}
      <rect x={396} y={290} width={250} height={7} rx={2} fill="url(#b-steel)" />
      <rect x={948} y={290} width={230} height={7} rx={2} fill="url(#b-steel)" />
      {/* cup stacks on the shelves */}
      {[410, 446, 1118, 1152].map((x, i) => (
        <g key={x}>
          {[0, 1, 2, 3, 4].map((k) => (
            <path key={k} d={`M${x - 13} ${288 - k * 7} L${x + 13} ${288 - k * 7} L${x + 11} ${262 - k * 7} L${x - 11} ${262 - k * 7} Z`} fill={i % 2 ? "#f4f2ee" : "#e4f0f4"} stroke="#c9ccd1" strokeWidth={1} opacity={0.9} />
          ))}
        </g>
      ))}
      <g>
        {[486, 530].map((x) => (
          <rect key={x} x={x} y={258} width={34} height={32} rx={3} fill="#f9f8f5" stroke="#dcd7cf" />
        ))}
        <text x={503} y={280} textAnchor="middle" fontSize={12} fill={GREEN_DARK}>
          晴
        </text>
        <text x={547} y={280} textAnchor="middle" fontSize={12} fill={GREEN_DARK}>
          晴
        </text>
      </g>

      {/* sunlight from the window */}
      <path d="M386 150 L560 150 L760 600 L386 600 Z" fill="url(#b-sun)" />

      {/* back counter + equipment: blender, three tea urns, shakers | fructose dispenser, cup sealer */}
      <rect x={396} y={508} width={782} height={12} fill="url(#b-steel)" />
      <rect x={396} y={520} width={782} height={80} fill="#e4d4b8" />
      {[...Array(8)].map((_, i) => (
        <g key={`c${i}`}>
          <rect x={396 + i * 98} y={520} width={2} height={80} fill="#d3bf9f" />
          <rect x={440 + i * 98} y={532} width={14} height={3} rx={1.5} fill={INK} />
        </g>
      ))}
      <g>
        <rect x={404} y={470} width={42} height={40} rx={5} fill={INK} />
        <path d="M408 404 L442 404 L438 470 L412 470 Z" fill="#dfe9ee" opacity={0.85} stroke="#b7c3ca" />
        <rect x={406} y={398} width={38} height={9} rx={3} fill={INK} />
        <circle cx={425} cy={490} r={5} fill={GREEN} />
      </g>
      {[
        [458, "红茶", "#8b3a2b"],
        [504, "乌龙", "#8a6a2a"],
        [550, "茉莉", "#5f8f5a"],
      ].map(([x, label, color]) => (
        <g key={label as string}>
          <rect x={x as number} y={398} width={40} height={112} rx={6} fill="url(#b-steel)" />
          <rect x={(x as number) - 2} y={390} width={44} height={12} rx={4} fill="#6d737b" />
          <rect x={(x as number) + 6} y={430} width={28} height={20} rx={3} fill="#fbfaf7" />
          <text x={(x as number) + 20} y={445} textAnchor="middle" fontSize={12} fontWeight={700} fill={color as string}>
            {label as string}
          </text>
          <rect x={(x as number) + 16} y={484} width={8} height={14} rx={2} fill={INK} />
        </g>
      ))}
      {[604, 626, 648].map((x) => (
        <g key={x}>
          <path d={`M${x - 9} 462 L${x + 9} 462 L${x + 6} 510 L${x - 6} 510 Z`} fill="url(#b-steel)" />
          <rect x={x - 10} y={454} width={20} height={9} rx={3} fill="#9aa0a8" />
        </g>
      ))}
      <g>
        <rect x={948} y={432} width={52} height={78} rx={6} fill="#fbfaf7" stroke="#dcd7cf" />
        <rect x={956} y={442} width={36} height={16} rx={2} fill="#1f2a26" />
        <text x={974} y={454} textAnchor="middle" fontSize={10} fill={GREEN}>
          25ml
        </text>
        <rect x={968} y={470} width={12} height={16} rx={2} fill="#9aa0a8" />
      </g>
      <g>
        <rect x={1010} y={398} width={70} height={22} rx={10} fill="#eef3ef" stroke="#c9ccd1" />
        {[0, 1, 2, 3].map((i) => (
          <text key={i} x={1022 + i * 16} y={414} fontSize={10} fill={GREEN_DARK}>
            晴
          </text>
        ))}
        <rect x={1004} y={420} width={82} height={90} rx={8} fill="url(#b-steel)" />
        <rect x={1016} y={470} width={58} height={34} rx={4} fill="#2c2f33" />
        <rect x={1014} y={430} width={34} height={14} rx={3} fill="#1f2a26" />
        <circle cx={1066} cy={437} r={5} fill={GREEN} />
      </g>

      {/* Ahao works the bar behind Xiaoyu */}
      <Ahao shaking={world.includes("order_placed")} />

      {/* backlit menu lightbox */}
      <g>
        <rect x={432} y={30} width={726} height={194} rx={6} fill={INK} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={442 + i * 178} y={40} width={168} height={174} rx={3} fill="url(#b-lightbox)" />
        ))}
        {/* fruit teas: sold out for the afternoon */}
        <text x={526} y={72} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK}>
          水果茶
        </text>
        <MiniCup x={526} y={98} s={1.1} topping="plain" tea="#f2b35a" straw={false} />
        <g transform="rotate(-10 526 150)">
          <rect x={478} y={128} width={96} height={42} rx={6} fill={SOLD_RED} />
          <text x={526} y={159} textAnchor="middle" fontSize={26} fontWeight={900} fill="#fff">
            售罄
          </text>
        </g>
        {/* the signature milk tea */}
        <text x={704} y={72} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK}>
          招牌奶茶
        </text>
        <MiniCup x={704} y={98} s={1.15} topping="tapioca" straw={false} />
        <text x={704} y={204} textAnchor="middle" fontSize={26} fontWeight={800} fill={INK}>
          ¥15
        </text>
        {/* toppings, one per cup */}
        <text x={882} y={70} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK}>
          小料
        </text>
        <text x={882} y={90} textAnchor="middle" fontSize={11} fill="#6f7a74">
          每杯限加一种
        </text>
        {(["tapioca", "lychee_jelly", "grass_jelly"] as Topping[]).map((t, i) => {
          const y = 122 + i * 34;
          const out = soldOut === t;
          return (
            <g key={t}>
              <g opacity={out ? 0.35 : 1}>
                {t === "tapioca" ? (
                  <g fill="#3a2418">
                    <circle cx={818} cy={y - 6} r={4.5} />
                    <circle cx={827} cy={y - 6} r={4.5} />
                    <circle cx={822.5} cy={y - 13} r={4.5} />
                  </g>
                ) : (
                  <rect x={814} y={y - 17} width={15} height={15} rx={3} fill={t === "grass_jelly" ? "#20251f" : "#efe9d4"} stroke="#cfc6ad" />
                )}
                <text x={838} y={y} fontSize={17} fill={INK}>
                  {TOPPINGS[t].zh}
                </text>
                <text x={954} y={y} textAnchor="end" fontSize={17} fontWeight={700} fill={GREEN_DARK}>
                  +{TOPPINGS[t].price}
                </text>
              </g>
              {out && (
                <g transform={`rotate(-8 928 ${y - 6})`}>
                  <rect x={902} y={y - 20} width={52} height={24} rx={4} fill={SOLD_RED} />
                  <text x={928} y={y - 2} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fff">
                    售罄
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {/* sweetness and ice */}
        <text x={990} y={66} fontSize={16} fontWeight={700} fill={INK}>
          甜度
        </text>
        <text x={990} y={88} fontSize={13} fill="#3c3c3f">
          全糖 · 七分 · 半糖
        </text>
        <text x={990} y={106} fontSize={13} fill="#3c3c3f">
          三分 · 不加糖
        </text>
        <text x={990} y={134} fontSize={16} fontWeight={700} fill={INK}>
          冰量
        </text>
        <text x={990} y={156} fontSize={13} fill="#3c3c3f">
          正常冰 · 少冰 · 去冰
        </text>
        <text x={990} y={174} fontSize={13} fill="#3c3c3f">
          常温 · 热
        </text>
        <rect x={986} y={186} width={148} height={22} rx={11} fill={GREEN} opacity={0.18} />
        <text x={1060} y={202} textAnchor="middle" fontSize={12} fontWeight={700} fill={GREEN_DARK}>
          推荐：七分糖 · 少冰
        </text>
      </g>

      {/* pickup screen (叫号屏): the number moves from 制作中 to 请取餐 */}
      <g>
        <rect x={1196} y={104} width={258} height={218} rx={10} fill={INK} />
        <rect x={1206} y={114} width={238} height={198} rx={4} fill="#0f1418" />
        <text x={1325} y={136} textAnchor="middle" fontSize={12} fill="#8d949b" letterSpacing={2}>
          晴茶 · 取餐叫号
        </text>
        <text x={1266} y={168} textAnchor="middle" fontSize={18} fontWeight={700} fill="#c9ccd1">
          制作中
        </text>
        <text x={1384} y={168} textAnchor="middle" fontSize={18} fontWeight={700} fill={GREEN}>
          请取餐
        </text>
        <rect x={1324} y={150} width={1.5} height={150} fill="#2c3338" />
        {making.map((n, i) => (
          <text key={n} x={1266} y={206 + i * 32} textAnchor="middle" fontSize={22} fontWeight={600} fill="#e6e8ea" fontFamily={MONO}>
            {n}
          </text>
        ))}
        {ready.map((n, i) => (
          <text
            key={n}
            x={1384}
            y={206 + i * 32}
            textAnchor="middle"
            fontSize={22}
            fontWeight={700}
            fill={n === number ? "#b8f0cf" : GREEN}
            fontFamily={MONO}
            className={n === number ? "pulse-num" : undefined}
          >
            {n}
          </text>
        ))}
      </g>

      {/* the 晴茶 logo wall */}
      <Monogram x={1520} y={160} r={46} />
      <text x={1520} y={236} textAnchor="middle" fontSize={20} fontWeight={700} fill={INK} letterSpacing={6}>
        晴茶
      </text>
      <text x={1520} y={258} textAnchor="middle" fontSize={11} fill="#6f7a74" letterSpacing={4}>
        QING CHA
      </text>

      {/* pickup shelf with delivery orders, and a rider waiting */}
      <g>
        <rect x={1196} y={470} width={290} height={14} rx={3} fill="#dcc6a3" />
        <rect x={1196} y={484} width={290} height={6} fill="#c9ae86" />
        <rect x={1212} y={492} width={70} height={22} rx={3} fill={INK} />
        <text x={1247} y={508} textAnchor="middle" fontSize={13} fontWeight={700} fill="#f6f4f0">
          取餐台
        </text>
        {[1300, 1352].map((x) => (
          <g key={x}>
            <path d={`M${x} 418 L${x + 44} 418 L${x + 42} 470 L${x + 2} 470 Z`} fill="#fbfaf7" stroke="#dcd7cf" />
            <path d={`M${x + 12} 418 Q${x + 22} 402 ${x + 32} 418`} stroke="#c9c5bd" strokeWidth={3} fill="none" />
            <Monogram x={x + 22} y={446} r={9} stroke={1.5} />
          </g>
        ))}
        <MiniCup x={1428} y={420} s={0.8} topping="grass_jelly" />
      </g>
      <Rider />

      <Pendant x={211} len={70} />
      <Pendant x={1325} len={34} />
    </g>
  );
}

/** The learner's drink, exactly as ordered: topping, ice (or a hot paper cup), film lid and printed sticker. */
function Drink({ topping, sugar, ice, number, strawIn }: { topping: string; sugar: string; ice: string; number: string; strawIn: boolean }) {
  const hot = ice === "hot";
  const cubes = ice === "less" ? 2 : ice === "no_ice" || ice === "room" || hot ? 0 : 5;
  const cup = "M-54 0 L54 0 L43 190 L-43 190 Z";
  const label = `${SUGAR[sugar]?.zh ?? "标准糖"} · ${ice ? (hot ? "热饮" : ICE[ice]?.zh) : "正常冰"}`;
  return (
    <g transform="translate(884 452) scale(0.92)">
      <ellipse cx={0} cy={192} rx={50} ry={7} fill="#000" opacity={0.12} />
      <clipPath id="b-cup">
        <path d={cup} />
      </clipPath>
      {hot ? (
        <g>
          <path d={cup} fill="#fbfaf7" stroke="#dcd7cf" strokeWidth={1.5} />
          <path d="M-50 70 L50 70 L45.5 150 L-45.5 150 Z" fill="#c9ae86" />
          <Monogram x={0} y={110} r={20} color="#fbfaf7" stroke={2.5} />
          <Steam x={4} y={-8} scale={0.7} count={3} opacity={0.55} />
        </g>
      ) : (
        <g>
          <path d={cup} fill="#eef6f8" opacity={0.4} />
          <g clipPath="url(#b-cup)">
            <rect x={-60} y={22} width={120} height={170} fill="url(#b-tea)" />
            {topping === "vanilla" && (
              <g>
                <path d="M-60 22 L60 22 L60 44 Q30 52 0 44 Q-30 36 -60 46 Z" fill="#f3e6c8" />
                {[-30, -12, 8, 26].map((x) => (
                  <circle key={x} cx={x} cy={36 + (x % 3)} r={1.4} fill="#3a2418" />
                ))}
              </g>
            )}
            {Array.from({ length: cubes }).map((_, i) => (
              <rect key={i} x={-44 + i * 18} y={28 + (i % 2) * 18} width={20} height={20} rx={5} fill="#fff" opacity={0.55} stroke="#fff" transform={`rotate(${(i * 17) % 24 - 12} ${-34 + i * 18} ${38 + (i % 2) * 18})`} />
            ))}
            <ToppingLayer topping={topping} width={80} bottom={188} />
          </g>
          <path d={cup} fill="none" stroke="#c9ccd1" strokeWidth={2} />
          <path d="M-46 8 L-38 180" stroke="#fff" strokeWidth={5} opacity={0.5} strokeLinecap="round" />
        </g>
      )}
      {/* printed sticker */}
      <g>
        <rect x={-38} y={hot ? 16 : 94} width={76} height={50} rx={4} fill="#fff" stroke="#e3dfd8" />
        <text x={0} y={hot ? 33 : 111} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK}>
          {drinkZh(topping)}
        </text>
        <text x={0} y={hot ? 47 : 125} textAnchor="middle" fontSize={9.5} fill="#3c3c3f">
          {label}
        </text>
        <text x={0} y={hot ? 60 : 138} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={GREEN_DARK} fontFamily={MONO}>
          {number}
        </text>
      </g>
      {/* sealed film lid */}
      <ellipse cx={0} cy={0} rx={54} ry={9} fill="#fbfaf7" stroke="#dcd7cf" strokeWidth={1.5} />
      <ellipse cx={0} cy={0} rx={44} ry={6} fill="none" stroke={GREEN} strokeWidth={1.5} opacity={0.8} />
      <text x={0} y={4} textAnchor="middle" fontSize={9} fontWeight={700} fill={GREEN_DARK}>
        晴 茶 晴 茶
      </text>
      {strawIn && (
        <g>
          <rect x={-2} y={-104} width={14} height={110} rx={6} fill={GREEN} opacity={0.9} transform="rotate(14 5 0)" />
          <rect x={1} y={-100} width={3} height={100} rx={1.5} fill="#fff" opacity={0.5} transform="rotate(14 5 0)" />
        </g>
      )}
    </g>
  );
}

export function BobaFront({ variant, world, timeSkipped, slots }: SceneArtProps) {
  const billShown = world.includes("bill_shown");
  const paid = world.includes("payment_done");
  const served = world.includes("served") || timeSkipped;
  const strawIn = world.includes("item_shown");
  const soldOut = String(variant.soldOut ?? "");
  const number = String(variant.number ?? "A128");
  const topping = slots.served || slots.heard_topping || slots.topping || "";
  return (
    <g style={SC}>
      <defs>
        <linearGradient id="b-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4d0ad" />
          <stop offset="1" stopColor="#cdb38b" />
        </linearGradient>
        <linearGradient id="b-tea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcb994" />
          <stop offset="1" stopColor="#c49a70" />
        </linearGradient>
      </defs>

      {/* pale ash counter over a white terrazzo front */}
      <rect x={0} y={596} width={1600} height={38} fill="url(#b-wood)" />
      <rect x={0} y={596} width={1600} height={4} fill="#f0e3cb" />
      <rect x={0} y={634} width={1600} height={266} fill="#f2f0eb" />
      <rect x={0} y={634} width={1600} height={5} fill="#b89c75" opacity={0.5} />
      {Array.from({ length: 170 }).map((_, i) => {
        const cx = r2((i * 173.3) % 1600);
        const cy = r2(648 + ((i * 97.7) % 246));
        const chip = i % 9 === 0;
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={chip ? 5 : 1.2 + (i % 3) * 0.8}
            ry={chip ? 3.2 : 1 + (i % 2) * 0.6}
            fill={chip ? "#d9d5cd" : ["#c9c5bd", GREEN, "#e9b4bd", "#a3a3a3", "#d8cdb8"][i % 5]}
            opacity={chip ? 0.6 : 0.55}
            transform={`rotate(${(i * 37) % 180} ${cx} ${cy})`}
          />
        );
      })}
      <Monogram x={800} y={752} r={30} />
      <text x={800} y={810} textAnchor="middle" fontSize={15} fontWeight={700} fill="#6f7a74" letterSpacing={5}>
        晴茶 · QING CHA
      </text>

      {/* sample cups: the three toppings, a visual menu */}
      <g>
        <rect x={170} y={610} width={222} height={14} rx={4} fill="#c9ae86" />
        {(["tapioca", "lychee_jelly", "grass_jelly"] as Topping[]).map((t, i) => (
          <g key={t}>
            <MiniCup x={210 + i * 72} y={552} topping={t} />
            <rect x={184 + i * 72} y={628} width={52} height={20} rx={3} fill="#fff" stroke="#e3dfd8" />
            <text x={210 + i * 72} y={643} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
              {TOPPINGS[t].zh}
            </text>
            {soldOut === t && (
              <g transform={`rotate(-12 ${210 + i * 72} 590)`}>
                <rect x={188 + i * 72} y={578} width={44} height={20} rx={3} fill={SOLD_RED} />
                <text x={210 + i * 72} y={593} textAnchor="middle" fontSize={13} fontWeight={900} fill="#fff">
                  售罄
                </text>
              </g>
            )}
          </g>
        ))}
      </g>

      {/* POS: the total once she rings it up */}
      <g>
        <path d="M478 612 L494 612 L490 560 L482 560 Z" fill={INK} />
        <ellipse cx={486} cy={612} rx={26} ry={5} fill={INK} />
        <rect x={430} y={470} width={112} height={92} rx={9} fill={INK} />
        <rect x={437} y={477} width={98} height={78} rx={4} fill={paid ? "#eaf6ef" : "#f7faf8"} />
        {paid ? (
          <g>
            <circle cx={486} cy={505} r={13} fill={GREEN_DARK} />
            <path d="M479 505 L484 510 L494 499" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
            <text x={486} y={539} textAnchor="middle" fontSize={13} fontWeight={700} fill={GREEN_DARK}>
              支付成功
            </text>
          </g>
        ) : billShown && topping ? (
          <g>
            <text x={486} y={500} textAnchor="middle" fontSize={12} fill="#6f7a74">
              合计
            </text>
            <text x={486} y={533} textAnchor="middle" fontSize={28} fontWeight={800} fill={INK}>
              ¥{bobaTotal(topping)}
            </text>
          </g>
        ) : (
          <g>
            <Monogram x={486} y={505} r={14} stroke={2} />
            <text x={486} y={541} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
              欢迎光临
            </text>
          </g>
        )}
      </g>

      {/* acrylic QR stand: order and pay by scanning */}
      <g>
        <rect x={606} y={606} width={96} height={14} rx={4} fill="#d7e7e1" />
        <rect x={612} y={468} width={84} height={142} rx={7} fill="#eef7f4" opacity={0.7} stroke="#cfe3da" strokeWidth={2} />
        <rect x={620} y={476} width={68} height={126} rx={4} fill="#fff" />
        <text x={654} y={492} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>
          扫码点单
        </text>
        <QrCode x={627} y={500} size={54} />
        <text x={654} y={572} textAnchor="middle" fontSize={11} fontWeight={700} fill={paid ? GREEN_DARK : INK}>
          {paid ? "支付成功" : "扫码支付"}
        </text>
        <Monogram x={654} y={588} r={8} stroke={1.5} />
        {paid && (
          <g>
            <circle cx={654} cy={527} r={22} fill={GREEN_DARK} opacity={0.94} />
            <path d="M643 527 L651 535 L666 519" stroke="#fff" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </g>

      {/* the receipt, with the pickup number */}
      {paid && (
        <g transform="rotate(-6 730 618)">
          <path d="M692 600 L770 600 L770 646 L692 646 Z" fill="#fff" stroke="#e3dfd8" />
          <path d="M692 600 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4 l6 4 l6 -4" fill="#fff" stroke="#e3dfd8" />
          <text x={731} y={612} textAnchor="middle" fontSize={8.5} fill="#6f7a74">
            晴茶 · 取餐号
          </text>
          <text x={731} y={632} textAnchor="middle" fontSize={18} fontWeight={800} fill={INK} fontFamily={MONO}>
            {number}
          </text>
          <path d="M700 640 L762 640" stroke="#c9c5bd" strokeWidth={2} />
        </g>
      )}

      {/* straws and napkins, by the pickup end of the counter */}
      <g>
        <path d="M1326 548 L1356 548 L1352 612 L1330 612 Z" fill="url(#b-steel)" />
        {[1332, 1338, 1344, 1350].map((x, i) => (
          <rect key={x} x={x - 3} y={500 + (i % 2) * 8} width={7} height={52} rx={3} fill={i % 2 ? GREEN : "#f6f4f0"} stroke="#dcd7cf" strokeWidth={0.8} transform={`rotate(${(i - 1.5) * 4} ${x} 548)`} />
        ))}
        <rect x={1370} y={574} width={52} height={38} rx={4} fill={INK} />
        <path d="M1378 574 Q1396 560 1414 574 Z" fill="#fbfaf7" />
      </g>

      {/* your drink, once it's made */}
      {served && topping && (
        <>
          <Drink topping={topping} sugar={slots.sugar ?? ""} ice={slots.ice ?? ""} number={number} strawIn={strawIn} />
          {!strawIn && (
            <g transform="rotate(-9 974 624)">
              <rect x={934} y={618} width={96} height={12} rx={6} fill="#fbfaf7" stroke="#dcd7cf" />
              <rect x={938} y={622} width={88} height={4} rx={2} fill={GREEN} opacity={0.7} />
            </g>
          )}
        </>
      )}

      <rect width={1600} height={900} fill="url(#vignette)" opacity={0.6} style={{ pointerEvents: "none" }} />
    </g>
  );
}

export const BOBA_NPC = { x: 590, y: 175, scale: 1 };
