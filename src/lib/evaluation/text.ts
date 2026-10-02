import type { LanguageCode } from "@/lib/scenarios/types";

/** Written without spaces between words (Japanese, Chinese): compared and joined character by character. */
export const unspaced = (lang: LanguageCode | string) => lang === "ja" || lang === "zh";

/**
 * Compared syllable by syllable, spaces ignored: the unspaced languages, plus Korean, whose spacing varies
 * (계산해 주세요 / 계산해주세요) and whose particles attach to words (패치는, 패치를), so a whole-word match
 * would miss them. Korean is still joined with spaces.
 */
const bySyllable = (lang: LanguageCode | string) => unspaced(lang) || lang === "ko";

/** Katakana → hiragana so しょうゆ and ショウユ compare equal. */
function kataToHira(s: string) {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * Traditional → Simplified, pairwise, for every character of the Mandarin scene that differs (speech
 * recognition can write Traditional). Generated from the scene's text with the Windows Chinese converter,
 * plus the other common forms of 里 and 台.
 */
const TRAD_PAIRS =
  "兩两個个臨临們们兒儿決决凍冻幾几別别單单賣卖廁厕臺台號号嗎吗聽听嘍喽圖图場场塊块寶宝對对帥帅帶带幫帮彈弹掃扫換换無无來来歡欢氣气沒没溫温點点熱热現现碼码種种給给薦荐見见話话請请謝谢轉转較较邊边過过還还這这選选鐘钟錢钱錯错門门問问間间隨随顧顾裡里裏里檯台";
const TRAD_TO_SIMP = new Map(Array.from({ length: TRAD_PAIRS.length / 2 }, (_, i) => [TRAD_PAIRS[i * 2], TRAD_PAIRS[i * 2 + 1]]));

export function normalize(text: string, lang: LanguageCode | string) {
  let t = text.normalize("NFKC").toLowerCase();
  t = t.replace(/\[[^\]]*\]/g, " "); // audio tags / events
  t = t.replace(/[\p{P}\p{S}]/gu, " ");
  if (lang === "ja") return kataToHira(t).replace(/\s+/g, "");
  if (lang === "zh") return t.replace(/\p{Script=Han}/gu, (c) => TRAD_TO_SIMP.get(c) ?? c).replace(/\s+/g, "");
  // NFKC keeps Hangul syllables whole (NFD below would split them into letters).
  if (lang === "ko") return t.replace(/\s+/g, "");
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
  const ta = bySyllable(lang) ? [...na] : na.split(" ");
  const tb = bySyllable(lang) ? [...nb] : nb.split(" ");
  // Character-level for Latin scripts too, blended with word-level, to be kinder to small spelling slips.
  const wordSim = 1 - levenshtein(ta, tb) / Math.max(ta.length, tb.length);
  if (bySyllable(lang)) return Math.max(0, wordSim);
  const ca = [...na.replace(/ /g, "")];
  const cb = [...nb.replace(/ /g, "")];
  const charSim = 1 - levenshtein(ca, cb) / Math.max(ca.length, cb.length);
  return Math.max(0, 0.4 * wordSim + 0.6 * charSim);
}

export function containsTerm(text: string, term: string, lang: LanguageCode | string) {
  const nt = normalize(text, lang);
  const nk = normalize(term, lang);
  if (!nk) return false;
  if (bySyllable(lang)) return nt.includes(nk);
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
  // 嗯 is also "yes", 啊 a sentence particle, 这个 "this one": those count only when isolated.
  zh: [
    ...UNIVERSAL_FILLERS,
    { label: "呃", forms: ["呃", "额", "呃呃"] },
    { label: "嗯", forms: ["嗯", "嗯嗯"], contextual: true },
    { label: "啊", forms: ["啊"], contextual: true },
    { label: "那个", forms: ["那个"], contextual: true },
    { label: "这个", forms: ["这个"], contextual: true },
    { label: "就是", forms: ["就是"], contextual: true },
    { label: "然后", forms: ["然后"], contextual: true },
  ],
  // 그 is also "that", 저 "I", 뭐 "what", 이제 "now", 아 "ah!": those count only when isolated.
  ko: [
    ...UNIVERSAL_FILLERS,
    { label: "음", forms: ["음", "음음", "으음"] },
    { label: "어", forms: ["어", "어어"] },
    { label: "그", forms: ["그"], contextual: true },
    { label: "저", forms: ["저"], contextual: true },
    { label: "뭐", forms: ["뭐"], contextual: true },
    { label: "아", forms: ["아"], contextual: true },
    { label: "막", forms: ["막"], contextual: true },
    { label: "약간", forms: ["약간"], contextual: true },
    { label: "이제", forms: ["이제"], contextual: true },
    { label: "그러니까", forms: ["그러니까"], contextual: true },
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
      while (j < words.length && joined.length < form.length) joined += (bySyllable(lang) || !joined ? "" : " ") + norm[j++];
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
 * instead — close to morae for kana, only an approximation once kanji appear. Chinese counts characters
 * too (one syllable each), plus one per digit and per run of Latin letters (A128 → A-yāo-èr-bā). Korean
 * counts Hangul blocks (one syllable each), plus one per digit (phone numbers are read digit by digit). An
 * estimate: good for comparing the learner with a native reference counted the same way, not a phonetic
 * transcription.
 */
export function syllableCount(text: string, lang: LanguageCode | string) {
  if (lang === "ja") return [...normalize(text, lang)].length;
  if (lang === "zh") return (normalize(text, lang).match(/\p{Script=Han}|\d|[a-z]+/gu) ?? []).length;
  if (lang === "ko") return (normalize(text, lang).match(/[가-힣]|\d|[a-z]+/gu) ?? []).length;
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
export const rateUnit = (lang: LanguageCode | string) => (unspaced(lang) ? "characters" : "syllables");

/**
 * Typical native speech rate in syllables (Japanese, Chinese: characters) per second — a Babbli default
 * used only when no native reference audio is available; the reference audio is preferred.
 */
export const NATIVE_RATE: Record<string, number> = { en: 4.5, ja: 7.2, fr: 5.5, es: 6.2, zh: 5.1, ko: 5.2 };

export function languageMatches(code: string | undefined, lang: LanguageCode | string) {
  if (!code) return null;
  const c = code.toLowerCase();
  const map: Record<string, string[]> = { en: ["en", "eng"], ja: ["ja", "jpn"], fr: ["fr", "fra", "fre"], es: ["es", "spa"], zh: ["zh", "zho", "cmn", "chi"], ko: ["ko", "kor"] };
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

/**
 * Babbli's copy has no em dashes; AI-written text shows them as the pause they stand for: a comma, or
 * in CJK text 、 (Japanese) or ， (Chinese: pass the language).
 */
export function withoutEmDashes(text: string, lang?: LanguageCode | string) {
  const pause = lang === "zh" ? "，" : "、";
  return text
    .replace(/([.!?…])\s*—+\s*/g, "$1 ")
    .replace(/([。！？])\s*—+\s*/g, "$1")
    .replace(/(^|[^\s—])\s*—+\s*/g, (_, prev: string) => (prev ? prev + (/[぀-ヿ一-鿿＀-￯]/.test(prev) ? pause : ", ") : ""))
    .replace(/,\s*([,.!?;:…。！？、，])/g, "$1")
    .replace(/[,、，]\s*$/, "")
    .trim();
}

export function stripAudioTags(text: string) {
  return text.replace(/\[[^\]]{1,30}\]\s*/g, "").trim();
}
