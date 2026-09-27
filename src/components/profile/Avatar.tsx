"use client";

import { useId } from "react";
import { HairBack, HairFront } from "@/components/art/Character";
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, swatch, type AvatarLook } from "@/lib/profile/profile";
import { PinMark } from "./Pin";

const INK = "#23201d";
const GOLD = "#f2b84b";

/**
 * The learner's avatar: a head-and-shoulders portrait drawn with the same parts as the NPCs
 * (same head, hair shapes and face), inside a round frame.
 */
export function Avatar({ look, size = 96, className = "", label = "Your avatar" }: { look: AvatarLook; size?: number; className?: string; label?: string }) {
  const clip = useId();
  const skin = swatch(SKIN_TONES, look.skin);
  const hair = swatch(HAIR_COLORS, look.hair).color;
  const outfit = swatch(OUTFIT_COLORS, look.outfit);
  const grin = look.expression === "grin";

  return (
    <svg viewBox="45 38 330 330" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <circle cx={210} cy={203} r={165} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x={45} y={38} width={330} height={330} fill="#e4ecfa" />
        <circle cx={310} cy={96} r={80} fill="#fff" opacity={0.4} />

        <HairBack style={look.hairStyle} color={hair} />

        {/* neck, then shoulders with a scoop neckline */}
        <rect x={186} y={240} width={48} height={70} rx={14} fill={skin.shade} />
        <path d="M52 560 L64 372 Q74 312 150 296 L270 296 Q346 312 356 372 L368 560 Z" fill={outfit.color} />
        <path d="M270 296 Q346 312 356 372 L368 560 L300 560 Q318 420 270 296 Z" fill={outfit.shade} opacity={0.8} />
        <path d="M176 296 Q210 326 244 296 Z" fill={skin.shade} />
        <path d="M172 295 Q210 330 248 295" stroke={outfit.shade} strokeWidth={8} fill="none" strokeLinecap="round" />
        {look.pin !== "none" && (
          <g transform="translate(274 338)">
            <PinMark id={look.pin} r={20} />
          </g>
        )}

        {/* head */}
        <ellipse cx={134} cy={186} rx={16} ry={22} fill={skin.shade} />
        <ellipse cx={286} cy={186} rx={16} ry={22} fill={skin.shade} />
        <ellipse cx={210} cy={176} rx={80} ry={94} fill={skin.color} />
        <ellipse cx={168} cy={218} rx={17} ry={10} fill="#ff8f86" opacity={grin ? 0.55 : 0.35} />
        <ellipse cx={252} cy={218} rx={17} ry={10} fill="#ff8f86" opacity={grin ? 0.55 : 0.35} />
        {look.freckles &&
          [
            [156, 206],
            [165, 214],
            [174, 206],
            [246, 206],
            [255, 214],
            [264, 206],
          ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.4} fill="#8a4b2d" opacity={0.5} />)}

        <HairFront style={look.hairStyle} color={hair} />

        {look.accessory === "headband" && (
          <g>
            <path d="M126 146 Q210 110 294 146 L294 166 Q210 132 126 166 Z" fill="#ff6b5a" />
            <circle cx={284} cy={146} r={9} fill="#ff6b5a" stroke="#e2513f" strokeWidth={3} />
          </g>
        )}
        {look.accessory === "beanie" && (
          <g>
            <path d="M118 152 Q114 62 210 54 Q306 62 302 152 Z" fill={outfit.color} />
            <path d="M114 142 Q210 116 306 142 L306 170 Q210 144 114 170 Z" fill={outfit.shade} />
            {[150, 180, 210, 240, 270].map((x) => (
              <path key={x} d={`M${x} 128 L${x} 150`} stroke="#fff" strokeOpacity={0.18} strokeWidth={5} strokeLinecap="round" />
            ))}
            <circle cx={210} cy={52} r={18} fill="#fbf8f2" />
          </g>
        )}
        {look.accessory === "headphones" && (
          <g>
            <path d="M120 180 Q114 56 210 52 Q306 56 300 180" stroke={INK} strokeWidth={12} fill="none" />
            <rect x={106} y={156} width={36} height={62} rx={15} fill={INK} />
            <rect x={278} y={156} width={36} height={62} rx={15} fill={INK} />
            <rect x={112} y={168} width={10} height={38} rx={5} fill="#ff6b5a" />
            <rect x={298} y={168} width={10} height={38} rx={5} fill="#ff6b5a" />
          </g>
        )}

        {/* brows */}
        <g stroke={look.hairStyle === "buzz" ? INK : hair} strokeWidth={7} strokeLinecap="round" fill="none">
          {grin ? (
            <>
              <path d="M160 152 Q178 140 196 150" />
              <path d="M224 150 Q242 140 260 152" />
            </>
          ) : (
            <>
              <path d="M160 158 Q178 150 196 156" />
              <path d="M224 156 Q242 150 260 158" />
            </>
          )}
        </g>

        {/* eyes */}
        {grin ? (
          <g stroke="#2a1d14" strokeWidth={6} strokeLinecap="round" fill="none">
            <path d="M166 190 Q178 176 190 190" />
            <path d="M230 190 Q242 176 254 190" />
          </g>
        ) : (
          <g>
            <ellipse cx={178} cy={187} rx={9.5} ry={look.expression === "calm" ? 10 : 12.5} fill="#2a1d14" />
            <ellipse cx={242} cy={187} rx={9.5} ry={look.expression === "calm" ? 10 : 12.5} fill="#2a1d14" />
            <circle cx={181} cy={182} r={3.4} fill="#fff" />
            <circle cx={245} cy={182} r={3.4} fill="#fff" />
          </g>
        )}
        <path d="M206 200 Q214 214 204 218" stroke={skin.shade} strokeWidth={4} strokeLinecap="round" fill="none" />

        {/* mouth */}
        {grin ? (
          <path d="M186 234 Q210 266 234 234 Z" fill="#8c2f2a" stroke="#6d201c" strokeWidth={2} strokeLinejoin="round" />
        ) : look.expression === "calm" ? (
          <path d="M198 240 Q210 247 222 240" stroke="#6d201c" strokeWidth={4.5} fill="none" strokeLinecap="round" />
        ) : (
          <path d="M190 236 Q210 254 230 236" stroke="#6d201c" strokeWidth={4.5} fill="none" strokeLinecap="round" />
        )}

        {/* glasses */}
        {look.glasses === "round" && (
          <g stroke={INK} strokeWidth={5} fill="#fff" fillOpacity={0.12}>
            <circle cx={178} cy={188} r={21} />
            <circle cx={242} cy={188} r={21} />
            <path d="M199 186 Q210 179 221 186 M157 184 L136 178 M263 184 L284 178" fill="none" />
          </g>
        )}
        {look.glasses === "square" && (
          <g stroke={INK} strokeWidth={5} fill="#fff" fillOpacity={0.12}>
            <rect x={155} y={170} width={46} height={36} rx={9} />
            <rect x={219} y={170} width={46} height={36} rx={9} />
            <path d="M201 184 Q210 178 219 184 M155 182 L136 178 M265 182 L284 178" fill="none" />
          </g>
        )}
        {look.glasses === "shades" && (
          <g>
            <path d="M154 176 L202 176 Q202 208 178 208 Q154 208 154 176 Z M218 176 L266 176 Q266 208 242 208 Q218 208 218 176 Z" fill="#1b1b1f" />
            <path d="M150 176 L270 176" stroke={INK} strokeWidth={6} strokeLinecap="round" />
            <path d="M162 184 L172 184 M226 184 L236 184" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.45} />
          </g>
        )}

        {look.accessory === "earrings" && (
          <g fill={GOLD}>
            <circle cx={132} cy={208} r={4.5} />
            <circle cx={288} cy={208} r={4.5} />
            <path d="M132 212 l4 7 l-4 5 l-4 -5 Z M288 212 l4 7 l-4 5 l-4 -5 Z" fill="#17a898" />
          </g>
        )}
      </g>
    </svg>
  );
}
