import { basketTotal } from "@/lib/scenarios/midnight";
import type { SceneArtProps } from "../types";
import { r2, Steam } from "../shared";

/** 달빛24, a convenience store in Sinchon at 11:40 pm in the monsoon: aisles on the left, the rainy street on the right. */

const KR = { fontFamily: "var(--font-kr)" };
const TEAL = "#1f6f78";
const TEAL_DARK = "#17545b";
const MOON = "#ffe9a8";
const INK = "#1d2433";
const TAG = "#ffd84a";
const DEAL_RED = "#e2463a";
const won = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;

/** The 달빛24 mark: a crescent moon (scale 1 ≈ 32 px tall). */
function Moon({ x, y, s = 1, color = MOON }: { x: number; y: number; s?: number; color?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M-2 -16 A16 16 0 1 0 14 8 A12 12 0 1 1 -2 -16 Z" fill={color} />;
}

/** A long fluorescent tube with its glow; one of them flickers now and then. */
function Tube({ x, w, flicker = false }: { x: number; w: number; flicker?: boolean }) {
  return (
    <g className={flicker ? "flicker-slow" : undefined}>
      <ellipse cx={x + w / 2} cy={46} rx={w / 2 + 30} ry={26} fill="#f2fbff" opacity={0.5} filter="url(#glow)" />
      <rect x={x} y={14} width={w} height={10} rx={5} fill="#fbfeff" />
      <rect x={x} y={22} width={w} height={3} rx={1.5} fill="#cfdde3" />
    </g>
  );
}

const PACKS = ["#e2463a", "#f4a63b", "#ffd84a", "#4fb37a", "#3c7fd1", "#e86a9a", "#f0efe9", "#2f9e9a"];

/** A shelf of snacks (abstract, saturated packs) with yellow price tags, some flagged 1+1 or 2+1. */
function ShelfRow({ x0, x1, y, seed }: { x0: number; x1: number; y: number; seed: number }) {
  const packs: { x: number; w: number; h: number; c: string }[] = [];
  for (let x = x0, i = 0; x < x1 - 14; i++) {
    const w = 16 + ((seed * 7 + i * 13) % 4) * 5;
    const h = 30 + ((seed * 5 + i * 11) % 4) * 6;
    packs.push({ x, w, h, c: PACKS[(seed + i * 3) % PACKS.length] });
    x += w + 3;
  }
  return (
    <g>
      {packs.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={y - p.h} width={p.w} height={p.h} rx={3} fill={p.c} />
          <rect x={p.x + 3} y={y - p.h + 5} width={p.w - 6} height={4} rx={2} fill="#fff" opacity={0.45} />
        </g>
      ))}
      <rect x={x0 - 6} y={y} width={x1 - x0 + 12} height={7} fill="#cfd8dd" />
      {[0, 1, 2].map((k) => {
        const tx = x0 + 10 + k * ((x1 - x0 - 40) / 2);
        const deal = (seed + k) % 3 === 0 ? "1+1" : (seed + k) % 5 === 0 ? "2+1" : "";
        return (
          <g key={k}>
            <rect x={r2(tx)} y={y + 1} width={26} height={11} rx={1.5} fill={TAG} />
            {deal && (
              <g>
                <rect x={r2(tx + 18)} y={y - 4} width={22} height={11} rx={2} fill={DEAL_RED} />
                <text x={r2(tx + 29)} y={y + 4.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fff">
                  {deal}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The drinks fridge on the far left: misted glass doors, backlit bottles. */
function Fridge() {
  return (
    <g>
      <rect x={0} y={96} width={136} height={500} fill="#3a4250" />
      {[6, 70].map((dx) => (
        <g key={dx}>
          <rect x={dx} y={104} width={60} height={486} rx={3} fill="url(#m-fridge)" />
          {[176, 256, 336, 416, 496].map((sy, i) => (
            <g key={sy}>
              {[0, 1, 2, 3].map((k) => (
                <g key={k}>
                  <rect x={dx + 6 + k * 13} y={sy - 40} width={10} height={40} rx={3} fill={PACKS[(i * 3 + k + dx) % PACKS.length]} opacity={0.85} />
                  <rect x={dx + 8 + k * 13} y={sy - 46} width={6} height={7} rx={1.5} fill="#dfe6ea" />
                </g>
              ))}
              <rect x={dx} y={sy} width={60} height={4} fill="#c9d6dc" />
            </g>
          ))}
          <rect x={dx + 52} y={280} width={4} height={90} rx={2} fill="#9aa3ad" />
          <rect x={dx} y={104} width={60} height={486} rx={3} fill="url(#m-mist)" />
        </g>
      ))}
    </g>
  );
}

/** The rainy street through the right-hand window, with the parasol table, 참치 the cat, a walker and a scooter. */
function Street({ timeSkipped }: { timeSkipped: boolean }) {
  return (
    <g clipPath="url(#m-window)">
      <rect x={1196} y={70} width={404} height={446} fill="url(#m-night)" />
      {/* across the street: dark buildings, lit windows, neon */}
      <rect x={1196} y={96} width={140} height={210} fill="#1a2140" />
      <rect x={1336} y={128} width={120} height={178} fill="#232b4b" />
      <rect x={1456} y={84} width={150} height={222} fill="#1c2343" />
      {[
        [1214, 200],
        [1254, 200],
        [1294, 236],
        [1352, 214],
        [1392, 252],
        [1474, 196],
        [1520, 232],
        [1562, 196],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={24} height={18} fill="#ffd98a" opacity={0.35} />
      ))}
      <g className="flicker" style={{ animationDuration: "4.4s" }}>
        <rect x={1214} y={120} width={104} height={36} rx={6} fill="#ff5fa2" opacity={0.25} filter="url(#glow)" />
      </g>
      <rect x={1218} y={124} width={96} height={30} rx={5} fill="none" stroke="#ff5fa2" strokeWidth={3} />
      <text x={1266} y={146} textAnchor="middle" fontSize={18} fontWeight={800} fill="#ff8cc0" style={KR}>
        노래방
      </text>
      <rect x={1346} y={160} width={82} height={30} rx={5} fill="#3a3112" stroke="#ffd35a" strokeWidth={3} />
      <text x={1387} y={182} textAnchor="middle" fontSize={18} fontWeight={800} fill="#ffd35a" style={KR}>
        치킨
      </text>
      <g>
        <rect x={1482} y={112} width={30} height={30} rx={3} fill="#1d2b22" stroke="#3ddc84" strokeWidth={2} />
        <path d="M1497 116 V138 M1486 127 H1508" stroke="#3ddc84" strokeWidth={6} />
        <text x={1546} y={134} textAnchor="middle" fontSize={17} fontWeight={800} fill="#7ff0b0" style={KR}>
          약국
        </text>
      </g>
      {/* far sidewalk, the wet road with the neon smeared across it, the near sidewalk */}
      <rect x={1196} y={304} width={404} height={10} fill="#2c3350" />
      <rect x={1196} y={314} width={404} height={92} fill="#202739" />
      {[
        [1266, "#ff5fa2"],
        [1387, "#ffd35a"],
        [1505, "#3ddc84"],
      ].map(([x, c]) => (
        <rect key={x as number} x={(x as number) - 22} y={316} width={44} height={88} fill={c as string} opacity={0.22} filter="url(#soft-blur)" />
      ))}
      <path d="M1196 360 H1600" stroke="#e9eef5" strokeOpacity={0.5} strokeWidth={3} strokeDasharray="26 22" />
      <rect x={1196} y={406} width={404} height={110} fill="#2a3046" />
      <rect x={1196} y={406} width={404} height={4} fill="#454d66" />
      {/* a scooter hissing past in a rain poncho (no neck: the helmeted head sits on the poncho) */}
      <g className="drive" style={{ animationDuration: "8s", animationDelay: "2s" }}>
        <g transform="translate(1000 398)">
          <circle cx={0} cy={0} r={10} fill="#111622" />
          <circle cx={64} cy={0} r={10} fill="#111622" />
          <path d="M-6 -8 L70 -8 L62 -20 L4 -20 Z" fill="#59606f" />
          <path d="M60 -20 L66 -60" stroke="#59606f" strokeWidth={5} />
          <path d="M14 -18 Q12 -52 30 -66 Q48 -52 46 -18 Z" fill="#f2d36b" opacity={0.9} />
          <circle cx={30} cy={-74} r={11} fill="#e5b58f" />
          <path d="M18 -76 Q20 -90 30 -90 Q42 -90 43 -76 Z" fill="#e2463a" />
          <path d="M42 -48 L64 -58" stroke="#f2d36b" strokeWidth={6} strokeLinecap="round" />
        </g>
      </g>
      {/* a walker under a clear umbrella, feet on the sidewalk */}
      <g className="walk-rev" style={{ animationDuration: "15s", animationDelay: "3s" }}>
        <g transform="translate(0 404) scale(0.8)" fill="#3b4258">
          <path d="M-40 -18 Q0 -58 40 -18 Z" fill="#e8f4ff" opacity={0.42} />
          <path d="M-40 -18 Q0 -58 40 -18" stroke="#f4f8ff" strokeWidth={2} fill="none" opacity={0.7} />
          <path d="M0 -40 V20" stroke="#cfd6e2" strokeWidth={2} />
          <circle cx={0} cy={0} r={11} />
          <path d="M-14 14 Q0 8 14 14 L18 70 L-18 70 Z" />
          <rect x={-12} y={68} width={9} height={40} rx={4} className="leg-a" />
          <rect x={3} y={68} width={9} height={40} rx={4} className="leg-b" />
        </g>
      </g>
      {/* the parasol table right outside the door, chairs and table legs on the pavement */}
      <g>
        <path d="M1528 404 V468" stroke="#d9dde3" strokeWidth={4} />
        <path d="M1464 424 Q1528 384 1592 424 Z" fill="#2f9e9a" />
        {[1480, 1512, 1544, 1576].map((x) => (
          <path key={x} d={`M${x} 424 Q${x + 8} 400 ${x + 16} 420`} fill="#f4f6f8" opacity={0.9} />
        ))}
        {[1468, 1498, 1558, 1588].map((x, i) => (
          <circle key={x} className="drip" style={{ animationDelay: `${i * 0.3}s` }} cx={x} cy={428} r={2} fill="#a9c1e8" />
        ))}
        <ellipse cx={1528} cy={470} rx={42} ry={8} fill="#2f9e9a" />
        <path d="M1498 472 L1492 512 M1558 472 L1564 512" stroke="#2f9e9a" strokeWidth={5} />
        <g fill="#e2463a">
          <rect x={1572} y={478} width={28} height={8} rx={3} />
          <rect x={1594} y={454} width={6} height={26} rx={2} />
          <path d="M1574 486 L1572 512 M1598 486 L1600 512" stroke="#e2463a" strokeWidth={4} />
        </g>
      </g>
      {/* 참치: curled up under the table, then sitting by the door once you've eaten */}
      {timeSkipped ? (
        <g transform="translate(1474 488)">
          <path d="M-12 24 Q-16 0 0 -6 Q16 0 12 24 Z" fill="#e8954a" />
          <path d="M-6 24 Q0 10 6 24 Z" fill="#fff5ea" />
          <circle cx={0} cy={-14} r={11} fill="#e8954a" />
          <path d="M-9 -20 L-7 -32 L-1 -23 Z M9 -20 L7 -32 L1 -23 Z" fill="#e8954a" />
          <g className="npc-blink" style={{ transformOrigin: "0px -14px" }}>
            <circle cx={-4} cy={-15} r={1.8} fill="#2a1f1c" />
            <circle cx={4} cy={-15} r={1.8} fill="#2a1f1c" />
          </g>
          <path d="M12 20 Q30 16 26 0" stroke="#e8954a" strokeWidth={5} fill="none" strokeLinecap="round" className="sway" />
        </g>
      ) : (
        <g transform="translate(1536 500)">
          <ellipse cx={0} cy={4} rx={20} ry={10} fill="#e8954a" />
          <circle cx={-16} cy={-2} r={9} fill="#e8954a" />
          <path d="M-22 -8 L-22 -17 L-16 -10 Z M-12 -9 L-10 -18 L-7 -10 Z" fill="#e8954a" />
          <path d="M-20 -2 q2 2 4 0 M-14 -2 q2 2 4 0" stroke="#2a1f1c" strokeWidth={1.4} fill="none" />
          <path d="M-6 8 Q6 14 18 6" stroke="#fff5ea" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M18 4 Q30 -4 22 -10" stroke="#e8954a" strokeWidth={5} fill="none" strokeLinecap="round" className="sway" />
        </g>
      )}
      {/* rain: lighter once the worst has passed */}
      <g className="rain" opacity={timeSkipped ? 0.22 : 0.38}>
        {Array.from({ length: 64 }).map((_, i) => {
          const x = r2(1196 + ((i * 61.7) % 420));
          const y = r2(40 + ((i * 113.3) % 520));
          return <path key={i} d={`M${x} ${y} l-5 ${18 + (i % 3) * 6}`} stroke="#a9c1e8" strokeWidth={1.6} strokeLinecap="round" />;
        })}
      </g>
      {/* reflections and condensation on the glass */}
      <path d="M1236 70 L1286 70 L1220 516 L1196 516 L1196 300 Z" fill="#fff" opacity={0.06} />
      <path d="M1360 70 L1380 70 L1316 516 L1296 516 Z" fill="#fff" opacity={0.05} />
      <rect x={1196} y={70} width={404} height={446} fill="url(#m-mist-low)" />
    </g>
  );
}

/** The ramen corner along the window: the noodle machine, hot water, the microwave, the how-to sign, stools. */
function RamenCorner({ cooking, timeSkipped, heated }: { cooking: boolean; timeSkipped: boolean; heated: boolean }) {
  return (
    <g>
      {/* the window counter and its stools */}
      <rect x={1188} y={512} width={412} height={18} rx={3} fill="#dfe6ea" />
      <rect x={1188} y={528} width={412} height={68} fill="#cfd8dd" />
      {[1262, 1382, 1502].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={566} rx={26} ry={7} fill="#3a4250" />
          <path d={`M${x} 570 V596`} stroke="#9aa3ad" strokeWidth={5} />
        </g>
      ))}
      {/* how-to sign taped to the glass: the same three steps Doyun explains */}
      <g>
        <rect x={1208} y={296} width={96} height={106} rx={3} fill="#fbfaf5" stroke="#e1ddd2" />
        <rect x={1236} y={290} width={40} height={10} fill="#f4e7b0" opacity={0.85} />
        <text x={1256} y={316} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={INK} style={KR}>
          라면 조리기 사용법
        </text>
        {["① 면·스프 넣기", "② 기계에 올리기", "③ 1번 버튼"].map((line, i) => (
          <text key={line} x={1216} y={340 + i * 21} fontSize={10} fontWeight={700} fill={i === 2 ? DEAL_RED : "#3d4659"} style={KR}>
            {line}
          </text>
        ))}
      </g>
      {/* the noodle machine */}
      <g>
        <rect x={1208} y={418} width={84} height={94} rx={8} fill="url(#m-steel)" />
        <rect x={1216} y={426} width={68} height={22} rx={3} fill="#1f2a26" />
        <text x={1250} y={442} textAnchor="middle" fontSize={12} fontWeight={800} fill={timeSkipped ? "#7ff0b0" : "#ff7a6b"} style={KR}>
          {timeSkipped ? "완료" : cooking ? "조리중" : "03:00"}
        </text>
        <circle cx={1272} cy={464} r={9} fill={DEAL_RED} />
        <text x={1272} y={468.5} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fff">
          1
        </text>
        <rect x={1218} y={480} width={42} height={26} rx={3} fill="#2c3340" />
        {cooking && !timeSkipped && <Steam x={1240} y={476} scale={0.45} count={2} opacity={0.65} />}
      </g>
      {/* hot water and the microwave */}
      <g>
        <rect x={1300} y={446} width={40} height={66} rx={5} fill="#f4f6f8" stroke="#d5dbe0" />
        <rect x={1308} y={454} width={24} height={12} rx={2} fill={DEAL_RED} />
        <text x={1320} y={463.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff" style={KR}>
          온수
        </text>
        <path d="M1320 480 V492" stroke="#9aa3ad" strokeWidth={5} />
      </g>
      <g>
        <rect x={1350} y={452} width={88} height={60} rx={5} fill="#e9edf0" stroke="#c9d1d7" />
        <rect x={1358} y={460} width={54} height={44} rx={3} fill={heated ? "#ffcf7a" : "#2c3340"} opacity={heated ? 0.85 : 1} />
        <rect x={1418} y={462} width={12} height={40} rx={2} fill="#cfd6dc" />
      </g>
      {/* your bowl, finished, once you've eaten */}
      {timeSkipped && (
        <g>
          <path d="M1452 500 L1500 500 L1494 512 L1458 512 Z" fill="#f6f1e6" stroke="#e1d8c4" />
          <ellipse cx={1476} cy={500} rx={24} ry={5} fill="#c9512f" opacity={0.5} />
          <path d="M1462 494 L1506 486 M1462 498 L1508 492" stroke="#b98d5a" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      )}
      {/* the lost-and-found umbrella bucket by the door */}
      <g>
        <path d="M1552 540 L1594 540 L1590 596 L1556 596 Z" fill="#9aa3ad" />
        {[1560, 1570, 1582].map((x, i) => (
          <path key={x} d={`M${x} 540 L${x - 4 + i * 4} 484`} stroke={["#2b3140", "#5b6b8a", "#e2463a"][i]} strokeWidth={4} strokeLinecap="round" />
        ))}
        <rect x={1556} y={556} width={34} height={14} rx={2} fill="#fff" />
        <text x={1573} y={566.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill={INK} style={KR}>
          분실물
        </text>
      </g>
    </g>
  );
}

/** Hands of the wall clock (11:40, then 11:52 after the time skip). */
function WallClock({ late }: { late: boolean }) {
  const hour = late ? 356 : 350;
  const minute = late ? 312 : 240;
  return (
    <g transform="translate(1124 392)">
      <circle r={30} fill="#fbfdfe" stroke="#3a4250" strokeWidth={5} />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={-1} y={-25} width={2} height={5} fill="#3a4250" transform={`rotate(${i * 30})`} />
      ))}
      <rect x={-2} y={-15} width={4} height={17} rx={2} fill={INK} transform={`rotate(${hour})`} />
      <rect x={-1.5} y={-23} width={3} height={25} rx={1.5} fill={INK} transform={`rotate(${minute})`} />
      <circle r={3} fill={DEAL_RED} />
    </g>
  );
}

export function MidnightBack({ variant, world, timeSkipped }: SceneArtProps) {
  const aisle = String(variant.aisle ?? "aisle3");
  const found = world.includes("item_shown");
  return (
    <g>
      <defs>
        <linearGradient id="m-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a33" />
          <stop offset="1" stopColor="#1f2a4d" />
        </linearGradient>
        <linearGradient id="m-fridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2fbff" />
          <stop offset="1" stopColor="#d6eef8" />
        </linearGradient>
        <linearGradient id="m-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="0.2" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.8" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.45} />
        </linearGradient>
        <linearGradient id="m-mist-low" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.7" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.2} />
        </linearGradient>
        <linearGradient id="m-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa0a8" />
          <stop offset="0.45" stopColor="#e4e7ea" />
          <stop offset="1" stopColor="#8d939b" />
        </linearGradient>
        <radialGradient id="m-neon-spill" cx="100%" cy="60%" r="60%">
          <stop offset="0" stopColor="#ff5fa2" stopOpacity={0.16} />
          <stop offset="1" stopColor="#ff5fa2" stopOpacity={0} />
        </radialGradient>
        <clipPath id="m-window">
          <rect x={1196} y={70} width={404} height={446} />
        </clipPath>
      </defs>

      {/* cool white walls, the ceiling and its tubes */}
      <rect width={1600} height={900} fill="#eef4f4" />
      <rect x={0} y={0} width={1600} height={44} fill="#e3ebee" />
      <rect x={0} y={43} width={1600} height={2} fill="#cfdde3" />

      {/* left: the drinks fridge and a wall of snacks, with the cosmetics aisle sign */}
      <Fridge />
      <rect x={146} y={140} width={274} height={456} fill="#e4f2ee" />
      {[236, 316, 396, 476, 556].map((y, i) => (
        <ShelfRow key={y} x0={160} x1={i >= 2 ? 318 : 410} y={y} seed={i + 2} />
      ))}
      {/* cosmetics: sheet masks (1+1) and pimple patches, under the 화장품 sign */}
      {[396, 476].map((y, row) => (
        <g key={y}>
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={326 + k * 21} y={y - (row ? 30 : 38)} width={18} height={row ? 30 : 38} rx={3} fill={row ? ["#bfe8dc", "#9fd8c8", "#bfe8dc", "#9fd8c8"][k] : ["#f6c1d1", "#fbd9e3", "#f6c1d1", "#d9eaf8"][k]} />
          ))}
          {row === 1 && [0, 1, 2, 3].map((k) => <circle key={k} cx={335 + k * 21} cy={y - 15} r={3} fill="#fff" opacity={0.8} />)}
        </g>
      ))}
      <rect x={378} y={354} width={26} height={11} rx={2} fill={DEAL_RED} />
      <text x={391} y={362.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fff">
        1+1
      </text>
      <g>
        <path d="M322 44 V62 M402 44 V62" stroke="#9aa3ad" strokeWidth={2} />
        {found && aisle !== "counter" && <ellipse className="glow-once" cx={362} cy={90} rx={70} ry={40} fill={MOON} opacity={0} filter="url(#glow)" />}
        <rect x={306} y={60} width={112} height={56} rx={8} fill={TEAL} />
        <circle cx={334} cy={88} r={16} fill={MOON} />
        <text x={334} y={95} textAnchor="middle" fontSize={20} fontWeight={900} fill={TEAL_DARK}>
          {aisle === "aisle2" ? "2" : "3"}
        </text>
        <text x={384} y={94} textAnchor="middle" fontSize={16} fontWeight={800} fill={MOON} style={KR}>
          화장품
        </text>
      </g>

      {/* centre: the back wall behind Doyun */}
      <rect x={420} y={44} width={776} height={552} fill="#f2f6f6" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={420 + i * 130} y={44} width={1} height={552} fill="#e1eaea" />
      ))}
      <g>
        <rect x={560} y={58} width={480} height={56} rx={10} fill={TEAL} />
        <Moon x={612} y={88} s={0.9} />
        <text x={736} y={98} textAnchor="middle" fontSize={30} fontWeight={900} fill={MOON} style={KR}>
          달빛24
        </text>
        <text x={900} y={95} textAnchor="middle" fontSize={13} fontWeight={700} fill={MOON} opacity={0.8} letterSpacing={5}>
          DALBIT 24
        </text>
      </g>
      {/* now hiring */}
      <g transform="rotate(-2 506 196)">
        <rect x={454} y={144} width={104} height={104} rx={2} fill="#fffdf6" stroke="#e8e2d0" />
        <rect x={480} y={138} width={50} height={10} fill="#f4e7b0" opacity={0.85} />
        <text x={506} y={174} textAnchor="middle" fontSize={13} fontWeight={900} fill={DEAL_RED} style={KR}>
          아르바이트
        </text>
        <text x={506} y={192} textAnchor="middle" fontSize={13} fontWeight={900} fill={DEAL_RED} style={KR}>
          구함
        </text>
        <text x={506} y={216} textAnchor="middle" fontSize={10} fontWeight={700} fill="#3d4659" style={KR}>
          야간 · 주말
        </text>
        <text x={506} y={234} textAnchor="middle" fontSize={9} fill="#6b7385" style={KR}>
          문의: 카운터
        </text>
      </g>
      {/* the hot case: fish cake bars and steamed buns */}
      <g>
        <rect x={440} y={362} width={178} height={112} rx={8} fill="#5b6270" />
        <rect x={448} y={372} width={162} height={92} rx={4} fill="#ffe2b0" opacity={0.9} />
        <ellipse cx={529} cy={418} rx={90} ry={50} fill="#ffcf7a" opacity={0.35} filter="url(#glow)" />
        {[464, 488, 512].map((x) => (
          <g key={x}>
            <rect x={x} y={392} width={12} height={42} rx={6} fill="#d6834a" />
            <path d={`M${x + 6} 434 V454`} stroke="#c9a77a" strokeWidth={2} />
          </g>
        ))}
        {[548, 576].map((x) => (
          <ellipse key={x} cx={x} cy={440} rx={13} ry={11} fill="#fbf7ee" />
        ))}
        <rect x={470} y={348} width={118} height={18} rx={3} fill={TEAL} />
        <text x={529} y={361} textAnchor="middle" fontSize={11} fontWeight={800} fill={MOON} style={KR}>
          핫바 · 찐빵
        </text>
      </g>
      {/* right of Doyun: chargers and batteries, the radio, the clock, hangover-cure bottles */}
      <g>
        <rect x={976} y={132} width={204} height={200} rx={4} fill="#dfe6e4" />
        {Array.from({ length: 15 }).map((_, i) => {
          const x = 990 + (i % 5) * 38;
          const y = 146 + Math.floor(i / 5) * 62;
          return (
            <g key={i}>
              <path d={`M${x + 12} ${y} V${y + 8}`} stroke="#9aa3ad" strokeWidth={2} />
              <rect x={x} y={y + 8} width={26} height={40} rx={3} fill={["#f4f6f8", "#f4a63b", "#4fb37a", "#3c7fd1", "#f4f6f8"][i % 5]} />
              <rect x={x + 5} y={y + 16} width={16} height={12} rx={2} fill="#2c3340" opacity={0.25} />
            </g>
          );
        })}
      </g>
      <g>
        <rect x={990} y={360} width={68} height={44} rx={6} fill="#3a4250" />
        <circle cx={1010} cy={382} r={12} fill="#2c3340" />
        <circle cx={1010} cy={382} r={6} fill="#4a5262" />
        <rect x={1028} y={370} width={22} height={8} rx={2} fill="#ffcf7a" opacity={0.85} />
        <path d="M1048 360 L1062 334" stroke="#9aa3ad" strokeWidth={2} />
        <g className="sway" style={{ transformOrigin: "1040px 350px" }}>
          <path d="M1034 344 v-16 l8 -3 v16" stroke="#6b7385" strokeWidth={2} fill="none" />
          <circle cx={1032} cy={344} r={3} fill="#6b7385" />
          <circle cx={1040} cy={341} r={3} fill="#6b7385" />
        </g>
      </g>
      <WallClock late={timeSkipped} />
      <g>
        <rect x={976} y={456} width={204} height={6} fill="#cfd8dd" />
        {[988, 1012, 1036, 1060, 1084, 1108, 1132, 1156].map((x) => (
          <g key={x}>
            <rect x={x} y={426} width={16} height={30} rx={3} fill="#7a4a24" />
            <rect x={x + 3} y={420} width={10} height={7} rx={1.5} fill="#e9d29a" />
            <rect x={x + 1} y={436} width={14} height={8} fill="#fff" opacity={0.8} />
          </g>
        ))}
      </g>

      {/* right: the rainy street through the glass, its frame, and the ramen corner inside */}
      <Street timeSkipped={timeSkipped} />
      <g>
        <rect x={1188} y={62} width={412} height={12} fill="#2b3140" />
        <rect x={1188} y={62} width={10} height={456} fill="#2b3140" />
        <rect x={1436} y={62} width={10} height={456} fill="#2b3140" />
        <rect x={1456} y={250} width={8} height={120} rx={4} fill="#c9ccd1" />
        <rect x={1476} y={330} width={62} height={20} rx={3} fill="#fff" opacity={0.92} />
        <text x={1507} y={344} textAnchor="middle" fontSize={11} fontWeight={800} fill={DEAL_RED} style={KR}>
          당기세요
        </text>
      </g>
      <rect x={1100} y={44} width={500} height={552} fill="url(#m-neon-spill)" style={{ pointerEvents: "none" }} />
      <RamenCorner cooking={world.includes("order_placed")} timeSkipped={timeSkipped} heated={world.includes("heated")} />

      {/* the tubes go last: light over everything */}
      <Tube x={40} w={240} />
      <Tube x={330} w={240} />
      <Tube x={620} w={240} flicker />
      <Tube x={910} w={240} />
      <Tube x={1240} w={240} />
    </g>
  );
}

/** One of the learner's items as it sits on the counter. */
function Item({ kind, x, y, label }: { kind: string; x: number; y: number; label?: string }) {
  if (kind === "ramen")
    return (
      <g>
        <rect x={x} y={y - 44} width={54} height={44} rx={5} fill="#d83a2e" />
        <circle cx={x + 18} cy={y - 22} r={11} fill="#f6d26b" />
        <path d={`M${x + 10} ${y - 24} q4 -6 8 0 t8 0`} stroke="#d83a2e" strokeWidth={2} fill="none" />
        <text x={x + 40} y={y - 26} textAnchor="middle" fontSize={8.5} fontWeight={900} fill="#fff" style={KR}>
          매운맛
        </text>
      </g>
    );
  if (kind === "bowl")
    return (
      <g>
        <path d={`M${x} ${y - 26} L${x + 30} ${y - 26} L${x + 26} ${y} L${x + 4} ${y} Z`} fill="#f6f1e6" stroke="#e1d8c4" />
        <rect x={x + 6} y={y - 18} width={18} height={6} rx={2} fill={TEAL} opacity={0.8} />
      </g>
    );
  if (kind === "kimbap")
    return (
      <g>
        <path d={`M${x} ${y} L${x + 18} ${y - 32} L${x + 36} ${y} Z`} fill="#eef3f6" stroke="#cfd8dd" />
        <path d={`M${x + 8} ${y} L${x + 18} ${y - 18} L${x + 28} ${y} Z`} fill="#22302a" />
        <path d={`M${x + 11} ${y - 2} L${x + 18} ${y - 14} L${x + 25} ${y - 2} Z`} fill="#f6f3ea" />
        <rect x={x + 6} y={y - 9} width={24} height={7} rx={1.5} fill={label === "bibim" ? "#e2463a" : "#3c7fd1"} />
      </g>
    );
  if (kind === "milk") {
    // Banana milk, or the strawberry one taken as the free 1+1.
    const strawberry = label === "strawberry";
    return (
      <g>
        <rect x={x} y={y - 40} width={22} height={40} rx={2} fill={strawberry ? "#f9b4c8" : "#ffe17a"} />
        <path d={`M${x} ${y - 40} L${x + 11} ${y - 48} L${x + 22} ${y - 40} Z`} fill={strawberry ? "#f48fae" : "#ffd34d"} />
        <rect x={x + 3} y={y - 30} width={16} height={10} rx={2} fill="#fff" opacity={0.85} />
      </g>
    );
  }
  if (kind === "patches") {
    // The regular pack, or the thin ones taken as the free 1+1.
    const thin = label === "thin";
    return (
      <g>
        <rect x={x} y={y - 26} width={36} height={26} rx={3} fill={thin ? "#d8e6fb" : "#bfe8dc"} stroke={thin ? "#b9cff2" : "#9fd8c8"} />
        {[0, 1, 2].map((k) => (
          <circle key={k} cx={x + 8 + k * 10} cy={y - 13} r={thin ? 2.4 : 3.2} fill="#fff" />
        ))}
      </g>
    );
  }
  if (kind === "beer")
    return (
      <g>
        <rect x={x} y={y - 38} width={20} height={38} rx={4} fill="#c9a03a" />
        <rect x={x} y={y - 30} width={20} height={14} fill="#2f9e9a" opacity={0.85} />
        <rect x={x + 3} y={y - 41} width={14} height={4} rx={1.5} fill="#c9ccd1" />
      </g>
    );
  return null;
}

/** A free 1+1 extra: a little sparkle and a red sticker. */
function DealMark({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <g className="sparkle">
        <path d={`M${x - 6} ${y - 52} l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z`} fill={MOON} />
        <path d={`M${x + 18} ${y - 40} l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z`} fill="#fff" />
      </g>
      <rect x={x - 10} y={y - 16} width={24} height={11} rx={2} fill={DEAL_RED} />
      <text x={x + 2} y={y - 7.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fff">
        1+1
      </text>
    </g>
  );
}

export function MidnightFront({ variant, world, timeSkipped, slots, flags }: SceneArtProps) {
  const deal = String(variant.deal ?? "kimbap");
  const aisle = String(variant.aisle ?? "aisle3");
  const beer = !!variant.beer && slots.noBeer !== "yes";
  const scanned = world.includes("bill_shown");
  const paid = world.includes("payment_done");
  const extra = world.includes("item_added");
  const heated = world.includes("heated");
  const patches = slots.patches === "got" || world.includes("item_shown");
  const bagged = slots.bag === "yes" || slots.bag === "paper";
  const total = basketTotal(slots, variant);
  const umbrella = slots.umbrella;
  return (
    <g>
      {/* the counter: light laminate over a white front with the teal band */}
      <rect x={0} y={596} width={1600} height={34} fill="#e6ecef" />
      <rect x={0} y={596} width={1600} height={4} fill="#f7fafb" />
      <rect x={0} y={630} width={1600} height={270} fill="#f4f7f8" />
      <rect x={0} y={630} width={1600} height={5} fill="#c7cdd3" />
      <rect x={0} y={668} width={1600} height={26} fill={TEAL} />
      <Moon x={846} y={772} s={1.4} color={TEAL} />
      <text x={904} y={784} textAnchor="middle" fontSize={34} fontWeight={900} fill={TEAL} style={KR}>
        달빛24
      </text>
      {/* counter-front posters: this week's 1+1, the bag charge, top-ups */}
      <g transform="rotate(-2 680 760)">
        <rect x={612} y={712} width={136} height={96} rx={6} fill={MOON} stroke="#f0d98a" />
        <rect x={612} y={712} width={136} height={26} rx={6} fill={DEAL_RED} />
        <text x={680} y={731} textAnchor="middle" fontSize={14} fontWeight={900} fill="#fff" style={KR}>
          1+1 행사
        </text>
        <path d="M626 790 L646 752 L666 790 Z" fill="#22302a" />
        <path d="M634 790 L646 768 L658 790 Z" fill="#f6f3ea" />
        <text x={680} y={782} textAnchor="middle" fontSize={20} fontWeight={900} fill={DEAL_RED}>
          +
        </text>
        <path d="M694 790 L714 752 L734 790 Z" fill="#22302a" />
        <path d="M702 790 L714 768 L726 790 Z" fill="#f6f3ea" />
      </g>
      <g>
        <rect x={1056} y={712} width={150} height={36} rx={6} fill="#fff" stroke="#d5dbe0" />
        <text x={1131} y={735} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} style={KR}>
          교통카드 충전 가능
        </text>
        <rect x={1056} y={756} width={104} height={28} rx={6} fill="#fff" stroke="#d5dbe0" />
        <text x={1108} y={775} textAnchor="middle" fontSize={12} fontWeight={800} fill="#6b7385" style={KR}>
          봉투 100원
        </text>
      </g>

      {/* the learner's phone, propped up: the shopping list */}
      <g>
        <rect x={598} y={482} width={58} height={112} rx={9} fill="#1d2433" />
        <rect x={602} y={490} width={50} height={96} rx={5} fill="#fbfaf5" />
        <text x={627} y={504} textAnchor="middle" fontSize={9} fontWeight={900} fill={INK} style={KR}>
          메모
        </text>
        {[
          ["라면", true],
          ["삼각김밥", true],
          ["여드름 패치", patches],
        ].map(([label, done], i) => (
          <g key={label as string}>
            <rect x={606} y={514 + i * 22} width={9} height={9} rx={1.5} fill="none" stroke="#6b7385" strokeWidth={1.4} />
            {done && <path d={`M607.5 ${518.5 + i * 22} l2.5 3 l5 -6`} stroke={TEAL} strokeWidth={2} fill="none" strokeLinecap="round" />}
            <text x={618} y={522 + i * 22} fontSize={label === "여드름 패치" ? 6.6 : 8} fontWeight={700} fill={INK} style={KR} textDecoration={done ? "line-through" : undefined}>
              {label as string}
            </text>
          </g>
        ))}
      </g>

      {/* the counter display: lip balms and pimple patches (the patches are here when they're "right in front of you") */}
      <g>
        <rect x={662} y={552} width={58} height={44} rx={4} fill="#fbfdfe" stroke="#d5dbe0" />
        <rect x={662} y={536} width={58} height={18} rx={3} fill={TEAL} />
        <text x={691} y={549} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={MOON} style={KR}>
          피부 케어
        </text>
        {[668, 682, 696].map((x, i) => (
          <rect key={x} x={x} y={562} width={10} height={26} rx={4} fill={["#f6c1d1", "#e86a9a", "#f6c1d1"][i]} />
        ))}
        {aisle === "counter" && !patches && (
          <g>
            <rect x={694} y={562} width={22} height={26} rx={3} fill="#bfe8dc" stroke="#9fd8c8" />
            <circle cx={705} cy={575} r={3} fill="#fff" />
          </g>
        )}
        {aisle === "counter" && world.includes("item_shown") && <ellipse className="glow-once" cx={691} cy={566} rx={50} ry={34} fill={MOON} opacity={0} filter="url(#glow)" />}
      </g>

      {/* your shopping: in the basket, then laid out once he scans it (gone with you after the time skip) */}
      {!timeSkipped &&
        (!scanned ? (
          <g>
            <Item kind="ramen" x={738} y={588} />
            <Item kind="milk" x={796} y={590} />
            {beer && <Item kind="beer" x={822} y={590} />}
            <Item kind="kimbap" x={770} y={596} />
            <path d="M720 560 L882 560 L872 612 L730 612 Z" fill="#d9473b" opacity={0.95} />
            {[740, 764, 788, 812, 836, 860].map((x) => (
              <rect key={x} x={x} y={572} width={14} height={26} rx={3} fill="#a8322a" />
            ))}
            <path d="M736 562 Q801 520 866 562" stroke="#a8322a" strokeWidth={5} fill="none" />
            {patches && <Item kind="patches" x={846} y={624} />}
          </g>
        ) : (
          <g>
            <Item kind="ramen" x={726} y={604} />
            <Item kind="milk" x={786} y={604} />
            {extra && deal === "milk" && <Item kind="milk" x={810} y={604} label={slots.flavor} />}
            {beer && <Item kind="beer" x={deal === "milk" && extra ? 836 : 812} y={604} />}
            <Item kind="bowl" x={724} y={626} />
            <Item kind="kimbap" x={758} y={626} />
            {extra && deal === "kimbap" && <Item kind="kimbap" x={794} y={626} label={slots.flavor} />}
            <Item kind="patches" x={838} y={626} />
            {extra && deal === "patches" && <Item kind="patches" x={844} y={618} label={slots.flavor} />}
            {heated && !paid && <Steam x={776} y={600} scale={0.35} count={2} opacity={0.6} />}
            {extra && <DealMark x={deal === "kimbap" ? 812 : deal === "milk" ? 822 : 862} y={deal === "milk" ? 568 : 600} />}
            {bagged && (
              <g>
                <path d="M716 560 L898 560 L890 628 L724 628 Z" fill={slots.bag === "paper" ? "#c9a274" : "#f4f7f8"} opacity={slots.bag === "paper" ? 1 : 0.82} stroke={slots.bag === "paper" ? "#b08a5c" : "#d5dbe0"} />
                <path d="M752 562 Q770 532 788 562 M826 562 Q844 532 862 562" stroke={slots.bag === "paper" ? "#b08a5c" : "#c9d1d7"} strokeWidth={4} fill="none" />
                <Moon x={800} y={598} s={0.6} color={TEAL} />
              </g>
            )}
          </g>
        ))}

      {/* the card terminal: the total, then a check */}
      <g>
        <rect x={912} y={500} width={84} height={96} rx={10} fill="#2b3140" />
        <rect x={920} y={510} width={68} height={44} rx={4} fill={paid ? "#e9f8f1" : "#eef4f7"} />
        {paid ? (
          <g>
            <circle cx={954} cy={528} r={10} fill={TEAL} />
            <path d="M949 528 L953 532 L960 524" stroke="#fff" strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <text x={954} y={549} textAnchor="middle" fontSize={9} fontWeight={800} fill={TEAL} style={KR}>
              결제 완료
            </text>
          </g>
        ) : scanned ? (
          <g>
            <text x={954} y={526} textAnchor="middle" fontSize={8.5} fill="#6b7385" style={KR}>
              합계
            </text>
            <text x={954} y={545} textAnchor="middle" fontSize={14} fontWeight={900} fill={INK} style={KR}>
              {won(total)}
            </text>
          </g>
        ) : (
          <g>
            <Moon x={946} y={532} s={0.5} color={TEAL} />
            <text x={960} y={537} textAnchor="middle" fontSize={10} fontWeight={900} fill={TEAL}>
              24
            </text>
          </g>
        )}
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={924 + c * 21} y={560 + r * 9} width={16} height={6} rx={2} fill="#4a5262" />),
        )}
        <rect x={926} y={590} width={56} height={4} rx={2} fill={paid ? "#7ff0b0" : "#ffcf7a"} />
        {slots.toppedUp && (
          <g transform="rotate(-8 954 500)">
            <rect x={926} y={470} width={58} height={36} rx={5} fill="#3c7fd1" />
            <rect x={930} y={474} width={18} height={12} rx={2} fill={MOON} opacity={0.85} />
            <text x={955} y={499} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff" style={KR}>
              충전 완료
            </text>
          </g>
        )}
      </g>

      {/* the register (its back), the scanner, the receipt or the bin, Doyun's notebook */}
      <g>
        <rect x={1012} y={470} width={128} height={86} rx={6} fill="#3a4250" />
        <rect x={1060} y={556} width={30} height={40} fill="#3a4250" />
        <rect x={1034} y={584} width={84} height={12} rx={3} fill="#2b3140" />
        <path d="M1150 596 L1158 556 L1176 556 L1182 596 Z" fill="#2b3140" />
        <rect x={1156} y={540} width={22} height={18} rx={4} fill="#3a4250" />
        <rect x={1160} y={552} width={14} height={4} fill={DEAL_RED} opacity={0.8} />
      </g>
      <g>
        <path d="M1000 566 L1030 566 L1027 596 L1003 596 Z" fill="#9aa3ad" />
        {slots.receipt === "no" && <circle cx={1015} cy={563} r={7} fill="#fbfaf5" stroke="#d5dbe0" />}
        {slots.receipt === "yes" && (
          <g transform="rotate(-5 975 610)">
            <rect x={950} y={600} width={46} height={22} fill="#fff" stroke="#e1ddd2" />
            <path d="M955 607 H990 M955 613 H982" stroke="#c9ccd1" strokeWidth={2} />
          </g>
        )}
      </g>
      <g>
        <path d="M1062 600 L1112 594 L1114 612 L1064 618 Z" fill="#fbfaf5" stroke="#e1ddd2" />
        <path d="M1112 594 L1160 600 L1158 618 L1114 612 Z" fill="#f6f4ec" stroke="#e1ddd2" />
        {flags.lyrics ? (
          <g style={KR}>
            <text x={1088} y={606} textAnchor="middle" fontSize={5.5} fill="#5b6b8a" transform="rotate(-6 1088 606)">
              비 오는 밤
            </text>
            <text x={1090} y={613} textAnchor="middle" fontSize={5.5} fill="#5b6b8a" transform="rotate(-6 1090 613)">
              달빛 아래서
            </text>
          </g>
        ) : (
          <path d="M1072 604 L1102 600 M1072 610 L1104 606" stroke="#c9ccd1" strokeWidth={1.4} />
        )}
        <Moon x={1136} y={607} s={0.22} color="#5b6b8a" />
      </g>

      {/* the umbrella he lends you (lost and found) or sells you */}
      {umbrella && (
        <g transform="rotate(10 1036 640)">
          <path d={`M1036 540 L1036 700`} stroke={umbrella === "lent" ? "#2b3140" : "#cfd6e2"} strokeWidth={4} />
          <path d="M1036 540 Q1016 600 1024 660 L1048 660 Q1056 600 1036 540 Z" fill={umbrella === "lent" ? "#2b3140" : "#e8f4ff"} opacity={umbrella === "lent" ? 1 : 0.6} />
          <path d="M1036 700 q0 10 -8 10" stroke={umbrella === "lent" ? "#2b3140" : "#cfd6e2"} strokeWidth={4} fill="none" strokeLinecap="round" />
          {umbrella === "lent" && (
            <g>
              <rect x={1040} y={606} width={34} height={14} rx={2} fill="#fff" />
              <text x={1057} y={616.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill={INK} style={KR}>
                분실물
              </text>
            </g>
          )}
        </g>
      )}

      <rect width={1600} height={900} fill="url(#vignette)" opacity={0.55} style={{ pointerEvents: "none" }} />
    </g>
  );
}

export const MIDNIGHT_NPC = { x: 590, y: 175, scale: 1 };
