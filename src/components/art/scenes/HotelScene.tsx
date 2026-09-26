"use client";

import { useSyncExternalStore } from "react";
import { r2 } from "../shared";
import type { SceneArtProps } from "../types";

function Tile({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={50} height={50} fill="#f3ecdc" />
      <path d="M25 4 L46 25 L25 46 L4 25 Z" fill="#2d5aa6" />
      <circle cx={25} cy={25} r={9} fill="#e3a93b" />
      <path d="M0 0 L10 0 L0 10 Z M50 0 L40 0 L50 10 Z M0 50 L10 50 L0 40 Z M50 50 L40 50 L50 40 Z" fill="#e3a93b" />
      <rect width={50} height={50} fill="none" stroke="#c9bfa8" strokeWidth={1} />
    </g>
  );
}

const subscribeClock = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const clockSnapshot = () => Math.floor(Date.now() / 1000);
const serverClockSnapshot = () => 0;

function Clock() {
  const sec = useSyncExternalStore(subscribeClock, clockSnapshot, serverClockSnapshot);
  const now = sec ? new Date(sec * 1000) : null;
  const s = now?.getSeconds() ?? 0;
  const m = (now?.getMinutes() ?? 10) + s / 60;
  const h = ((now?.getHours() ?? 4) % 12) + m / 60;
  return (
    <g transform="translate(1150 230)">
      <circle r={66} fill="#c9a24b" />
      <circle r={56} fill="#fbf7ee" />
      {[...Array(12)].map((_, i) => (
        <rect key={i} x={-2} y={-52} width={4} height={i % 3 === 0 ? 12 : 7} fill="#3a2a1a" transform={`rotate(${i * 30})`} />
      ))}
      <rect x={-3} y={-30} width={6} height={34} rx={3} fill="#2b1d12" transform={`rotate(${h * 30})`} />
      <rect x={-2} y={-44} width={4} height={48} rx={2} fill="#2b1d12" transform={`rotate(${m * 6})`} />
      <rect x={-1} y={-48} width={2} height={56} fill="#b8261d" transform={`rotate(${s * 6})`} />
      <circle r={5} fill="#2b1d12" />
    </g>
  );
}

export function HotelBack() {
  return (
    <g>
      <defs>
        <linearGradient id="h-patio" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe0f2" />
          <stop offset="1" stopColor="#fff1d6" />
        </linearGradient>
        <linearGradient id="h-brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a7a3a" />
          <stop offset="0.5" stopColor="#e8cf8a" />
          <stop offset="1" stopColor="#8a6a2e" />
        </linearGradient>
        <radialGradient id="h-sun" cx="30%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff3cf" stopOpacity={0.5} />
          <stop offset="1" stopColor="#fff3cf" stopOpacity={0} />
        </radialGradient>
        <clipPath id="h-arch">
          <path d="M80 620 L80 330 Q80 170 250 160 Q420 170 420 330 L420 620 Z" />
        </clipPath>
        <clipPath id="h-lift">
          <rect x={1262} y={250} width={176} height={370} />
        </clipPath>
      </defs>

      <rect width={1600} height={900} fill="#f4ead8" />
      <rect width={1600} height={900} fill="url(#h-sun)" />
      {/* azulejo dado */}
      {[...Array(32)].map((_, i) =>
        [0, 1, 2].map((r) => <Tile key={`${i}-${r}`} x={i * 50} y={470 + r * 50} />),
      )}
      <rect x={0} y={462} width={1600} height={10} fill="#2d5aa6" />

      {/* courtyard through a horseshoe arch */}
      <g clipPath="url(#h-arch)">
        <rect x={80} y={150} width={340} height={470} fill="url(#h-patio)" />
        <rect x={80} y={520} width={340} height={100} fill="#d8c2a0" />
        <g transform="translate(300 360)">
          <rect x={-8} y={0} width={16} height={170} fill="#6b4a2e" />
          <circle cx={0} cy={-10} r={80} fill="#3f7d3a" />
          <circle cx={-50} cy={20} r={50} fill="#4c8c43" />
          <circle cx={46} cy={24} r={54} fill="#35702f" />
          {[...Array(14)].map((_, i) => (
            <circle key={i} cx={r2(Math.cos(i * 2.3) * 60)} cy={r2(Math.sin(i * 1.7) * 50)} r={8} fill="#f29a2e" />
          ))}
        </g>
        <g transform="translate(170 560)">
          <ellipse cx={0} cy={20} rx={80} ry={20} fill="#2d5aa6" />
          <rect x={-80} y={-10} width={160} height={30} fill="#e3a93b" />
          <ellipse cx={0} cy={-10} rx={80} ry={16} fill="#8fc6e0" />
          <rect x={-6} y={-60} width={12} height={50} fill="#d8cdb8" />
          {[0, 1, 2].map((i) => (
            <circle key={i} className="drip" cx={0} cy={-62} r={4} fill="#bfe3f3" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>
      </g>
      <path
        d="M70 630 L70 330 Q70 150 250 140 Q430 150 430 330 L430 630 L410 630 L410 330 Q410 180 250 170 Q90 180 90 330 L90 630 Z"
        fill="#fbf7ee"
      />
      {[...Array(13)].map((_, i) => {
        const a = Math.PI + (i / 12) * Math.PI;
        const x1 = r2(250 + Math.cos(a) * 170);
        const y1 = r2(330 + Math.sin(a) * 175);
        const x2 = r2(250 + Math.cos(a) * 200);
        const y2 = r2(330 + Math.sin(a) * 205);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 ? "#b8423a" : "#f3e6cc"} strokeWidth={24} />;
      })}

      {/* sign */}
      <g style={{ fontFamily: "Georgia, serif" }}>
        <text x={800} y={112} textAnchor="middle" fontSize={46} letterSpacing={10} fontWeight={700} fill="#b08a3a">
          HOTEL AZAHAR
        </text>
        <text x={800} y={140} textAnchor="middle" fontSize={16} letterSpacing={6} fill="#8a6a2e">
          SEVILLA · SANTA CRUZ
        </text>
      </g>

      {/* key cubbies */}
      <rect x={540} y={170} width={520} height={250} rx={6} fill="#5c3a23" />
      {[...Array(4)].map((_, r) =>
        [...Array(8)].map((__, c) => {
          const hasKey = (r * 8 + c) % 3 !== 1;
          return (
            <g key={`${r}-${c}`} transform={`translate(${556 + c * 63} ${184 + r * 58})`}>
              <rect width={54} height={48} rx={3} fill="#3a2416" />
              {hasKey && (
                <g>
                  <line x1={27} y1={6} x2={27} y2={20} stroke="#c9a24b" strokeWidth={2} />
                  <path d="M20 20 L34 20 L30 38 L24 38 Z" fill="url(#h-brass)" />
                </g>
              )}
              <text x={27} y={46} textAnchor="middle" fontSize={9} fill="#c9a24b">
                {(r + 1) * 100 + c + 1}
              </text>
            </g>
          );
        }),
      )}

      <Clock />

      {/* lantern */}
      <g className="sway" style={{ transformOrigin: "480px 0px" }}>
        <line x1={480} y1={0} x2={480} y2={70} stroke="#6b5230" strokeWidth={3} />
        <circle cx={480} cy={120} r={90} fill="#ffcf7a" opacity={0.25} filter="url(#glow)" className="flicker" />
        <path d="M456 76 L504 76 L516 150 L480 174 L444 150 Z" fill="url(#h-brass)" />
        <path d="M462 90 L498 90 L506 146 L480 162 L454 146 Z" fill="#ffd98f" opacity={0.85} />
      </g>

      {/* elevator */}
      <g>
        <rect x={1240} y={200} width={220} height={430} rx={6} fill="#8a6a2e" />
        <rect x={1262} y={250} width={176} height={370} fill="#fff1c7" />
        <g clipPath="url(#h-lift)">
          <g className="lift-left">
            <rect x={1262} y={250} width={88} height={370} fill="url(#h-brass)" />
          </g>
          <g className="lift-right">
            <rect x={1350} y={250} width={88} height={370} fill="url(#h-brass)" />
          </g>
        </g>
        <line x1={1350} y1={250} x2={1350} y2={620} stroke="#6b5230" strokeWidth={2} opacity={0.4} />
        <rect x={1320} y={214} width={60} height={26} rx={4} fill="#1d1d1d" />
        <text x={1350} y={234} textAnchor="middle" fontSize={18} fontWeight={700} fill="#ffb347">
          ▲ 3
        </text>
      </g>

      {/* palm */}
      <g transform="translate(1530 630)">
        <rect x={-44} y={-70} width={88} height={80} rx={8} fill="#2d5aa6" />
        {[...Array(8)].map((_, i) => (
          <path key={i} d={`M0 -70 Q${r2(Math.cos(i) * 90)} ${-200 - (i % 3) * 20} ${r2(Math.cos(i * 0.9) * 140)} ${-150 - (i % 2) * 40}`} stroke="#3d7a3c" strokeWidth={14} fill="none" strokeLinecap="round" />
        ))}
      </g>
    </g>
  );
}

export function HotelFront({ world }: SceneArtProps) {
  const passport = world.includes("passport_given");
  const key = world.includes("key_handed");
  const issue = world.includes("issue_found");
  return (
    <g>
      <defs>
        <linearGradient id="h-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3521" />
          <stop offset="1" stopColor="#2e1a10" />
        </linearGradient>
        <linearGradient id="h-marble" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf6ec" />
          <stop offset="1" stopColor="#ddd2bf" />
        </linearGradient>
      </defs>
      {/* monitor (back side, faces Lucía) */}
      <g transform="translate(980 470)">
        <rect x={0} y={0} width={170} height={120} rx={10} fill="#2b2d31" />
        <rect x={70} y={120} width={30} height={30} fill="#3a3c41" />
        <circle cx={85} cy={60} r={10} fill="#3a3c41" />
      </g>
      <rect x={0} y={612} width={1600} height={50} fill="url(#h-marble)" />
      {[...Array(8)].map((_, i) => (
        <path key={i} d={`M${i * 200} 620 q60 14 120 4 t100 20`} stroke="#c9bca5" strokeWidth={2} fill="none" opacity={0.6} />
      ))}
      <rect x={0} y={660} width={1600} height={240} fill="url(#h-desk)" />
      {[...Array(6)].map((_, i) => (
        <rect key={i} x={30 + i * 262} y={690} width={230} height={180} rx={8} fill="none" stroke="#1f120a" strokeWidth={6} opacity={0.6} />
      ))}
      <g transform="translate(800 760)">
        <rect x={-110} y={-24} width={220} height={48} rx={6} fill="url(#h-brass)" />
        <text x={0} y={8} textAnchor="middle" fontSize={22} letterSpacing={4} fontWeight={700} fill="#3a2a10" style={{ fontFamily: "Georgia, serif" }}>
          RECEPCIÓN
        </text>
      </g>

      {/* service bell & brochures */}
      <g transform="translate(360 612)">
        <ellipse cx={0} cy={0} rx={44} ry={10} fill="#6b5230" />
        <path d="M-34 0 Q-34 -44 0 -46 Q34 -44 34 0 Z" fill="url(#h-brass)" />
        <rect x={-4} y={-58} width={8} height={14} rx={3} fill="#8a6a2e" />
      </g>
      <g transform="translate(180 560)">
        <rect x={0} y={0} width={110} height={54} rx={4} fill="#3a2416" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={8 + i * 34} y={-40} width={28} height={50} rx={2} fill={["#2d5aa6", "#e3a93b", "#b8423a"][i]} />
        ))}
      </g>
      <g transform="translate(1330 612)">
        <path d="M-24 0 L-18 -50 L18 -50 L24 0 Z" fill="#2d5aa6" />
        {[...Array(9)].map((_, i) => (
          <circle key={i} cx={-24 + (i % 3) * 24} cy={-70 - Math.floor(i / 3) * 18} r={11} fill={i % 2 ? "#fbf7ee" : "#f7d8e0"} />
        ))}
      </g>
      {issue && !key && (
        <g transform="translate(960 616)">
          <path d="M8 0 L150 0 L160 34 L0 34 Z" fill="#fffdf6" stroke="#d6cbb4" />
          <text x={24} y={16} fontSize={11} fill="#555">
            Reserva #4827
          </text>
          <rect x={22} y={22} width={110} height={4} fill="#ddd" />
        </g>
      )}
      {passport && (
        <g transform="translate(470 618)">
          <path d="M10 0 L100 0 L112 34 L0 34 Z" fill="#6d1f2c" />
          <ellipse cx={56} cy={14} rx={12} ry={6} fill="none" stroke="#d9b55c" strokeWidth={2} />
          <text x={56} y={30} textAnchor="middle" fontSize={8} letterSpacing={2} fill="#d9b55c">
            PASSPORT
          </text>
        </g>
      )}
      {key && (
        <g transform="translate(1180 618)">
          <path d="M8 0 L112 0 L122 36 L0 36 Z" fill="#fbf7ee" stroke="#d9c7a0" strokeWidth={2} />
          <path d="M20 6 L102 6 L108 30 L14 30 Z" fill="#2d5aa6" />
          <text x={61} y={24} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fbf7ee" style={{ fontFamily: "Georgia, serif" }}>
            AZAHAR
          </text>
        </g>
      )}
      <rect width={1600} height={900} fill="url(#vignette)" style={{ pointerEvents: "none" }} />
    </g>
  );
}

export const HOTEL_NPC = { x: 590, y: 160, scale: 1.02 };
