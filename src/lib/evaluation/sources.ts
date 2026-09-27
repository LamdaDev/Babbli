/**
 * Source map for Babbli's speech measures (Voice Mode only).
 *
 * One published source backs one measure — speech rate. Everything else Babbli reports about speech
 * (filler counts, pauses, response time, the 0–100 Fluency score, recognition clarity) is a Babbli
 * heuristic: useful feedback, not a validated assessment.
 */
export const FLUENCY_SOURCE = {
  citation:
    "Kormos, J., & Dénes, M. (2004). Exploring measures and perceptions of fluency in the speech of second language learners. System, 32(2), 145–164.",
  doi: "https://doi.org/10.1016/j.system.2004.01.001",
  url: "https://research.lancaster-university.uk/en/publications/exploring-measures-and-perceptions-of-fluency-in-the-speech-of-se/",
  /** The established measure Babbli uses, as that study defines it. */
  speechRate: {
    formula: "syllables ÷ speaking time in seconds (pauses included) × 60",
    finding: "It was among the best predictors of teachers' fluency ratings.",
    babbliProcess: "Timed from your first to your last recognised word; fillers don't count as syllables.",
  },
  /** What the same study found about the things Babbli counts but doesn't treat as validated. */
  caveat: "The same study found pause counts didn't change fluency ratings.",
} as const;

/** Babbli-specific choices (not from the source). */
export const SPEECH_HEURISTICS = {
  pauseSeconds: 0.25, // silence between words counted as a pause
  longPauseSeconds: 0.45, // pause that lowers the Fluency score
} as const;
