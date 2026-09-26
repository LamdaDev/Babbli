"use client";

import { motion, type TargetAndTransition, type Transition } from "framer-motion";
import { useEffect, useRef } from "react";
import type { CharacterLook, NpcExpression, NpcPose } from "@/lib/scenarios/types";

/**
 * Layered vector NPC (viewBox-local coordinates: 420 × 560, neck at ~210,262).
 * Mouth openness follows live audio amplitude (ElevenAgents output volume or the
 * ElevenLabs TTS analyser) — cheap pseudo lip-sync without phoneme alignment.
 */
interface Props {
  look: CharacterLook;
  pose: NpcPose;
  expression: NpcExpression;
  name: string;
  getLevel: () => number;
  listeningLevel?: () => number;
}

const bodyAnim: Record<NpcPose, TargetAndTransition> = {
  idle: { y: [0, -3, 0], rotate: 0, transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } },
  speaking: { y: [0, -2.5, 0], rotate: 0, transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" } },
  listening: { y: 5, rotate: 1.2, transition: { type: "spring", stiffness: 60, damping: 14 } },
  thinking: { y: [2, 0, 2], rotate: -0.6, transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } },
};

function headAnim(pose: NpcPose, expression: NpcExpression): TargetAndTransition {
  if (expression === "confused") return { rotate: 7, y: 2, transition: { type: "spring", stiffness: 90, damping: 10 } };
  if (expression === "positive" && pose !== "speaking")
    return { rotate: [0, -3, 0], y: [0, -6, 0], transition: { duration: 0.6, ease: "easeOut" } };
  if (pose === "thinking") return { rotate: -5, y: 0, transition: { type: "spring", stiffness: 60, damping: 12 } };
  if (pose === "listening") return { rotate: 3.5, y: 3, transition: { type: "spring", stiffness: 60, damping: 12 } };
  if (pose === "speaking")
    return { rotate: [-1.4, 1.4, -1.4], y: 0, transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" } as Transition };
  return { rotate: 0, y: 0, transition: { type: "spring", stiffness: 50, damping: 14 } };
}

export function Character({ look, pose, expression, name, getLevel, listeningLevel }: Props) {
  const mouths = useRef<(SVGGElement | null)[]>([]);
  const headRef = useRef<SVGGElement | null>(null);
  const smoothed = useRef(0);

  // Drive the mouth + a subtle nod from audio levels without re-rendering React.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const target = pose === "speaking" ? getLevel() : 0;
      smoothed.current += (target - smoothed.current) * 0.45;
      const v = smoothed.current;
      const open = pose !== "speaking" ? 0 : v < 0.06 ? 0 : v < 0.2 ? 1 : v < 0.42 ? 2 : 3;
      mouths.current.forEach((m, i) => {
        if (m) m.style.opacity = i === open ? "1" : "0";
      });
      if (headRef.current) {
        const nod = pose === "listening" && listeningLevel ? Math.min(1, listeningLevel() * 2) * 3 : 0;
        headRef.current.style.transform = `translateY(${nod.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pose, getLevel, listeningLevel]);

  const happy = expression === "positive";
  const confused = expression === "confused";
  const eyeLook = pose === "thinking" ? { x: 4, y: -5 } : { x: 0, y: 0 };

  return (
    <motion.g animate={bodyAnim[pose]} style={{ originX: "50%", originY: "100%" }}>
      {/* back hair for bob / bun */}
      {look.hairStyle === "bob" && (
        <path d="M118 170 Q112 80 210 70 Q308 80 302 170 L308 262 Q300 282 270 276 L150 276 Q120 282 112 262 Z" fill={look.hair} />
      )}
      {look.hairStyle === "bun" && <circle cx={210} cy={74} r={36} fill={look.hair} />}

      {/* torso */}
      <path d="M52 560 L64 372 Q74 312 150 296 L270 296 Q346 312 356 372 L368 560 Z" fill={look.outfit} />
      <path d="M270 296 Q346 312 356 372 L368 560 L300 560 Q318 420 270 296 Z" fill={look.outfitShade} opacity={0.8} />
      <rect x={186} y={246} width={48} height={60} rx={14} fill={look.skinShade} />

      {look.accessory === "headband" && (
        <g>
          <path d="M176 298 L210 362 L244 298 Z" fill={look.accent} />
          <path d="M150 296 L210 380 L150 560" stroke={look.outfitShade} strokeWidth={10} fill="none" />
          <path d="M270 296 L210 380" stroke={look.outfitShade} strokeWidth={10} fill="none" />
          {look.apron && (
            <>
              <path d="M84 440 L336 440 L352 560 L68 560 Z" fill={look.apron} />
              <rect x={84} y={436} width={252} height={10} rx={4} fill="#1c130e" opacity={0.55} />
              <text x={210} y={510} textAnchor="middle" fontSize={34} fill="#e9dcc7" opacity={0.85} style={{ fontFamily: "var(--font-jp)" }}>
                ほし
              </text>
            </>
          )}
        </g>
      )}
      {look.accessory === "scarf" && (
        <g>
          {look.apron && (
            <>
              <path d="M130 360 L290 360 L312 560 L108 560 Z" fill={look.apron} />
              <path d="M150 360 L166 300 M270 360 L254 300" stroke={look.apron} strokeWidth={10} />
              <rect x={164} y={410} width={92} height={50} rx={8} fill="none" stroke="#d9cfbf" strokeWidth={3} />
            </>
          )}
          <path d="M178 296 Q210 330 242 296 L236 318 Q210 338 184 318 Z" fill={look.accent} />
          <path d="M206 320 L190 360 L208 350 L214 364 L222 322 Z" fill={look.accent} />
        </g>
      )}
      {look.accessory === "badge" && (
        <g>
          <path d="M178 298 L210 360 L242 298 L232 296 L210 334 L188 296 Z" fill="#f6f1ea" />
          <path d="M150 296 L200 420 L176 430 L128 330 Z" fill={look.outfitShade} />
          <path d="M270 296 L220 420 L244 430 L292 330 Z" fill={look.outfitShade} />
          <rect x={98} y={392} width={74} height={24} rx={5} fill={look.accent} />
          <text x={135} y={409} textAnchor="middle" fontSize={14} fontWeight={700} fill="#3a2a10">
            {name}
          </text>
        </g>
      )}

      {/* gesture hand while speaking / thinking */}
      <motion.g
        initial={false}
        animate={
          pose === "speaking"
            ? { y: [0, -14, 0], x: 0, opacity: 1, transition: { duration: 1.3, repeat: Infinity, ease: "easeInOut" } }
            : pose === "thinking"
              ? { y: -168, x: -50, opacity: 1, transition: { type: "spring", stiffness: 70, damping: 14 } }
              : { y: 60, x: 0, opacity: 0, transition: { duration: 0.35 } }
        }
      >
        <path d="M300 560 Q312 470 330 452 L356 460 Q350 500 340 560 Z" fill={look.outfit} />
        <ellipse cx={342} cy={446} rx={24} ry={20} fill={look.skin} />
        <path d="M324 436 Q330 420 340 426 M338 430 Q344 414 354 422" stroke={look.skinShade} strokeWidth={5} strokeLinecap="round" fill="none" />
      </motion.g>

      {/* head */}
      <motion.g animate={headAnim(pose, expression)} style={{ originX: "50%", originY: "92%" }}>
        <g ref={headRef}>
          <ellipse cx={134} cy={186} rx={16} ry={22} fill={look.skinShade} />
          <ellipse cx={286} cy={186} rx={16} ry={22} fill={look.skinShade} />
          <ellipse cx={210} cy={176} rx={80} ry={94} fill={look.skin} />
          <ellipse cx={168} cy={218} rx={17} ry={10} fill="#ff8f86" opacity={happy ? 0.55 : 0.3} />
          <ellipse cx={252} cy={218} rx={17} ry={10} fill="#ff8f86" opacity={happy ? 0.55 : 0.3} />

          {/* hair front */}
          {look.hairStyle === "short" && (
            <path d="M128 172 Q120 86 210 78 Q300 86 292 172 Q284 128 256 118 Q214 104 170 118 Q138 130 128 172 Z" fill={look.hair} />
          )}
          {look.hairStyle === "bob" && (
            <path d="M126 196 Q118 92 210 84 Q302 92 294 196 Q290 150 270 138 Q240 150 208 132 Q176 152 148 142 Q130 156 126 196 Z" fill={look.hair} />
          )}
          {look.hairStyle === "bun" && (
            <path d="M128 176 Q122 92 210 84 Q298 92 292 176 Q280 124 248 116 Q210 108 172 116 Q140 124 128 176 Z" fill={look.hair} />
          )}
          {look.accessory === "headband" && (
            <g>
              <path d="M128 142 Q210 110 292 142 L292 164 Q210 132 128 164 Z" fill={look.accent} />
              <path d="M286 146 L318 128 L312 150 L322 170 L290 160 Z" fill={look.accent} />
              <path d="M140 150 Q210 128 280 150" stroke="#d8cfc0" strokeWidth={2} fill="none" />
            </g>
          )}
          {look.accessory === "badge" && <circle cx={284} cy={206} r={5} fill={look.accent} />}

          {/* brows */}
          <g stroke={look.hair} strokeWidth={7} strokeLinecap="round" fill="none">
            {confused ? (
              <>
                <path d="M160 150 Q178 138 196 146" />
                <path d="M226 158 Q244 156 262 162" />
              </>
            ) : happy || pose === "listening" ? (
              <>
                <path d="M160 152 Q178 140 196 150" />
                <path d="M224 150 Q242 140 260 152" />
              </>
            ) : pose === "thinking" ? (
              <>
                <path d="M160 158 Q178 152 196 156" />
                <path d="M224 150 Q242 144 260 150" />
              </>
            ) : (
              <>
                <path d="M160 158 Q178 150 196 156" />
                <path d="M224 156 Q242 150 260 158" />
              </>
            )}
          </g>

          {/* eyes */}
          {happy ? (
            <g stroke={look.eyes} strokeWidth={6} strokeLinecap="round" fill="none">
              <path d="M166 190 Q178 176 190 190" />
              <path d="M230 190 Q242 176 254 190" />
            </g>
          ) : (
            <g className="npc-blink" style={{ transformOrigin: "210px 186px" }}>
              <ellipse cx={178 + eyeLook.x} cy={186 + eyeLook.y} rx={confused ? 8 : 9.5} ry={confused ? 10 : 12.5} fill={look.eyes} />
              <ellipse cx={242 + eyeLook.x} cy={186 + eyeLook.y} rx={9.5} ry={12.5} fill={look.eyes} />
              <circle cx={181 + eyeLook.x} cy={181 + eyeLook.y} r={3.4} fill="#fff" />
              <circle cx={245 + eyeLook.x} cy={181 + eyeLook.y} r={3.4} fill="#fff" />
            </g>
          )}
          <path d="M206 200 Q214 214 204 218" stroke={look.skinShade} strokeWidth={4} strokeLinecap="round" fill="none" />

          {/* mouths: 0 closed … 3 wide open (amplitude-driven) */}
          <g ref={(el) => void (mouths.current[0] = el)}>
            {happy ? (
              <path d="M186 234 Q210 266 234 234 Z" fill="#8c2f2a" stroke="#6d201c" strokeWidth={2} />
            ) : confused ? (
              <path d="M194 242 q6 -6 12 0 t12 0" stroke="#6d201c" strokeWidth={4} fill="none" strokeLinecap="round" />
            ) : (
              <path d="M192 238 Q210 250 228 238" stroke="#6d201c" strokeWidth={4.5} fill="none" strokeLinecap="round" />
            )}
          </g>
          <g ref={(el) => void (mouths.current[1] = el)} style={{ opacity: 0 }}>
            <ellipse cx={210} cy={241} rx={10} ry={5} fill="#7a2521" />
          </g>
          <g ref={(el) => void (mouths.current[2] = el)} style={{ opacity: 0 }}>
            <ellipse cx={210} cy={242} rx={13} ry={9} fill="#7a2521" />
            <ellipse cx={210} cy={247} rx={7} ry={3.5} fill="#e0736b" />
          </g>
          <g ref={(el) => void (mouths.current[3] = el)} style={{ opacity: 0 }}>
            <ellipse cx={210} cy={243} rx={16} ry={13} fill="#7a2521" />
            <rect x={198} y={231} width={24} height={5} rx={2} fill="#fff" opacity={0.9} />
            <ellipse cx={210} cy={250} rx={9} ry={4.5} fill="#e0736b" />
          </g>
        </g>
      </motion.g>

      {/* state bubbles */}
      {pose === "thinking" && (
        <g transform="translate(300 40)">
          <ellipse cx={40} cy={30} rx={46} ry={30} fill="#fffaf0" opacity={0.95} />
          <circle cx={4} cy={70} r={8} fill="#fffaf0" opacity={0.9} />
          {[0, 1, 2].map((i) => (
            <circle key={i} className="think-dot" cx={20 + i * 20} cy={30} r={6} fill="#6a5a4a" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </g>
      )}
      {confused && pose !== "thinking" && (
        <text x={318} y={92} fontSize={64} fontWeight={800} fill="#fff4d6" stroke="#6a4b2a" strokeWidth={3} className="float-q">
          ?
        </text>
      )}
      {happy && (
        <g className="sparkle" fill="#ffe08a">
          <path d="M92 70 l6 16 l16 6 l-16 6 l-6 16 l-6 -16 l-16 -6 l16 -6 Z" />
          <path d="M330 110 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" />
        </g>
      )}
    </motion.g>
  );
}
