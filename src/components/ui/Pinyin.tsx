/**
 * Pinyin with each syllable coloured by its tone (Mandarin only; other readings are shown as they are).
 * The tone marks stay the primary signal, so it still reads for anyone who can't tell the colours apart.
 */

const MARKS = "āēīōūǖĀĒĪŌŪǕ" + "áéíóúǘÁÉÍÓÚǗ" + "ǎěǐǒǔǚǍĚǏǑǓǙ" + "àèìòùǜÀÈÌÒÙǛ";
/** Tone 0 is neutral (no mark). All pass 4.5:1 on white. */
const TONE_COLORS = ["#5b6780", "#c0262d", "#b45309", "#15803d", "#1d4ed8"];
const TONE_NAMES = ["neutral", "1st", "2nd", "3rd", "4th"];

/** One syllable: an optional initial, the vowels (where the tone mark sits), then an n / ng / r final. */
const SYLLABLE = new RegExp(`(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcswy])?[aeiouüv${MARKS}]+(?:ng|n(?![aeiouü${MARKS}])|r(?![aeiouü${MARKS}]))?`, "gi");

function toneOf(syllable: string) {
  for (const ch of syllable) {
    const i = MARKS.indexOf(ch);
    if (i >= 0) return Math.floor(i / 12) + 1;
  }
  return 0;
}

export function Pinyin({ text, lang }: { text: string; lang: string }) {
  if (lang !== "zh") return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(SYLLABLE)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tone = toneOf(m[0]);
    parts.push(
      <span key={m.index} style={{ color: TONE_COLORS[tone] }} title={`${TONE_NAMES[tone]} tone`}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** A one-line key to the tone colours. */
export function ToneLegend({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 text-[11px] font-bold ${className}`}>
      <span className="text-ink-soft">Tones:</span>
      {["ā 1", "á 2", "ǎ 3", "à 4", "a neutral"].map((label, i) => (
        <span key={label} style={{ color: TONE_COLORS[i === 4 ? 0 : i + 1] }}>
          {label}
        </span>
      ))}
    </span>
  );
}
