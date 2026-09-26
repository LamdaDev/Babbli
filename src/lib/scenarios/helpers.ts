import type { IntentCard } from "./types";

export function card(
  id: string,
  icon: string,
  label: string,
  hints: IntentCard["hints"],
  keywords: string[],
  extra: Partial<IntentCard> = {},
): IntentCard {
  return { id, icon, label, hints, keywords, ...extra };
}
