import type { LanguageCode } from "@/lib/scenarios/types";

/** Katakana → hiragana so しょうゆ and ショウユ compare equal. */
function kataToHira(s: string) {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function normalize(text: string, lang: LanguageCode | string) {
  let t = text.normalize("NFKC").toLowerCase();
  t = t.replace(/\[[^\]]*\]/g, " "); // audio tags / events
  t = t.replace(/[\p{P}\p{S}]/gu, " ");
  if (lang === "ja") return kataToHira(t).replace(/\s+/g, "");
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string[], b: string[]) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** 0..1 similarity between a learner transcript and a model phrase. */
export function similarity(a: string, b: string, lang: LanguageCode | string) {
  const na = normalize(a, lang);
  const nb = normalize(b, lang);
  if (!na || !nb) return 0;
  const ta = lang === "ja" ? [...na] : na.split(" ");
  const tb = lang === "ja" ? [...nb] : nb.split(" ");
  // Character-level for Latin scripts too, blended with word-level, to be kinder to small spelling slips.
  const wordSim = 1 - levenshtein(ta, tb) / Math.max(ta.length, tb.length);
  if (lang === "ja") return Math.max(0, wordSim);
  const ca = [...na.replace(/ /g, "")];
  const cb = [...nb.replace(/ /g, "")];
  const charSim = 1 - levenshtein(ca, cb) / Math.max(ca.length, cb.length);
  return Math.max(0, 0.4 * wordSim + 0.6 * charSim);
}

export function containsTerm(text: string, term: string, lang: LanguageCode | string) {
  const nt = normalize(text, lang);
  const nk = normalize(term, lang);
  if (!nk) return false;
  if (lang === "ja") return nt.includes(nk);
  return ` ${nt} `.includes(` ${nk} `) || (nk.includes(" ") && nt.includes(nk));
}

/* ------------------------------------------------------------------ */
/* filler words (Voice Mode only — they need real speech)              */
/* ------------------------------------------------------------------ */

/**
 * A hesitation filler. `forms` are the spellings speech recognition produces for it. A `contextual`
 * filler is also an ordinary word ("like", "so", Spanish "este" = this, Japanese "あの" = that), so
 * it only counts when it clearly stands alone as a hesitation — see detectFillers.
 */
interface FillerDef {
  label: string;
  forms: string[];
  contextual?: boolean;
}

/** Hesitation sounds learners carry into any language (e.g. an English "uh" inside Japanese). */
const UNIVERSAL_FILLERS: FillerDef[] = [
  { label: "um", forms: ["um", "umm", "ummm", "uhm"] },
  { label: "uh", forms: ["uh", "uhh", "uhhh"] },
  { label: "er", forms: ["er", "erm", "err"] },
  { label: "hmm", forms: ["hmm", "hmmm", "hm"] },
];

const FILLER_DEFS: Record<string, FillerDef[]> = {
  en: [
    ...UNIVERSAL_FILLERS,
    { label: "you know", forms: ["you know"], contextual: true },
    { label: "like", forms: ["like"], contextual: true },
    { label: "so", forms: ["so"], contextual: true },
  ],
  fr: [
    ...UNIVERSAL_FILLERS,
    { label: "euh", forms: ["euh", "heu", "euhm", "euuh"] },
    { label: "hum", forms: ["hum"] },
    { label: "ben", forms: ["ben", "bah"], contextual: true },
  ],
  es: [
    ...UNIVERSAL_FILLERS,
    { label: "eh", forms: ["eh", "ehh", "em", "emm", "mmm"] },
    { label: "este", forms: ["este"], contextual: true },
    { label: "pues", forms: ["pues"], contextual: true },
    { label: "o sea", forms: ["o sea"], contextual: true },
  ],
  ja: [
    ...UNIVERSAL_FILLERS,
    { label: "えっと", forms: ["えっと", "えーと", "えーっと", "えと"] },
    { label: "えー", forms: ["えー", "えーー"] },
    { label: "あー", forms: ["あー", "あーー"] },
    { label: "あのー", forms: ["あのー", "あのう"] },
    { label: "うーん", forms: ["うーん", "んー", "うーむ"] },
    { label: "あの", forms: ["あの"], contextual: true },
    { label: "まあ", forms: ["まあ", "まぁ"], contextual: true },
  ],
};

/** A silence at least this long around a contextual word marks it as a hesitation (Babbli heuristic). */
const ISOLATING_PAUSE = 0.25;

export interface FillerHit {
  label: string;
  /** Indices of the recognised words that make up the filler. */
  indices: number[];
}

/**
 * Finds hesitation fillers in a timed word sequence. Unambiguous sounds (um, uh, euh, えっと…) always
 * count; context-dependent words count only when isolated — a pause (or the start of the reply, or
 * a comma) before AND a pause of ≥ 0.25 s after (or the end of the reply). So "I'd like a scarf" or
 * "あの店" never count, while "it's, like… blue" does. Japanese recognition returns one character per
 * "word", so forms are matched across consecutive words.
 */
export function detectFillers(words: { text: string; start: number; end: number }[], lang: LanguageCode | string): FillerHit[] {
  const defs = FILLER_DEFS[lang] ?? UNIVERSAL_FILLERS;
  const norm = words.map((w) => normalize(w.text, lang));
  const forms = defs
    .flatMap((d) => d.forms.map((f) => ({ def: d, form: normalize(f, lang) })))
    .sort((a, b) => b.form.length - a.form.length);
  const hits: FillerHit[] = [];
  for (let i = 0; i < words.length; ) {
    if (!norm[i]) {
      i++;
      continue;
    }
    let found: FillerHit | null = null;
    for (const { def, form } of forms) {
      // Consume consecutive words until the joined text reaches the form's length.
      let joined = "";
      let j = i;
      while (j < words.length && joined.length < form.length) joined += (lang === "ja" || !joined ? "" : " ") + norm[j++];
      if (joined !== form) continue;
      if (def.contextual) {
        const last = j - 1;
        const before = i === 0 || words[i].start - words[i - 1].end >= ISOLATING_PAUSE || /[,，、。.!?！？…]$/.test(words[i - 1].text.trim());
        const after = last === words.length - 1 || words[last + 1].start - words[last].end >= ISOLATING_PAUSE;
        if (!before || !after) continue;
      }
      found = { label: def.label, indices: Array.from({ length: j - i }, (_, k) => i + k) };
      break;
    }
    if (found) {
      hits.push(found);
      i += found.indices.length;
    } else i++;
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* syllables — for the cited speech-rate measure (see sources.ts)      */
/* ------------------------------------------------------------------ */

// Accents matter here: French "café" isn't a mute e, Spanish "día" isn't a diphthong.
const VOWELS: Record<string, RegExp> = {
  en: /[aeiouy]+/g,
  fr: /[aeiouyàâäéèêëîïôöùûüÿœæ]+/g,
  es: /[aeiouáéíóúü]+/g,
};
/** Spanish: a, e, o — and an accented í / ú — are "strong"; two strong vowels side by side are separate syllables. */
const STRONG_ES = /[aeoáéóíú]/;

function wordSyllables(word: string, lang: string) {
  const groups = word.match(VOWELS[lang] ?? VOWELS.en) ?? [];
  let n = groups.length;
  if (lang === "en") {
    // Silent final e ("like", "take"), but not "-le" after a consonant ("table").
    if (n > 1 && /[^aeiouy]e$/.test(word) && !/[^aeiouy]le$/.test(word)) n--;
    if (n > 1 && /[^aeiouy]es$/.test(word) && !/(ses|zes|ches|shes|ges|ces)$/.test(word)) n--;
  } else if (lang === "fr") {
    // Mute final (unaccented) e / es: "une", "petites".
    if (n > 1 && /[^aeiouyàâäéèêëîïôöùûüÿœæ]es?$/.test(word)) n--;
  } else if (lang === "es") {
    for (const g of groups) for (let k = 1; k < g.length; k++) if (STRONG_ES.test(g[k]) && STRONG_ES.test(g[k - 1])) n++;
  }
  return Math.max(1, n);
}

/**
 * Estimated syllables in a text, from spelling (English, French, Spanish). Japanese counts characters
 * instead — close to morae for kana, only an approximation once kanji appear. An estimate: good for
 * comparing the learner with a native reference counted the same way, not a phonetic transcription.
 */
export function syllableCount(text: string, lang: LanguageCode | string) {
  if (lang === "ja") return [...normalize(text, lang)].length;
  // Like normalize(), but keeping accents.
  const words = text
    .normalize("NFC")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/['’]/g, "") // I'd, s'il, l'addition stay one word
    .replace(/[\p{P}\p{S}\d]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.reduce((s, w) => s + wordSyllables(w, lang), 0);
}

/** The unit syllableCount measures in. */
export const rateUnit = (lang: LanguageCode | string) => (lang === "ja" ? "characters" : "syllables");

/**
 * Typical native speech rate in syllables (Japanese: characters) per second — a Babbli default used
 * only when no native reference audio is available; the reference audio is preferred.
 */
export const NATIVE_RATE: Record<string, number> = { en: 4.5, ja: 7.2, fr: 5.5, es: 6.2 };

export function languageMatches(code: string | undefined, lang: LanguageCode | string) {
  if (!code) return null;
  const c = code.toLowerCase();
  const map: Record<string, string[]> = { en: ["en", "eng"], ja: ["ja", "jpn"], fr: ["fr", "fra", "fre"], es: ["es", "spa"] };
  return (map[lang] ?? [lang]).some((x) => c === x || c.startsWith(x));
}

/**
 * Keep only spoken words: drop sound/event tags speech recognition may emit —
 * "(coughs)", "[music]", "（笑）", "*sighs*", "♪" — and tidy the spacing.
 */
export function cleanTranscript(text: string) {
  return text
    .replace(/\([^)]*\)|\[[^\]]*\]|（[^）]*）|【[^】]*】|\*[^*]*\*|♪+/g, " ")
    .replace(/\s+([,.!?、。！？])/g, "$1")
    .replace(/^[\s,.、。]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Babbli's copy has no em dashes; AI-written text shows them as the pause they stand for (a comma). */
export function withoutEmDashes(text: string) {
  return text
    .replace(/([.!?…])\s*—+\s*/g, "$1 ")
    .replace(/([。！？])\s*—+\s*/g, "$1")
    .replace(/(^|[^\s—])\s*—+\s*/g, (_, prev: string) => (prev ? prev + (/[぀-ヿ一-鿿＀-￯]/.test(prev) ? "、" : ", ") : ""))
    .replace(/,\s*([,.!?;:…。！？、])/g, "$1")
    .replace(/[,、]\s*$/, "")
    .trim();
}

export function stripAudioTags(text: string) {
  return text.replace(/\[[^\]]{1,30}\]\s*/g, "").trim();
}
