import { Lantern, Steam, VerticalJa, Walker } from "../shared";
import type { SceneArtProps } from "../types";

const MENU = [
  { id: "shoyu", ja: "醤油ラーメン", price: "900" },
  { id: "miso", ja: "味噌ラーメン", price: "950" },
  { id: "shio", ja: "塩ラーメン", price: "900" },
  { id: "tonkotsu", ja: "豚骨ラーメン", price: "1000" },
  { id: "tsukemen", ja: "つけ麺", price: "1000" },
  { id: "gyoza", ja: "餃子", price: "350" },
  { id: "beer", ja: "生ビール", price: "600" },
];
const DISH_JA: Record<string, string> = { shoyu: "醤油", miso: "味噌", shio: "塩", tonkotsu: "豚骨" };

export function RamenBack({ variant }: SceneArtProps) {
  return (
    <g>
      <defs>
        <linearGradient id="r-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b3521" />
          <stop offset="1" stopColor="#3a2216" />
        </linearGradient>
        <linearGradient id="r-kitchen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d9a8" />
          <stop offset="1" stopColor="#c98e55" />
        </linearGradient>
        <linearGradient id="r-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a36" />
          <stop offset="1" stopColor="#35244d" />
        </linearGradient>
        <linearGradient id="r-pot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8d949c" />
          <stop offset="0.45" stopColor="#e3e7ea" />
          <stop offset="1" stopColor="#6d747c" />
        </linearGradient>
        <radialGradient id="r-warm" cx="50%" cy="30%" r="60%">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity={0.35} />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* wall & planks */}
      <rect width={1600} height={900} fill="url(#r-wall)" />
      {Array.from({ length: 21 }).map((_, i) => (
        <rect key={i} x={i * 80} y={0} width={3} height={640} fill="#000" opacity={0.14} />
      ))}
      <rect x={0} y={0} width={1600} height={52} fill="#24150c" />
      <rect x={0} y={52} width={1600} height={9} fill="#6b4126" />

      {/* street window (left) */}
      <g>
        <rect x={50} y={240} width={400} height={330} rx={6} fill="url(#r-night)" />
        <g opacity={0.9}>
          <rect x={70} y={330} width={70} height={240} fill="#0d1026" />
          <rect x={150} y={290} width={110} height={280} fill="#110f2a" />
          <rect x={270} y={350} width={90} height={220} fill="#0d1026" />
          <rect x={370} y={310} width={70} height={260} fill="#141231" />
          {[...Array(18)].map((_, i) => (
            <rect key={i} x={80 + (i % 6) * 60} y={380 + Math.floor(i / 6) * 50} width={14} height={18} fill="#ffd27a" opacity={0.25 + ((i * 7) % 5) / 10} />
          ))}
        </g>
        <g className="flicker-slow">
          <rect x={160} y={300} width={46} height={150} rx={4} fill="#ff4f9a" opacity={0.85} filter="url(#glow)" />
          <rect x={160} y={300} width={46} height={150} rx={4} fill="#ff6fb0" />
          <VerticalJa text="カラオケ" x={183} y={336} size={30} fill="#fff" />
        </g>
        <g>
          <rect x={300} y={362} width={120} height={40} rx={4} fill="#35e0ff" opacity={0.6} filter="url(#glow)" />
          <rect x={300} y={362} width={120} height={40} rx={4} fill="#5fe8ff" />
          <text x={360} y={391} textAnchor="middle" fontSize={24} fontWeight={800} fill="#0b2a44" style={{ fontFamily: "var(--font-jp)" }}>
            居酒屋
          </text>
        </g>
        <rect x={50} y={530} width={400} height={40} fill="#1a1428" />
        <g clipPath="url(#r-window-clip)">
          <Walker y={470} delay={0} duration={14} color="#07060c" />
          <Walker y={478} delay={6} duration={11} scale={0.9} color="#0b0913" flip />
          <Walker y={466} delay={10} duration={16} scale={1.05} color="#050409" />
        </g>
        <clipPath id="r-window-clip">
          <rect x={50} y={240} width={400} height={330} />
        </clipPath>
        <rect x={50} y={240} width={400} height={330} rx={6} fill="#fff" opacity={0.04} />
        <rect x={246} y={240} width={8} height={330} fill="#2a180e" />
        <rect x={50} y={400} width={400} height={8} fill="#2a180e" />
        <rect x={40} y={230} width={420} height={350} rx={8} fill="none" stroke="#2a180e" strokeWidth={16} />
        <path d="M90 250 L130 250 L60 560 L50 560 Z" fill="#fff" opacity={0.05} />
      </g>

      {/* menu rail + tanzaku tags */}
      <rect x={470} y={78} width={680} height={9} rx={3} fill="#2a180e" />
      {MENU.map((item, i) => {
        const x = 480 + i * 96;
        const soldOut = variant.soldOut === item.id;
        return (
          <g key={item.id} transform={`rotate(${(i % 2 ? 1 : -1) * 0.8} ${x + 38} 86)`}>
            <line x1={x + 38} y1={86} x2={x + 38} y2={92} stroke="#2a180e" strokeWidth={3} />
            <rect x={x} y={92} width={78} height={158} rx={3} fill="#f5e7c8" stroke="#c9a775" strokeWidth={2} />
            <VerticalJa text={item.ja} x={x + 39} y={124} size={item.ja.length > 5 ? 17 : 21} fill="#2b1a10" />
            <text x={x + 39} y={242} textAnchor="middle" fontSize={15} fontWeight={700} fill="#a8321f">
              ¥{item.price}
            </text>
            {soldOut && (
              <g>
                <rect x={x + 6} y={150} width={66} height={36} rx={3} fill="#c8231d" transform={`rotate(-12 ${x + 39} 168)`} />
                <text x={x + 39} y={177} textAnchor="middle" fontSize={24} fontWeight={900} fill="#fff" transform={`rotate(-12 ${x + 39} 168)`} style={{ fontFamily: "var(--font-jp)" }}>
                  売切
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* kitchen pass */}
      <g>
        <rect x={520} y={262} width={560} height={300} fill="url(#r-kitchen)" />
        {[...Array(12)].map((_, i) => (
          <line key={`v${i}`} x1={520 + i * 48} y1={262} x2={520 + i * 48} y2={562} stroke="#fff" strokeWidth={2} opacity={0.35} />
        ))}
        {[...Array(6)].map((_, i) => (
          <line key={`h${i}`} x1={520} y1={262 + i * 50} x2={1080} y2={262 + i * 50} stroke="#fff" strokeWidth={2} opacity={0.35} />
        ))}
        <rect x={540} y={330} width={520} height={10} fill="#8b5a33" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <g key={i} transform={`translate(${566 + i * 72} 318)`}>
            <path d="M-24 0 Q0 18 24 0 Z" fill="#f4efe6" stroke="#b9ab96" />
            <path d="M-24 -8 Q0 10 24 -8 L24 0 Q0 18 -24 0 Z" fill="#e9e1d4" />
          </g>
        ))}
        {/* chef Kenji working */}
        <g className="chef">
          <g transform="translate(620 380)">
            <circle cx={0} cy={0} r={30} fill="#e8b98f" />
            <path d="M-32 -6 Q0 -44 32 -6 Q0 -18 -32 -6 Z" fill="#fff" />
            <path d="M-50 40 Q0 18 50 40 L60 190 L-60 190 Z" fill="#f6f3ee" />
            <rect x={-58} y={96} width={116} height={96} fill="#3b2a22" />
            <g className="stir">
              <rect x={40} y={30} width={10} height={70} rx={5} fill="#f6f3ee" transform="rotate(-30 45 30)" />
            </g>
          </g>
        </g>
        {/* stockpots */}
        <g>
          <rect x={560} y={470} width={120} height={92} rx={8} fill="url(#r-pot)" />
          <rect x={552} y={462} width={136} height={14} rx={6} fill="#b8bec4" />
          <rect x={930} y={460} width={130} height={102} rx={8} fill="url(#r-pot)" />
          <rect x={922} y={452} width={146} height={14} rx={6} fill="#b8bec4" />
          <Steam x={620} y={455} scale={0.9} opacity={0.55} />
          <Steam x={995} y={445} scale={1.1} opacity={0.55} />
        </g>
        {/* noren over the pass */}
        <g className="noren" style={{ transformOrigin: "800px 262px" }}>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={522 + i * 140} y={262} width={136} height={78} fill="#1f3a6b" />
              <rect x={522 + i * 140} y={262} width={136} height={8} fill="#142849" />
              <text x={590 + i * 140} y={320} textAnchor="middle" fontSize={40} fontWeight={800} fill="#f4efe6" style={{ fontFamily: "var(--font-jp)" }}>
                {["麺", "屋", "ほ", "し"][i]}
              </text>
            </g>
          ))}
        </g>
        <rect x={508} y={252} width={584} height={318} fill="none" stroke="#2a180e" strokeWidth={22} />
      </g>

      {/* today's special poster */}
      <g transform="translate(1170 250) rotate(2)">
        <rect x={0} y={0} width={170} height={220} rx={4} fill="#fbf1dc" />
        <rect x={0} y={0} width={170} height={48} rx={4} fill="#b8261d" />
        <text x={85} y={33} textAnchor="middle" fontSize={24} fontWeight={800} fill="#fff" style={{ fontFamily: "var(--font-jp)" }}>
          本日のおすすめ
        </text>
        <g transform="translate(85 118)">
          <ellipse cx={0} cy={10} rx={52} ry={20} fill="#e9dccb" />
          <path d="M-52 10 Q0 70 52 10 Z" fill="#c33b2b" />
          <ellipse cx={0} cy={10} rx={46} ry={14} fill="#e6a24e" />
          <circle cx={-14} cy={8} r={9} fill="#fff4c4" />
          <circle cx={-14} cy={8} r={4} fill="#f2a900" />
          <rect x={6} y={-2} width={22} height={16} rx={4} fill="#b86b4b" />
        </g>
        <text x={85} y={196} textAnchor="middle" fontSize={30} fontWeight={900} fill="#2b1a10" style={{ fontFamily: "var(--font-jp)" }}>
          {DISH_JA[String(variant.special)] ?? "味噌"}
        </text>
      </g>

      {/* shelf with maneki-neko & bottles */}
      <g>
        <rect x={1370} y={440} width={200} height={12} fill="#2a180e" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${1500 + i * 22} 390)`}>
            <rect x={-8} y={0} width={16} height={50} rx={4} fill={["#2f5b3a", "#7a3b1e", "#2b3f66"][i]} />
            <rect x={-4} y={-14} width={8} height={16} fill={["#2f5b3a", "#7a3b1e", "#2b3f66"][i]} />
            <rect x={-8} y={16} width={16} height={18} fill="#efe4cc" />
          </g>
        ))}
        <g transform="translate(1420 440)">
          <ellipse cx={0} cy={-34} rx={34} ry={36} fill="#fbf7f0" />
          <circle cx={0} cy={-84} r={30} fill="#fbf7f0" />
          <path d="M-26 -106 L-18 -80 L-8 -104 Z M26 -106 L18 -80 L8 -104 Z" fill="#fbf7f0" />
          <path d="M-22 -103 L-18 -88 L-12 -101 Z" fill="#f4a4a4" />
          <path d="M-12 -86 Q-7 -80 -2 -86 M2 -86 Q7 -80 12 -86" stroke="#2b1a10" strokeWidth={3} fill="none" />
          <path d="M-4 -74 Q0 -70 4 -74" stroke="#2b1a10" strokeWidth={2} fill="none" />
          <rect x={-20} y={-58} width={40} height={8} rx={4} fill="#c8231d" />
          <circle cx={0} cy={-48} r={6} fill="#f2c14b" />
          <ellipse cx={0} cy={-20} rx={16} ry={20} fill="#f2c14b" />
          <g className="wave" style={{ transformOrigin: "1446px 364px" }}>
            <ellipse cx={30} cy={-96} rx={11} ry={18} fill="#fbf7f0" />
          </g>
        </g>
      </g>

      <Lantern x={190} y={52} label="ら" len={30} />
      <Lantern x={1440} y={52} label="麺" len={40} />

      {/* other diners, side-on along the counter */}
      <g className="slurp">
        <g transform="translate(1320 560)">
          <circle cx={0} cy={-62} r={34} fill="#1b140f" />
          <path d="M-46 0 Q-50 -40 0 -36 Q54 -36 56 0 Z" fill="#3c4a63" />
          <path d="M-20 -60 Q-44 -40 -40 -18" stroke="#1b140f" strokeWidth={8} fill="none" />
        </g>
      </g>
      <g className="slurp" style={{ animationDelay: "2.5s" }}>
        <g transform="translate(240 588)">
          <circle cx={0} cy={-58} r={30} fill="#231811" />
          <path d="M-44 0 Q-44 -34 0 -32 Q46 -32 46 0 Z" fill="#6b3f3f" />
        </g>
      </g>

      <rect width={1600} height={620} fill="url(#r-warm)" />
    </g>
  );
}

function RamenBowl({ empty }: { empty: boolean }) {
  return (
    <g transform="translate(800 838)">
      <ellipse cx={0} cy={70} rx={150} ry={24} fill="#000" opacity={0.25} />
      <path d="M-190 -10 Q-170 110 0 118 Q170 110 190 -10 Z" fill="#1c1c1f" />
      <path d="M-190 -10 Q-170 110 0 118 Q170 110 190 -10 Z" fill="none" stroke="#c8231d" strokeWidth={10} strokeDasharray="22 14" opacity={0.8} />
      <ellipse cx={0} cy={-10} rx={190} ry={46} fill="#2a2a2e" />
      <ellipse cx={0} cy={-8} rx={172} ry={38} fill={empty ? "#8a5b2c" : "#d99a4e"} />
      {empty ? (
        <g>
          <ellipse cx={0} cy={-2} rx={120} ry={22} fill="#b07a3c" opacity={0.6} />
          <rect x={-150} y={-62} width={320} height={9} rx={4} fill="#caa06a" transform="rotate(-6)" />
          <rect x={-150} y={-48} width={320} height={9} rx={4} fill="#b88e5a" transform="rotate(-4)" />
        </g>
      ) : (
        <g>
          {[...Array(7)].map((_, i) => (
            <path key={i} d={`M${-120 + i * 34} -20 q18 16 30 0 t30 0`} stroke="#f7df9a" strokeWidth={6} fill="none" opacity={0.9} />
          ))}
          <rect x={30} y={-40} width={78} height={44} rx={16} fill="#b8694a" />
          <path d="M40 -30 q30 10 60 0" stroke="#e7b39a" strokeWidth={4} fill="none" />
          <ellipse cx={-60} cy={-18} rx={30} ry={22} fill="#fff7e0" />
          <ellipse cx={-60} cy={-18} rx={16} ry={11} fill="#f59f00" />
          <rect x={-150} y={-70} width={50} height={70} fill="#1f3326" transform="rotate(-18 -125 -35)" />
          <circle cx={-10} cy={-2} r={16} fill="#fff" />
          <path d="M-18 -2 q8 -10 16 0 q-8 8 -4 -2" stroke="#e6425a" strokeWidth={3} fill="none" />
          {[...Array(10)].map((_, i) => (
            <circle key={i} cx={-40 + (i * 37) % 110} cy={-26 + ((i * 13) % 22)} r={5} fill="#5fae4b" />
          ))}
          <Steam x={0} y={-50} scale={1.3} count={4} opacity={0.55} />
        </g>
      )}
    </g>
  );
}

export function RamenFront({ world, stageId, timeSkipped, slots }: SceneArtProps) {
  const served = world.includes("served");
  const billShown = world.includes("bill_shown");
  const paid = world.includes("payment_done");
  const showMenuCard = !served && (stageId === "greeting" || stageId === "order" || stageId === "preference");
  return (
    <g>
      <defs>
        <linearGradient id="r-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9a064" />
          <stop offset="1" stopColor="#a86a36" />
        </linearGradient>
      </defs>
      {/* back counter edge & register */}
      <rect x={0} y={600} width={1600} height={22} fill="#7a4a28" />
      <g transform="translate(1330 520)">
        <rect x={0} y={20} width={170} height={70} rx={8} fill="#3a3f47" />
        <rect x={10} y={0} width={110} height={40} rx={4} fill="#262a30" />
        <rect x={18} y={8} width={94} height={22} rx={2} fill="#9fe8b5" opacity={billShown ? 1 : 0.35} />
        {billShown && (
          <text x={65} y={25} textAnchor="middle" fontSize={16} fontWeight={700} fill="#0f3b21">
            ¥ ----
          </text>
        )}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={14 + i * 38} y={52} width={30} height={12} rx={3} fill="#5a616b" />
        ))}
      </g>

      {/* counter surface */}
      <path d="M0 620 L1600 620 L1600 900 L0 900 Z" fill="url(#r-counter)" />
      {[...Array(9)].map((_, i) => (
        <path key={i} d={`M0 ${650 + i * 30} Q800 ${640 + i * 31} 1600 ${652 + i * 30}`} stroke="#8a5328" strokeWidth={2} opacity={0.25} fill="none" />
      ))}
      <rect x={0} y={620} width={1600} height={8} fill="#f0c48d" opacity={0.7} />

      {/* condiments & chopsticks */}
      <g transform="translate(300 640)">
        <rect x={0} y={0} width={90} height={60} rx={6} fill="#6b3f22" />
        {[...Array(8)].map((_, i) => (
          <rect key={i} x={8 + i * 10} y={-50} width={6} height={60} rx={2} fill="#e8cf9e" transform={`rotate(${(i - 4) * 2} ${11 + i * 10} 0)`} />
        ))}
        <g transform="translate(120 -40)">
          <rect x={0} y={20} width={34} height={80} rx={8} fill="#3a1d10" opacity={0.9} />
          <rect x={6} y={0} width={22} height={26} rx={4} fill="#c8231d" />
          <rect x={4} y={50} width={26} height={22} fill="#f4efe6" />
        </g>
        <g transform="translate(170 -10)">
          <rect x={0} y={10} width={44} height={60} rx={10} fill="#b8261d" opacity={0.85} />
          <rect x={4} y={0} width={36} height={14} rx={4} fill="#2a2a2a" />
        </g>
      </g>

      {/* water glass */}
      <g transform="translate(1110 660)">
        <path d="M0 0 L60 0 L52 110 L8 110 Z" fill="#cfe9f5" opacity={0.45} />
        <path d="M6 30 L54 30 L50 104 L10 104 Z" fill="#9dd3ea" opacity={0.45} />
        <rect x={16} y={40} width={16} height={16} rx={3} fill="#fff" opacity={0.6} />
        <rect x={30} y={60} width={14} height={14} rx={3} fill="#fff" opacity={0.5} />
        <path d="M8 6 L14 100" stroke="#fff" strokeWidth={4} opacity={0.6} />
      </g>

      {showMenuCard && (
        <g transform="translate(40 735) rotate(-4) scale(0.78)">
          <rect x={0} y={0} width={300} height={150} rx={10} fill="#fbf3e0" stroke="#d7c09a" strokeWidth={3} />
          <text x={150} y={36} textAnchor="middle" fontSize={26} fontWeight={800} fill="#b8261d" style={{ fontFamily: "var(--font-jp)" }}>
            お品書き
          </text>
          {MENU.slice(0, 5).map((m, i) => (
            <text key={m.id} x={30} y={66 + i * 18} fontSize={15} fill="#3b2a1a" style={{ fontFamily: "var(--font-jp)" }}>
              {m.ja} ………… {m.price}
            </text>
          ))}
        </g>
      )}

      {served && <RamenBowl empty={timeSkipped} />}

      {billShown && (
        <g transform="translate(60 780) rotate(4)">
          <rect x={0} y={0} width={190} height={90} rx={12} fill="#2b1a10" />
          <rect x={10} y={10} width={170} height={70} rx={8} fill="#4a2d1a" />
          <rect x={30} y={-20} width={110} height={70} fill="#fffdf7" transform="rotate(-6 85 15)" />
          <text x={82} y={12} textAnchor="middle" fontSize={16} fontWeight={700} fill="#2b1a10" transform="rotate(-6 85 15)" style={{ fontFamily: "var(--font-jp)" }}>
            お会計
          </text>
          {paid && (
            <g>
              <circle cx={140} cy={56} r={12} fill="#d9b55c" />
              <circle cx={160} cy={50} r={10} fill="#c9c9c9" />
            </g>
          )}
        </g>
      )}
      {slots.side === "gyoza" && served && (
        <g transform="translate(1400 770) scale(0.85)">
          <ellipse cx={0} cy={0} rx={110} ry={32} fill="#f4efe6" />
          {[...Array(5)].map((_, i) => (
            <path key={i} d={`M${-70 + i * 32} 4 q14 -26 28 0 z`} fill={timeSkipped ? "#00000000" : "#e5b36a"} stroke={timeSkipped ? "none" : "#b8813d"} strokeWidth={2} />
          ))}
        </g>
      )}
      <rect width={1600} height={900} fill="url(#vignette)" style={{ pointerEvents: "none" }} />
    </g>
  );
}

export const RAMEN_NPC = { x: 590, y: 150, scale: 1.02 };
