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
    formula: "speech rate = total syllables ÷ total length of the speech sample in seconds (pauses included) × 60",
    finding: "Speech rate was among the best predictors of native and non-native teachers' fluency ratings in the study.",
    babbliProcess:
      "Per spoken reply, the sample runs from the first to the last word ElevenLabs Scribe recognised (so pauses inside the reply count, the wait before speaking doesn't). Syllables are estimated from spelling (Japanese: characters), filler words aren't counted as syllables, and the session rate pools all replies: total syllables ÷ total speaking time × 60.",
  },
  /** What the same study found about the things Babbli counts but doesn't treat as validated. */
  caveat:
    "The same study found that the number of filled and unfilled pauses did not influence raters' perceptions of fluency — so filler and pause counts are shown as descriptive feedback, not as a validated fluency measure.",
} as const;

/** Babbli-specific choices (not from the source). */
export const SPEECH_HEURISTICS = {
  pauseSeconds: 0.25, // silence between words counted as a pause
  longPauseSeconds: 0.45, // pause that lowers the Fluency score
} as const;
