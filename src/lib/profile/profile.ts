import type { AddressForm, Difficulty, HairStyle, LanguageCode, ResponseMode } from "@/lib/scenarios/types";
import { BADGES, type BadgeId } from "./badges";

/**
 * The Traveler Profile: one local learner, no account. A compact object kept in the browser; every
 * field has a default, so the app behaves exactly as before for someone who never opens the page.
 */

export type PronounChoice = "she" | "he" | "they" | "custom";
export type CoachVoice = "standard" | "alternate";
export type Expression = "smile" | "grin" | "calm";
export type Glasses = "none" | "round" | "square" | "shades";
export type Accessory = "none" | "earrings" | "headband" | "beanie" | "headphones";

export interface AvatarLook {
  skin: string;
  hairStyle: HairStyle;
  hair: string;
  outfit: string;
  expression: Expression;
  freckles: boolean;
  glasses: Glasses;
  accessory: Accessory;
  /** An earned badge worn as an enamel pin (cosmetic only). */
  pin: BadgeId | "none";
}

export interface Profile {
  v: 1;
  nickname: string;
  /** null = not set: characters keep their default wording. */
  pronouns: PronounChoice | null;
  customPronouns: string;
  avatar: AvatarLook;
  /** Destination offered first on the home screen. */
  language: LanguageCode | null;
  difficulty: Difficulty;
  responseMode: ResponseMode;
  /** Which native coach voice plays hints and reference phrases. */
  coachVoice: CoachVoice;
}

/* ---------- options ---------- */

export interface Swatch {
  id: string;
  label: string;
  color: string;
  shade: string;
}

export const SKIN_TONES: Swatch[] = [
  { id: "porcelain", label: "Porcelain", color: "#f8dcc8", shade: "#e8bea5" },
  { id: "peach", label: "Peach", color: "#f0c29f", shade: "#dba57f" },
  { id: "golden", label: "Golden", color: "#dca67c", shade: "#c68a60" },
  { id: "tan", label: "Tan", color: "#bf8358", shade: "#a46a42" },
  { id: "umber", label: "Umber", color: "#8d5a3b", shade: "#74472d" },
  { id: "deep", label: "Deep", color: "#5f3c28", shade: "#4c2e1d" },
];

export const HAIR_COLORS: Swatch[] = [
  { id: "black", label: "Black", color: "#1f1a17", shade: "#1f1a17" },
  { id: "espresso", label: "Espresso", color: "#3d2a1f", shade: "#3d2a1f" },
  { id: "chestnut", label: "Chestnut", color: "#6b4430", shade: "#6b4430" },
  { id: "auburn", label: "Auburn", color: "#9b4a2a", shade: "#9b4a2a" },
  { id: "honey", label: "Honey", color: "#d4a85c", shade: "#b98f47" },
  { id: "silver", label: "Silver", color: "#b3b6bd", shade: "#8f939b" },
  { id: "rose", label: "Rose", color: "#e0808f", shade: "#c86676" },
  { id: "teal", label: "Teal", color: "#2a8c86", shade: "#21716c" },
];

export const OUTFIT_COLORS: Swatch[] = [
  { id: "blue", label: "Babbli blue", color: "#1b57cb", shade: "#154aad" },
  { id: "navy", label: "Navy", color: "#0e357e", shade: "#0a2a66" },
  { id: "teal", label: "Teal", color: "#17a898", shade: "#12897c" },
  { id: "coral", label: "Coral", color: "#ff6b5a", shade: "#e2513f" },
  { id: "gold", label: "Gold", color: "#f2b84b", shade: "#d99d2f" },
  { id: "forest", label: "Forest", color: "#3f7d4a", shade: "#31643a" },
  { id: "cream", label: "Cream", color: "#f3eadb", shade: "#ddcfb8" },
  { id: "charcoal", label: "Charcoal", color: "#343a46", shade: "#262b34" },
];

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "buzz", label: "Buzz" },
  { id: "middle", label: "Middle part" },
  { id: "bob", label: "Bob" },
  { id: "long", label: "Long" },
  { id: "bun", label: "Bun" },
  { id: "curly", label: "Curls" },
  { id: "ponytail", label: "Ponytail" },
  { id: "comma", label: "Comma" },
];

export const EXPRESSIONS: { id: Expression; label: string }[] = [
  { id: "smile", label: "Smile" },
  { id: "grin", label: "Big grin" },
  { id: "calm", label: "Calm" },
];

export const GLASSES: { id: Glasses; label: string }[] = [
  { id: "none", label: "None" },
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "shades", label: "Shades" },
];

export const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: "none", label: "None" },
  { id: "earrings", label: "Earrings" },
  { id: "headband", label: "Headband" },
  { id: "beanie", label: "Beanie" },
  { id: "headphones", label: "Headphones" },
];

export const PRONOUN_OPTIONS: { id: PronounChoice; label: string }[] = [
  { id: "she", label: "she/her" },
  { id: "he", label: "he/him" },
  { id: "they", label: "they/them" },
  { id: "custom", label: "Custom" },
];

export const swatch = (list: Swatch[], id: string) => list.find((s) => s.id === id) ?? list[0];

/* ---------- defaults & validation ---------- */

export const DEFAULT_PROFILE: Profile = {
  v: 1,
  nickname: "",
  pronouns: null,
  customPronouns: "",
  avatar: {
    skin: "golden",
    hairStyle: "short",
    hair: "espresso",
    outfit: "blue",
    expression: "smile",
    freckles: false,
    glasses: "none",
    accessory: "none",
    pin: "none",
  },
  language: null,
  difficulty: "beginner",
  responseMode: "voice",
  coachVoice: "standard",
};

export const NICKNAME_MAX = 20;
export const PRONOUNS_MAX = 24;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Letters, spaces, slashes, apostrophes and hyphens only — it is shown in the UI and told to the NPC. */
export function cleanPronouns(value: string) {
  return value.replace(/[^\p{L}\p{M} /'’-]/gu, "").replace(/\s+/g, " ").slice(0, PRONOUNS_MAX);
}

export function cleanNickname(value: string) {
  return value.replace(/[\p{C}<>]/gu, "").slice(0, NICKNAME_MAX);
}

/** Whatever is stored (old, partial or hand-edited), return a complete, valid profile. */
export function sanitizeProfile(raw: unknown): Profile {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Profile, unknown>>;
  const a = (p.avatar && typeof p.avatar === "object" ? p.avatar : {}) as Partial<Record<keyof AvatarLook, unknown>>;
  const d = DEFAULT_PROFILE;
  const ids = (list: { id: string }[]) => list.map((x) => x.id);
  return {
    v: 1,
    nickname: typeof p.nickname === "string" ? cleanNickname(p.nickname) : d.nickname,
    pronouns: PRONOUN_OPTIONS.find((o) => o.id === p.pronouns)?.id ?? null,
    customPronouns: typeof p.customPronouns === "string" ? cleanPronouns(p.customPronouns) : "",
    avatar: {
      skin: oneOf(a.skin, ids(SKIN_TONES), d.avatar.skin),
      hairStyle: oneOf(a.hairStyle, HAIR_STYLES.map((h) => h.id), d.avatar.hairStyle),
      hair: oneOf(a.hair, ids(HAIR_COLORS), d.avatar.hair),
      outfit: oneOf(a.outfit, ids(OUTFIT_COLORS), d.avatar.outfit),
      expression: oneOf(a.expression, EXPRESSIONS.map((e) => e.id), d.avatar.expression),
      freckles: typeof a.freckles === "boolean" ? a.freckles : d.avatar.freckles,
      glasses: oneOf(a.glasses, GLASSES.map((g) => g.id), d.avatar.glasses),
      accessory: oneOf(a.accessory, ACCESSORIES.map((x) => x.id), d.avatar.accessory),
      pin: oneOf(a.pin, ["none", ...BADGES.map((b) => b.id)], "none"),
    },
    language: (["en", "ja", "fr", "es", "zh", "ko"] as const).find((l) => l === p.language) ?? null,
    difficulty: oneOf(p.difficulty, ["beginner", "intermediate", "immersion"] as const, d.difficulty),
    responseMode: oneOf(p.responseMode, ["voice", "text"] as const, d.responseMode),
    coachVoice: oneOf(p.coachVoice, ["standard", "alternate"] as const, d.coachVoice),
  };
}

/** True until the learner changes anything (the home screen then invites them to set up). */
export function isDefaultProfile(p: Profile) {
  return JSON.stringify(sanitizeProfile(p)) === JSON.stringify(sanitizeProfile(DEFAULT_PROFILE));
}

/* ---------- names & pronouns ---------- */

export function displayName(p: Profile) {
  return p.nickname.trim() || "Traveler";
}

export interface PronounSet {
  /** "she/her", "they/them", or the custom text. */
  label: string;
  subject: string;
  /** they → "they have"; she/he/custom → "she has". */
  plural: boolean;
}

/** Pronouns for learner-facing third-person text. Unset falls back to they/them. */
export function pronounsOf(p: Profile): PronounSet {
  switch (p.pronouns) {
    case "she":
      return { label: "she/her", subject: "she", plural: false };
    case "he":
      return { label: "he/him", subject: "he", plural: false };
    case "custom": {
      const custom = p.customPronouns.trim();
      if (custom) return { label: custom, subject: custom.split(/[/ ]/)[0] || custom, plural: false };
      return { label: "they/them", subject: "they", plural: true };
    }
    default:
      return { label: "they/them", subject: "they", plural: true };
  }
}

/** How characters in gendered languages address the learner (null: the scene's default wording). */
export function addressForm(p: Profile): AddressForm | null {
  if (p.pronouns === "she") return "feminine";
  if (p.pronouns === "he") return "masculine";
  if (p.pronouns === "they" || (p.pronouns === "custom" && p.customPronouns.trim())) return "neutral";
  return null;
}

const AGREEMENT: Partial<Record<LanguageCode, Record<AddressForm, string>>> = {
  es: {
    feminine: 'When a word refers to them, use the feminine form (e.g. "bienvenida", "lista", "¿está segura?").',
    masculine: 'When a word refers to them, use the masculine form (e.g. "bienvenido", "listo", "¿está seguro?").',
    neutral:
      'Use gender-neutral phrasing when you address or mention them, e.g. "le damos la bienvenida" instead of "bienvenido/a", and avoid gendered adjectives about them where you can.',
  },
  fr: {
    feminine: 'When a word refers to them, use the feminine form (e.g. "installée", "prête", "ravie").',
    masculine: 'When a word refers to them, use the masculine form (e.g. "installé", "prêt", "ravi").',
    neutral:
      'Use gender-neutral phrasing when you address or mention them, e.g. "vous avez trouvé une place ?" rather than "vous êtes installé(e) ?", and avoid gendered adjectives about them where you can.',
  },
  zh: {
    feminine: 'Friendly shop-talk is fine: you may call them 美女 (e.g. "美女，喝点啥？"), or simply 您.',
    masculine: 'Friendly shop-talk is fine: you may call them 帅哥 (e.g. "帅哥，喝点啥？"), or simply 您.',
    neutral: "Address them as 您, and avoid gendered shop-talk like 帅哥 or 美女.",
  },
  // Korean shop staff address everyone the same way.
  ko: {
    feminine: "Address them as 손님 (never 아가씨 or 총각).",
    masculine: "Address them as 손님 (never 아가씨 or 총각).",
    neutral: "Address them as 손님 (never 아가씨 or 총각).",
  },
};

/**
 * A line for the NPC prompt about how to refer to the learner, or null when pronouns aren't set.
 * Only the pronouns are shared with the character — never the nickname.
 */
export function learnerPromptNote(p: Profile, language: LanguageCode): string | null {
  const form = addressForm(p);
  if (!form) return null;
  const { label } = pronounsOf(p);
  const agreement = AGREEMENT[language]?.[form];
  return [`The customer uses ${label} pronouns. If you ever mention them to someone else, use ${label}.`, agreement].filter(Boolean).join(" ");
}

/* ---------- coach voice ---------- */

/** Voice key for native coach playback. The standard coach stays the timing reference for scores. */
export function coachVoiceKey(language: string, voice: CoachVoice = "standard") {
  return voice === "alternate" ? `coach_${language}_alt` : `coach_${language}`;
}

export const COACH_VOICES: Record<LanguageCode, Record<CoachVoice, string>> = {
  en: { standard: "Calm American woman", alternate: "Warm American man" },
  ja: { standard: "Calm Tokyo woman", alternate: "Warm Tokyo man" },
  fr: { standard: "Calm Parisian man", alternate: "Bright Parisian woman" },
  es: { standard: "Calm woman from Madrid", alternate: "Warm man from Madrid" },
  zh: { standard: "Calm woman from Beijing", alternate: "Warm man from Beijing" },
  ko: { standard: "Calm woman from Seoul", alternate: "Warm man from Seoul" },
};

export const COACH_SAMPLES: Record<LanguageCode, string> = {
  en: "Hi! Let's practice together. Do you have this scarf in navy?",
  ja: "こんにちは。一緒に練習しましょう。醤油ラーメンを一つお願いします。",
  fr: "Bonjour ! On s'entraîne ensemble ? Un café crème, s'il vous plaît.",
  es: "¡Hola! Vamos a practicar. Tengo una reserva a nombre de Morgan.",
  zh: "你好！我们一起练习吧。我要一杯珍珠奶茶。",
  ko: "안녕하세요! 같이 연습해요. 이거 계산해 주세요.",
};
