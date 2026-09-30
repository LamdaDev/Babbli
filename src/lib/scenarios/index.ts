import { boba } from "./boba";
import { cafe } from "./cafe";
import { hotel } from "./hotel";
import { ramen } from "./ramen";
import { store } from "./store";
import type { LanguageCode, ScenarioDef } from "./types";

export const SCENARIOS: ScenarioDef[] = [store, ramen, cafe, hotel, boba];

export function getScenario(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export const LANGUAGES: { code: LanguageCode; name: string; native: string; flag: string; city: string }[] = [
  { code: "en", name: "English", native: "English", flag: "🇺🇸", city: "New York" },
  { code: "ja", name: "Japanese", native: "日本語", flag: "🇯🇵", city: "Tokyo" },
  { code: "fr", name: "French", native: "Français", flag: "🇫🇷", city: "Paris" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸", city: "Sevilla" },
  { code: "zh", name: "Mandarin", native: "中文", flag: "🇨🇳", city: "Shanghai" },
];

export function scenariosForLanguage(code: LanguageCode) {
  return SCENARIOS.filter((s) => s.language === code);
}
