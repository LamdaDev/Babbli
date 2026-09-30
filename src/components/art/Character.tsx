"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";
import type { CharacterLook, HairStyle, NpcExpression, NpcPose } from "@/lib/scenarios/types";

/**
 * Layered vector NPC (viewBox-local coordinates: 420 × 560, neck at ~210,262).
 * Mouth openness follows live audio amplitude (ElevenAgents output volume or the
 * ElevenLabs TTS analyser) — cheap pseudo lip-sync without phoneme alignment.
 *
 * All movement runs in one animation-frame loop. A pose change only moves spring targets, and the
 * idle bob, head sway and talking gesture are continuous waves whose size eases in and out — so the
 * pose can change at any moment (even several times a second) without anything jumping, restarting
 * or looping back. Hair drawn behind the head (bob, bun, ponytail) turns with the head, and a
 * ponytail also swings a little on its own, a beat behind the head.
 */
interface Props {
  look: CharacterLook;
  pose: NpcPose;
  expression: NpcExpression;
  name: string;
  getLevel: () => number;
  listeningLevel?: () => number;
}

/** Where each part rests in a pose, and how much it moves there. */
interface PoseTargets {
  bodyY: number;
  bodyRotate: number;
  /** Breathing / talking bob: height (px) and period (s). */
  bob: number;
  bobPeriod: number;
  headRotate: number;
  headY: number;
  /** Head sway while talking (degrees). */
  sway: number;
  handX: number;
  handY: number;
  handOpacity: number;
  /** Talking gesture: how far the hand lifts (px). */
  gesture: number;
}

const POSES: Record<NpcPose, PoseTargets> = {
  idle: { bodyY: 0, bodyRotate: 0, bob: 3, bobPeriod: 4, headRotate: 0, headY: 0, sway: 0, handX: 0, handY: 60, handOpacity: 0, gesture: 0 },
  speaking: { bodyY: 0, bodyRotate: 0, bob: 2.5, bobPeriod: 0.7, headRotate: 0, headY: 0, sway: 1.4, handX: 0, handY: 0, handOpacity: 1, gesture: 14 },
  listening: { bodyY: 5, bodyRotate: 1.2, bob: 0, bobPeriod: 4, headRotate: 3.5, headY: 3, sway: 0, handX: 0, handY: 60, handOpacity: 0, gesture: 0 },
  thinking: { bodyY: 2, bodyRotate: -0.6, bob: 2, bobPeriod: 2.4, headRotate: -5, headY: 0, sway: 0, handX: -50, handY: -168, handOpacity: 1, gesture: 0 },
};

/** The head turns around the chin and the body around its base (viewBox-local points). */
const HEAD_PIVOT = "210 255";
const BODY_PIVOT = "210 560";
/** A ponytail swings from its tie, high on the back of the head. */
const TAIL_PIVOT = "230 86";
/** A slender build: the torso and everything worn on it, 12% narrower around the body's centre line. */
const SLENDER = "translate(25.2 0) scale(0.88 1)";
const TAU = Math.PI * 2;

/** Hair drawn behind the head and neck (turns with the head). Shared with the learner avatar. */
export function HairBack({ style, color, tailRef }: { style: HairStyle; color: string; tailRef?: Ref<SVGGElement> }) {
  if (style === "bob") return <path d="M118 170 Q112 80 210 70 Q308 80 302 170 L308 262 Q300 282 270 276 L150 276 Q120 282 112 262 Z" fill={color} />;
  if (style === "long") return <path d="M116 176 Q106 76 210 66 Q314 76 304 176 L314 334 Q308 360 280 356 L140 356 Q112 360 106 334 Z" fill={color} />;
  if (style === "bun") return <circle cx={210} cy={74} r={36} fill={color} />;
  if (style === "ponytail") return <Ponytail color={color} tailRef={tailRef} />;
  return null;
}

/**
 * A high ponytail: tied at the crown, the tail rises over the top of the head, then falls behind it
 * to one side and down past the shoulder (the torso covers its tip). It pivots at the tie.
 */
function Ponytail({ color, tailRef }: { color: string; tailRef?: Ref<SVGGElement> }) {
  return (
    <g ref={tailRef}>
      <path d="M212 84 Q224 52 262 48 Q304 46 322 88 Q336 124 332 176 Q328 232 318 272 Q312 298 326 322 Q296 318 292 282 Q288 250 290 200 Q292 150 280 118 Q264 92 232 94 Z" fill={color} />
      <path d="M298 72 Q320 98 320 146" stroke="#fff" strokeOpacity={0.12} strokeWidth={5} fill="none" strokeLinecap="round" />
      <ellipse cx={230} cy={86} rx={13} ry={9} fill="#000" opacity={0.28} transform="rotate(-32 230 86)" />
    </g>
  );
}

/**
 * Wispy see-through bangs (空气刘海): thin strands that touch at the hairline and fan apart towards
 * the brows, parted just off-centre, so the forehead shows between them. [root x, tip x, tip y]
 */
const BANGS = [
  [170, 162, 130],
  [180, 173, 138],
  [191, 186, 143],
  [202, 199, 146],
  [216, 220, 145],
  [227, 233, 142],
  [238, 245, 137],
  [249, 257, 130],
] as const;

/** Hair pulled back sleek into a high ponytail, with air bangs and a face-framing strand on each side. */
function PonytailFront({ color }: { color: string }) {
  return (
    <g fill={color}>
      <path d="M127 182 Q118 92 210 82 Q302 92 293 182 Q288 136 262 120 Q236 110 210 110 Q184 110 158 120 Q132 136 127 182 Z" />
      {BANGS.map(([x, tx, ty]) => (
        <path key={x} d={`M${x - 4.5} 106 Q${x - 2} ${ty - 10} ${tx} ${ty} Q${x + 3} ${ty - 12} ${x + 4.5} 106 Z`} />
      ))}
      <path d="M130 146 Q122 188 138 226 Q133 186 143 150 Z" />
      <path d="M290 146 Q298 188 282 226 Q287 186 277 150 Z" />
      <g fill="#fff" opacity={0.16}>
        <ellipse cx={168} cy={98} rx={15} ry={5} transform="rotate(-26 168 98)" />
        <ellipse cx={252} cy={98} rx={15} ry={5} transform="rotate(26 252 98)" />
      </g>
    </g>
  );
}

/** Draws its children with a slender build when asked (and exactly as before otherwise). */
function Build({ slender, children }: { slender: boolean; children: ReactNode }) {
  return slender ? <g transform={SLENDER}>{children}</g> : <>{children}</>;
}

/** The headset look from the neck down: a crew-neck tee under a bib apron with the shop's monogram and a name badge. */
function HeadsetBody({ look, name }: { look: CharacterLook; name: string }) {
  return (
    <g>
      <path d="M180 299 Q210 318 240 299" stroke={look.outfitShade} strokeWidth={7} fill="none" strokeLinecap="round" />
      {look.apron && (
        <>
          <path d="M152 346 L180 302 M268 346 L240 302" stroke={look.apron} strokeWidth={9} strokeLinecap="round" />
          <path d="M132 362 Q132 344 150 344 L270 344 Q288 344 288 362 L312 560 L108 560 Z" fill={look.apron} />
          {look.apronMark && (
            <g>
              <circle cx={210} cy={398} r={22} fill="none" stroke={look.accent} strokeWidth={3} />
              <text x={210} y={408} textAnchor="middle" fontSize={26} fontWeight={700} fill={look.accent} style={{ fontFamily: "var(--font-sc)" }}>
                {look.apronMark}
              </text>
            </g>
          )}
        </>
      )}
      <rect x={138} y={356} width={46} height={20} rx={4} fill="#fbfaf7" />
      <rect x={138} y={356} width={7} height={20} rx={3} fill={look.accent} />
      <text x={165} y={371} textAnchor="middle" fontSize={12} fontWeight={800} fill="#1d1d1f" style={{ fontFamily: "var(--font-sc)" }}>
        {look.badgeText ?? name}
      </text>
    </g>
  );
}

/** A slim black headset over the hair: one ear cup and a mic boom by the mouth (busy tea shops use them). */
function Headset() {
  return (
    <g>
      <path d="M131 178 Q122 90 210 80 Q298 90 289 178" stroke="#1d1d1f" strokeWidth={5} fill="none" strokeLinecap="round" />
      <rect x={116} y={166} width={24} height={38} rx={10} fill="#1d1d1f" />
      <rect x={121} y={172} width={6} height={20} rx={3} fill="#fff" opacity={0.18} />
      <path d="M130 200 Q133 240 170 246" stroke="#1d1d1f" strokeWidth={4} fill="none" strokeLinecap="round" />
      <ellipse cx={175} cy={246} rx={7} ry={5} fill="#2c2c2e" />
    </g>
  );
}

/**
 * Middle part: a rounded cap parted at the centre, the fringe framing the forehead in an arch, and
 * full sides that cover the ears down to the cheeks, with a soft shine on top.
 */
function MiddlePart({ color }: { color: string }) {
  return (
    <g>
      <path
        d="M128 228 Q108 200 110 158 Q110 74 204 64 Q210 72 216 64 Q310 74 310 158 Q312 200 292 228 Q298 206 288 182 Q250 128 210 104 Q170 128 132 182 Q122 206 128 228 Z"
        fill={color}
      />
      <path d="M200 74 Q164 90 146 140 M220 74 Q256 90 274 140" stroke="#000" strokeOpacity={0.14} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M210 70 L210 102" stroke="#000" strokeOpacity={0.22} strokeWidth={2.5} strokeLinecap="round" />
      <g fill="#fff" opacity={0.16}>
        <ellipse cx={156} cy={90} rx={14} ry={5.5} transform="rotate(-32 156 90)" />
        <ellipse cx={264} cy={90} rx={14} ry={5.5} transform="rotate(32 264 90)" />
      </g>
    </g>
  );
}

/** Hair over the forehead. Shared with the learner avatar. */
export function HairFront({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "short":
      return <path d="M128 172 Q120 86 210 78 Q300 86 292 172 Q284 128 256 118 Q214 104 170 118 Q138 130 128 172 Z" fill={color} />;
    case "buzz":
      return <path d="M131 160 Q126 92 210 86 Q294 92 289 160 Q282 120 210 112 Q138 120 131 160 Z" fill={color} opacity={0.92} />;
    case "middle":
      return <MiddlePart color={color} />;
    case "bob":
    case "long":
      return <path d="M126 196 Q118 92 210 84 Q302 92 294 196 Q290 150 270 138 Q240 150 208 132 Q176 152 148 142 Q130 156 126 196 Z" fill={color} />;
    case "bun":
      return <path d="M128 176 Q122 92 210 84 Q298 92 292 176 Q280 124 248 116 Q210 108 172 116 Q140 124 128 176 Z" fill={color} />;
    case "ponytail":
      return <PonytailFront color={color} />;
    case "curly":
      return (
        <g fill={color}>
          <path d="M132 160 Q128 100 210 90 Q292 100 288 160 Q276 124 210 118 Q144 124 132 160 Z" />
          {[
            [140, 128, 22],
            [158, 104, 26],
            [188, 88, 28],
            [222, 86, 28],
            [254, 98, 26],
            [278, 122, 22],
            [288, 150, 14],
            [132, 152, 14],
            [206, 110, 22],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
  }
}

/** A damped spring that always continues from where it is (and how fast it's moving). */
class Spring {
  value: number;
  private velocity = 0;
  constructor(
    initial: number,
    private stiffness: number,
    private damping: number,
  ) {
    this.value = initial;
  }
  step(target: number, dt: number) {
    // Small fixed substeps: a long frame lands where the real spring would be, without overshooting.
    const n = Math.ceil(dt / 0.008);
    for (let i = 0; i < n; i++) {
      this.velocity += (this.stiffness * (target - this.value) - this.damping * this.velocity) * (dt / n);
      this.value += this.velocity * (dt / n);
    }
    return this.value;
  }
}

/** 0 → 1 → 0 over one period, starting and ending at rest (no jump when it starts or stops). */
const wave = (phase: number) => (1 - Math.cos(phase)) / 2;

export function Character({ look, pose, expression, name, getLevel, listeningLevel }: Props) {
  const mouths = useRef<(SVGGElement | null)[]>([]);
  const bodyRef = useRef<SVGGElement | null>(null);
  const headBackRef = useRef<SVGGElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const handRef = useRef<SVGGElement | null>(null);
  const tailRef = useRef<SVGGElement | null>(null);
  const live = useRef({ pose, expression, hopAt: -Infinity });

  // The loop reads the latest pose; a happy reaction (not mid-sentence) adds a little hop.
  useEffect(() => {
    const s = live.current;
    if (expression === "positive" && s.expression !== "positive" && pose !== "speaking") s.hopAt = performance.now();
    s.pose = pose;
    s.expression = expression;
  }, [pose, expression]);

  // Drive every moving part (and the mouth) from one loop without re-rendering React.
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const body = { y: new Spring(0, 60, 14), rotate: new Spring(0, 60, 14), bob: new Spring(3, 20, 9), bobHz: new Spring(0.25, 20, 9) };
    const head = { y: new Spring(0, 70, 13), rotate: new Spring(0, 70, 13), sway: new Spring(0, 20, 9), nod: new Spring(0, 90, 16) };
    const hand = { x: new Spring(0, 90, 18), y: new Spring(60, 90, 18), opacity: new Spring(0, 90, 19), lift: new Spring(0, 30, 11) };
    const tail = new Spring(1, 20, 9);
    const phase = { bob: 0, sway: 0, gesture: 0 };
    let mouthLevel = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const { pose, expression, hopAt } = live.current;
      const t = POSES[pose];
      const motion = calm ? 0 : 1;

      // Body: rests per pose, with a bob whose size and speed ease between poses.
      phase.bob = (phase.bob + TAU * body.bobHz.step(1 / t.bobPeriod, dt) * dt) % TAU;
      const bodyY = body.y.step(t.bodyY, dt) - body.bob.step(t.bob * motion, dt) * wave(phase.bob);
      const bodyRotate = body.rotate.step(t.bodyRotate, dt);
      bodyRef.current?.setAttribute("transform", `translate(0 ${bodyY.toFixed(2)}) rotate(${bodyRotate.toFixed(3)} ${BODY_PIVOT})`);

      // Head: tilts with the pose (a confused tilt wins), sways while talking, nods along while listening.
      const confused = expression === "confused";
      phase.sway = (phase.sway + (TAU / 1.6) * dt) % TAU;
      const sway = head.sway.step(t.sway * motion, dt) * Math.sin(phase.sway);
      const hop = Math.sin(Math.PI * Math.min(1, Math.max(0, (now - hopAt) / 600))) * motion;
      const heard = pose === "listening" && listeningLevel ? Math.min(1, listeningLevel() * 2) * 3 : 0;
      const headY = head.y.step(confused ? 2 : t.headY, dt) + head.nod.step(heard * motion, dt) - hop * 6;
      const headRotate = head.rotate.step(confused ? 7 : t.headRotate, dt) + sway - hop * 3;
      const headTransform = `translate(0 ${headY.toFixed(2)}) rotate(${headRotate.toFixed(3)} ${HEAD_PIVOT})`;
      headRef.current?.setAttribute("transform", headTransform);
      headBackRef.current?.setAttribute("transform", headTransform);
      // Ponytail: a gentle swing from the tie, wider while talking, lagging the head's sway.
      if (tailRef.current) {
        const swing = tail.step((pose === "speaking" ? 2.6 : 1) * motion, dt) * Math.sin(phase.sway - 0.9) + hop * 5;
        tailRef.current.setAttribute("transform", `rotate(${swing.toFixed(3)} ${TAIL_PIVOT})`);
      }

      // Gesturing hand: glides between the side (talking), the chin (thinking) and out of view.
      phase.gesture = (phase.gesture + (TAU / 1.3) * dt) % TAU;
      const lift = hand.lift.step(t.gesture * motion, dt) * wave(phase.gesture);
      const handX = hand.x.step(t.handX, dt);
      const handY = hand.y.step(t.handY, dt) - lift;
      const handOpacity = Math.min(1, Math.max(0, hand.opacity.step(t.handOpacity, dt)));
      handRef.current?.setAttribute("transform", `translate(${handX.toFixed(2)} ${handY.toFixed(2)})`);
      handRef.current?.setAttribute("opacity", handOpacity.toFixed(3));

      // Mouth: follows the voice amplitude while speaking.
      const target = pose === "speaking" ? getLevel() : 0;
      mouthLevel += (target - mouthLevel) * 0.45;
      const open = pose !== "speaking" ? 0 : mouthLevel < 0.06 ? 0 : mouthLevel < 0.2 ? 1 : mouthLevel < 0.42 ? 2 : 3;
      mouths.current.forEach((m, i) => {
        if (m) m.style.opacity = i === open ? "1" : "0";
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLevel, listeningLevel]);

  const happy = expression === "positive";
  const confused = expression === "confused";
  const eyeLook = pose === "thinking" ? { x: 4, y: -5 } : { x: 0, y: 0 };
  const slender = look.build === "slender";
  const lips = look.makeup?.lips ?? "#6d201c";
  const blush = look.makeup?.blush ?? "#ff8f86";

  return (
    <g ref={bodyRef}>
      {/* back hair for bob / bun / ponytail: behind the neck and torso, but turning with the head */}
      <g ref={headBackRef}>
        <HairBack style={look.hairStyle} color={look.hair} tailRef={tailRef} />
      </g>

      <Build slender={slender}>
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
        {look.accessory === "lanyard" && (
          <g>
            {/* collared shirt under a store cardigan, with a staff lanyard + ID card */}
            <path d="M176 296 L210 352 L244 296 Z" fill="#eef2f1" />
            <path d="M176 296 L196 334 L206 316 Z M244 296 L224 334 L214 316 Z" fill="#dfe6e4" />
            <path d="M160 300 L204 440 M260 300 L216 440" stroke={look.outfitShade} strokeWidth={8} />
            <path d="M184 302 L204 418 M236 302 L216 418" stroke={look.accent} strokeWidth={6} strokeLinecap="round" />
            <rect x={184} y={412} width={52} height={66} rx={7} fill="#fbf8f2" stroke="#d9d2c4" strokeWidth={2} />
            <rect x={184} y={412} width={52} height={14} rx={6} fill={look.accent} />
            <circle cx={210} cy={444} r={10} fill={look.skinShade} />
            <text x={210} y={471} textAnchor="middle" fontSize={11} fontWeight={800} fill="#2a1d14">
              {name}
            </text>
          </g>
        )}
        {look.accessory === "headset" && <HeadsetBody look={look} name={name} />}
      </Build>

      {/* gesture hand while speaking / thinking */}
      <Build slender={slender}>
        <g ref={handRef} transform="translate(0 60)" opacity={0}>
          <path d="M300 560 Q312 470 330 452 L356 460 Q350 500 340 560 Z" fill={look.outfit} />
          <ellipse cx={342} cy={446} rx={24} ry={20} fill={look.skin} />
          <path d="M324 436 Q330 420 340 426 M338 430 Q344 414 354 422" stroke={look.skinShade} strokeWidth={5} strokeLinecap="round" fill="none" />
        </g>
      </Build>

      {/* head */}
      <g ref={headRef}>
        <ellipse cx={134} cy={186} rx={16} ry={22} fill={look.skinShade} />
        <ellipse cx={286} cy={186} rx={16} ry={22} fill={look.skinShade} />
        <ellipse cx={210} cy={176} rx={80} ry={94} fill={look.skin} />
        <ellipse cx={168} cy={218} rx={17} ry={10} fill={blush} opacity={happy ? 0.55 : 0.3} />
        <ellipse cx={252} cy={218} rx={17} ry={10} fill={blush} opacity={happy ? 0.55 : 0.3} />

        {/* hair front */}
        <HairFront style={look.hairStyle} color={look.hair} />
        {look.accessory === "headband" && (
          <g>
            <path d="M128 142 Q210 110 292 142 L292 164 Q210 132 128 164 Z" fill={look.accent} />
            <path d="M286 146 L318 128 L312 150 L322 170 L290 160 Z" fill={look.accent} />
            <path d="M140 150 Q210 128 280 150" stroke="#d8cfc0" strokeWidth={2} fill="none" />
          </g>
        )}
        {look.accessory === "badge" && <circle cx={284} cy={206} r={5} fill={look.accent} />}
        {look.accessory === "headset" && <Headset />}

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
            {look.makeup?.lashes && <path d="M167 188 l-7 -4 M253 188 l7 -4" strokeWidth={3} />}
          </g>
        ) : (
          <g className="npc-blink" style={{ transformOrigin: "210px 186px" }}>
            <ellipse cx={178 + eyeLook.x} cy={186 + eyeLook.y} rx={confused ? 8 : 9.5} ry={confused ? 10 : 12.5} fill={look.eyes} />
            <ellipse cx={242 + eyeLook.x} cy={186 + eyeLook.y} rx={9.5} ry={12.5} fill={look.eyes} />
            <circle cx={181 + eyeLook.x} cy={181 + eyeLook.y} r={3.4} fill="#fff" />
            <circle cx={245 + eyeLook.x} cy={181 + eyeLook.y} r={3.4} fill="#fff" />
            {look.makeup?.lashes && (
              <path
                d={`M${170 + eyeLook.x} ${180 + eyeLook.y} l-7 -5 M${169 + eyeLook.x} ${185 + eyeLook.y} l-7 -1 M${250 + eyeLook.x} ${180 + eyeLook.y} l7 -5 M${251 + eyeLook.x} ${185 + eyeLook.y} l7 -1`}
                stroke={look.eyes}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
          </g>
        )}
        <path d="M206 200 Q214 214 204 218" stroke={look.skinShade} strokeWidth={4} strokeLinecap="round" fill="none" />

        {/* mouths: 0 closed … 3 wide open (amplitude-driven) */}
        <g ref={(el) => void (mouths.current[0] = el)}>
          {happy ? (
            <path d="M186 234 Q210 266 234 234 Z" fill="#8c2f2a" stroke={lips} strokeWidth={2} />
          ) : confused ? (
            <path d="M194 242 q6 -6 12 0 t12 0" stroke={lips} strokeWidth={4} fill="none" strokeLinecap="round" />
          ) : (
            <path d="M192 238 Q210 250 228 238" stroke={lips} strokeWidth={4.5} fill="none" strokeLinecap="round" />
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
    </g>
  );
}
