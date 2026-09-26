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

export const FILLERS: Record<string, string[]> = {
  en: ["um", "uh", "er", "erm", "hmm", "uhh", "umm"],
  ja: ["えーと", "えっと", "えー", "あのー", "あの", "うーん", "んー", "まあ"],
  fr: ["euh", "heu", "euhm", "hum", "ben", "bah", "hein"],
  es: ["eh", "em", "este", "mmm", "pues", "ehh", "o sea"],
};

export function isFiller(word: string, lang: LanguageCode | string) {
  const n = normalize(word, lang);
  return (FILLERS[lang] ?? []).some((f) => normalize(f, lang) === n);
}

/** Speech units: characters for Japanese (no spaces/punctuation), words otherwise. */
export function speechUnits(text: string, lang: LanguageCode | string) {
  const n = normalize(text, lang);
  if (!n) return 0;
  return lang === "ja" ? [...n].length : n.split(" ").length;
}

/** Typical native speaking rate in units/second — used when no reference audio is available. */
export const NATIVE_RATE: Record<string, number> = { en: 2.8, ja: 7.2, fr: 3.3, es: 3.4 };

export function languageMatches(code: string | undefined, lang: LanguageCode | string) {
  if (!code) return null;
  const c = code.toLowerCase();
  const map: Record<string, string[]> = { en: ["en", "eng"], ja: ["ja", "jpn"], fr: ["fr", "fra", "fre"], es: ["es", "spa"] };
  return (map[lang] ?? [lang]).some((x) => c === x || c.startsWith(x));
}

export function stripAudioTags(text: string) {
  return text.replace(/\[[^\]]{1,30}\]\s*/g, "").trim();
}
