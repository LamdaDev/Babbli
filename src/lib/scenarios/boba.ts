import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { containsTerm } from "@/lib/evaluation/text";
import { card } from "./helpers";
import type { Difficulty, IntentCard, Outcome, ResolveContext, ScenarioDef, ScenarioState, TurnReport, Variant } from "./types";

/** 晴茶 (Qing Cha), a bubble tea shop in Jing'an, Shanghai: the menu, shared by the scene and its art. */

/** One size (500 ml), one drink: the signature milk tea. Toppings (小料) are one per cup. */
export const MILK_TEA_PRICE = 15;

export const TOPPINGS = {
  tapioca: { zh: "珍珠", reading: "zhēnzhū", en: "tapioca pearls", price: 2 },
  lychee_jelly: { zh: "荔枝冻", reading: "lìzhī dòng", en: "lychee jelly", price: 3 },
  grass_jelly: { zh: "仙草冻", reading: "xiāncǎo dòng", en: "grass jelly", price: 3 },
  plain: { zh: "原味", reading: "yuánwèi", en: "no topping", price: 0 },
  // Never on a card: only ever misheard (仙草 xiāncǎo → 香草 xiāngcǎo), a vanilla syrup.
  vanilla: { zh: "香草", reading: "xiāngcǎo", en: "vanilla", price: 2 },
} as const;
export type Topping = keyof typeof TOPPINGS;

export const SUGAR: Record<string, { zh: string; en: string }> = {
  full: { zh: "全糖", en: "full sugar" },
  seventy: { zh: "七分糖", en: "70% sugar" },
  half: { zh: "半糖", en: "half sugar" },
  thirty: { zh: "三分糖", en: "30% sugar" },
  zero: { zh: "不加糖", en: "no sugar" },
};

export const ICE: Record<string, { zh: string; en: string }> = {
  regular: { zh: "正常冰", en: "regular ice" },
  less: { zh: "少冰", en: "less ice" },
  no_ice: { zh: "去冰", en: "no ice" },
  room: { zh: "常温", en: "room temperature" },
  hot: { zh: "热", en: "hot" },
};

const WHERE: Record<string, { zh: string; en: string }> = {
  here: { zh: "在这儿喝", en: "for here" },
  takeaway: { zh: "带走", en: "to go" },
};

/** The drink as the bar calls it: 珍珠奶茶, 荔枝冻奶茶, 原味奶茶 (no topping)… */
export const drinkZh = (topping: string) => `${TOPPINGS[topping as Topping]?.zh ?? TOPPINGS.plain.zh}奶茶`;
export const drinkEn = (topping: string) =>
  topping && topping !== "plain" ? `${TOPPINGS[topping as Topping]?.en ?? topping} milk tea` : "plain milk tea";

/** What the cup costs: the milk tea plus its topping. */
export const bobaTotal = (topping: string) => MILK_TEA_PRICE + (TOPPINGS[topping as Topping]?.price ?? 0);

/** Pickup numbers: few, so every call can be voiced ahead of time. */
const NUMBERS = ["A106", "A112", "A118", "A123", "A128", "A135"];
/** The toppings you can choose (the sold-out one included, until you hit it). */
const CHOICES = ["tapioca", "lychee_jelly", "grass_jelly"] as const;

const DIGIT_ZH = ["零", "幺", "二", "三", "四", "五", "六", "七", "八", "九"];
const DIGIT_PY = ["líng", "yāo", "èr", "sān", "sì", "wǔ", "liù", "qī", "bā", "jiǔ"];
/** A pickup number read digit by digit, the way it's called (1 is 幺, yāo): A128 → A幺二八. */
export const numberZh = (number: string) => number.replace(/\d/g, (d) => DIGIT_ZH[Number(d)]);
const numberReading = (number: string) => [number.replace(/\d/g, ""), ...[...number.replace(/\D/g, "")].map((d) => DIGIT_PY[Number(d)])].join(" ");

const NUM_ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
/** A small amount of money as it's said: 十五, 十七… and 两 for 2 (找您两块). */
function kuai(n: number) {
  if (n === 2) return "两";
  if (n < 10) return NUM_ZH[n];
  const tens = Math.floor(n / 10);
  return `${tens > 1 ? NUM_ZH[tens] : ""}十${n % 10 ? NUM_ZH[n % 10] : ""}`;
}

/** The order as she reads it back: 一杯珍珠奶茶，七分糖少冰，带走. */
function orderSummary(slots: Record<string, string>, toppingOverride?: string) {
  const topping = toppingOverride || slots.topping;
  const zh = [`一杯${drinkZh(topping)}`];
  const en = [`one ${drinkEn(topping)}`];
  const sugar = SUGAR[slots.sugar];
  const ice = ICE[slots.ice];
  if (sugar || ice) {
    const iceZh = !ice ? "" : slots.ice === "hot" ? "热的" : ice.zh;
    zh.push(slots.ice === "hot" || slots.ice === "room" ? [sugar?.zh, iceZh].filter(Boolean).join("，") : `${sugar?.zh ?? ""}${iceZh}`);
    en.push([sugar?.en, ice?.en].filter(Boolean).join(", "));
  }
  if (WHERE[slots.where]) {
    zh.push(WHERE[slots.where].zh);
    en.push(WHERE[slots.where].en);
  }
  return { zh: zh.join("，"), en: en.join(", ") };
}

/**
 * « 你帮我选吧 » / « 都可以 » / « 听你的 » make a choice, even when the agent files them under asking
 * for a recommendation: the words decide. A question (吗/呢/？, 什么/哪/几/多少) still only asks.
 */
const CHOOSING = ["你推荐吧", "推荐的就行", "帮我选", "你选吧", "都可以", "随便", "就要这个", "听你的", "你决定"];
const QUESTION = /[?？吗呢][。.！!\s]*$|什么|哪|几|多少/;
const choosesRecommendation = (report: TurnReport) => {
  if (report.intent === "no_preference") return true;
  const heard = report.heard.trim();
  return report.intent === "ask_recommendation" && !QUESTION.test(heard) && CHOOSING.some((k) => containsTerm(heard, k, "zh"));
};

/** Order details said in this utterance: a topping, sugar, ice, for here or to go. */
function details(slot: ResolveContext["slot"], names = ["topping", "sugar", "ice", "where"]) {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = slot(name);
    if (value) out[name] = value;
  }
  return out;
}

const othersZh = (soldOut: string) => CHOICES.filter((t) => t !== soldOut).map((t) => TOPPINGS[t].zh).join("和");
const othersEn = (soldOut: string) => CHOICES.filter((t) => t !== soldOut).map((t) => TOPPINGS[t].en).join(" or ");
const SOLD_OUT_NOTE = "That topping was sold out today (售罄 on the menu), and you went for another one.";

function soldOutDirective(topping: string) {
  const zh = TOPPINGS[topping as Topping].zh;
  return `Apologize: ${zh} is sold out today (不好意思，今天${zh}卖完了). Offer the other two, ${othersZh(topping)}, and ask which they'd like.`;
}
const soldOutMeaning = (topping: string) => `Sorry, the ${TOPPINGS[topping as Topping].en} is sold out today. Would you like ${othersEn(topping)}?`;

/** The fruit teas are gone for the afternoon: she suggests the milk tea. */
function fruitSoldOut(from: "greeting" | "order"): Outcome {
  const directive =
    "Apologize: the fruit teas are sold out for the afternoon (不好意思，水果茶今天下午卖完了). Suggest the signature milk tea (招牌奶茶) instead, and ask if they'd like one.";
  const meaning = "Sorry, the fruit teas are sold out this afternoon. How about our signature milk tea?";
  const extra = { setFlags: { fruitSoldOut: true }, note: "The fruit teas were sold out (售罄 on the menu), so you needed another option." };
  if (from === "order") return stay("branch", "order", directive, meaning, extra);
  return { ...advance("order", directive, meaning, extra), kind: "branch", reaction: "neutral" };
}

/** Ring the order up: the total, and scan or cash? */
function toPay(topping: string, slots: Record<string, string>, ack: string, extra: Partial<Outcome> = {}): Outcome {
  const t = bobaTotal(topping);
  return advance(
    "pay",
    `${ack} Then tell them the total, ${t}块 (一共${kuai(t)}块), and ask how they'd like to pay: scan the QR code or cash (扫码还是现金？).`,
    `That's ${t} yuan altogether. QR code or cash?`,
    { events: ["bill_shown"], ...extra, setSlots: { ...slots, served: topping } },
  );
}

/** Whichever toppings she can mishear: 仙草 xiāncǎo sounds like 香草 xiāngcǎo (vanilla); the others are real menu items. */
function mishearTopping(ordered: string, variant: Variant): Topping {
  if (ordered === "grass_jelly") return "vanilla";
  if (ordered === "lychee_jelly") return variant.soldOut === "grass_jelly" ? "tapioca" : "grass_jelly";
  if (ordered === "tapioca") return variant.soldOut === "lychee_jelly" ? "grass_jelly" : "lychee_jelly";
  return "tapioca"; // no topping: she rang up the classic out of habit
}

function mishearNote(ordered: string, heard: string) {
  if (heard === "vanilla")
    return "Xiaoyu read back 香草 (xiāngcǎo, vanilla), not 仙草 (xiāncǎo, grass jelly): -n and -ng make a different word. Listen closely to a read-back.";
  return `Xiaoyu read back ${drinkZh(heard)}, but you ordered ${drinkZh(ordered)}. Listen closely when an order is read back.`;
}

/** Entering the read-back (it may deliberately mishear the topping, once per scene). */
function toConfirm(state: ScenarioState, variant: Variant, slots: Record<string, string>, ack: string): Outcome {
  const merged = { ...state.slots, ...slots };
  const wrong = variant.mishear && !state.flags.misheardOnce ? mishearTopping(merged.topping, variant) : null;
  const heard = orderSummary(merged, wrong ?? undefined);
  return advance(
    "confirm",
    wrong
      ? `${ack} Then read the order back to confirm it, but you MISHEARD the topping: say "好的，${heard.zh}，对吗？" (NOT what they ordered). Don't hint that it might be wrong.`
      : `${ack} Then read the whole order back (好的，${heard.zh}，对吗？) and ask if that's right.`,
    `OK, ${heard.en}. Is that right?`,
    {
      setSlots: { ...slots, heard_topping: wrong ?? merged.topping },
      setFlags: { misheard: !!wrong, misheardOnce: state.flags.misheardOnce || !!wrong },
    },
  );
}

const askSugarIce = (s: Record<string, string>) =>
  !s.sugar && !s.ice
    ? "ask how sweet and how much ice they'd like (甜度和冰量呢？)."
    : !s.ice
      ? "ask how much ice they'd like (冰量呢？正常冰、少冰还是去冰？)."
      : `ask how sweet they'd like it (甜度呢？全糖、七分、半糖还是三分？)${s.ice === "hot" ? ": it's a hot one, so the ice is settled" : ""}.`;
const sugarIceMeaning = (s: Record<string, string>) => (!s.sugar && !s.ice ? "How sweet, and how much ice?" : !s.ice ? "And how much ice?" : "And how sweet?");

/** After any answer: on to whatever is still missing. Beginner goes straight from the topping to paying. */
function nextStep(state: ScenarioState, variant: Variant, difficulty: Difficulty, slots: Record<string, string>, ack: string): Outcome {
  const s = { ...state.slots, ...slots };
  if (!s.topping)
    return advance(
      "topping",
      `${ack} Then ask which topping (小料) they'd like: 珍珠 (tapioca pearls), 荔枝冻 (lychee jelly) or 仙草冻 (grass jelly).`,
      "Which topping would you like? Tapioca pearls, lychee jelly or grass jelly?",
      { setSlots: slots },
    );
  if (difficulty === "beginner") return toPay(s.topping, slots, ack);
  if (!s.sugar || !s.ice) return advance("sugar_ice", `${ack} Then ${askSugarIce(s)}`, sugarIceMeaning(s), { setSlots: slots });
  if (!s.where) return advance("to_go", `${ack} Then ask whether it's for here or to go (在这儿喝还是带走？).`, "For here or to go?", { setSlots: slots });
  return toConfirm(state, variant, slots, ack);
}

/** Ordering the milk tea (with anything else they said in the same breath). */
function orderDrink(ctx: ResolveContext, extras: Record<string, string>, ack?: string): Outcome {
  const { state, variant, difficulty } = ctx;
  const slots: Record<string, string> = { drink: "milk_tea", ...extras };
  if (slots.topping && slots.topping === variant.soldOut) {
    const rest = { ...slots };
    delete rest.topping;
    return {
      ...advance("topping", `Acknowledge the milk tea, then ${soldOutDirective(slots.topping).replace("Apologize", "apologize")}`, soldOutMeaning(slots.topping), {
        setSlots: rest,
        setFlags: { soldOutHit: true },
        note: SOLD_OUT_NOTE,
      }),
      kind: "branch",
      reaction: "neutral",
    };
  }
  return nextStep(state, variant, difficulty, slots, ack ?? `Acknowledge the order briefly (好的，${slots.topping ? drinkZh(slots.topping) : "一杯奶茶"}).`);
}

/** Choosing a topping (or none), with any sugar / ice / to-go said in the same breath. */
function chooseTopping(ctx: ResolveContext, topping: string, ack?: string): Outcome {
  const { state, variant, difficulty, slot } = ctx;
  if (topping === variant.soldOut) return stay("branch", "topping", soldOutDirective(topping), soldOutMeaning(topping), { setFlags: { soldOutHit: true }, note: SOLD_OUT_NOTE });
  const extras = details(slot, ["sugar", "ice", "where"]);
  const zh = topping === "plain" ? "好的，不加小料" : `好的，加${TOPPINGS[topping as Topping].zh}`;
  return nextStep(state, variant, difficulty, { topping, ...extras }, ack ?? `Acknowledge (${zh}).`);
}

/** Sweetness and ice: stay and ask for the missing half, or move on. */
function takeSugarIce(ctx: ResolveContext, got: Record<string, string>, ack: string): Outcome {
  const { state, variant, difficulty } = ctx;
  const s = { ...state.slots, ...got };
  if (!s.sugar || !s.ice) return stay("info", "sugar_ice", `${ack} Then ${askSugarIce(s)}`, sugarIceMeaning(s), { setSlots: got });
  return nextStep(state, variant, difficulty, got, ack);
}

const iceAck = (got: Record<string, string>) =>
  `Acknowledge (好的，${[SUGAR[got.sugar]?.zh, got.ice === "hot" ? "热的" : ICE[got.ice]?.zh].filter(Boolean).join("，")}).`;

/* ---------- cards ---------- */

const TOPPING_CARDS: Record<(typeof CHOICES)[number], IntentCard> = {
  tapioca: card("choose_topping", "⚫", "Add tapioca pearls", {
    intent: "Ask for tapioca pearls in your milk tea.",
    vocab: [
      { term: "加", reading: "jiā", meaning: "to add" },
      { term: "珍珠", reading: "zhēnzhū", meaning: "tapioca pearls (lit. pearls)" },
    ],
    starter: "加…",
    full: "加珍珠。",
    fullReading: "Jiā zhēnzhū.",
    fullMeaning: "Pearls, please.",
  }, ["珍珠"], { key: "tapioca", expect: { topping: "tapioca" }, core: true }),
  lychee_jelly: card("choose_topping", "🧊", "Choose lychee jelly", {
    intent: "Choose the lychee jelly.",
    vocab: [
      { term: "荔枝", reading: "lìzhī", meaning: "lychee" },
      { term: "冻", reading: "dòng", meaning: "jelly" },
    ],
    starter: "我要荔枝…",
    full: "我要荔枝冻。",
    fullReading: "Wǒ yào lìzhī dòng.",
    fullMeaning: "I'll have lychee jelly.",
  }, ["荔枝"], { key: "lychee", expect: { topping: "lychee_jelly" }, core: true }),
  grass_jelly: card("choose_topping", "⬛", "Choose grass jelly", {
    intent: "Go for the grass jelly.",
    vocab: [
      { term: "仙草冻", reading: "xiāncǎo dòng", meaning: "grass jelly (a dark herbal jelly)" },
      { term: "吧", reading: "ba", meaning: "(softens it: \"I think\")" },
    ],
    starter: "仙草…",
    full: "仙草冻吧。",
    fullReading: "Xiāncǎo dòng ba.",
    fullMeaning: "Grass jelly, I think.",
  }, ["仙草"], { key: "grass", expect: { topping: "grass_jelly" }, core: true }),
};

const takeSuggestion = (special: string) =>
  card("choose_topping", "👍", "Take her suggestion", {
    intent: `Go with the topping Xiaoyu just recommended: ${TOPPINGS[special as Topping].en}.`,
    vocab: [
      { term: "那就", reading: "nà jiù", meaning: "then, in that case" },
      { term: TOPPINGS[special as Topping].zh, reading: TOPPINGS[special as Topping].reading, meaning: TOPPINGS[special as Topping].en },
    ],
    starter: "那就加…",
    full: `那就加${TOPPINGS[special as Topping].zh}吧。`,
    fullReading: `Nà jiù jiā ${TOPPINGS[special as Topping].reading} ba.`,
    fullMeaning: `Then ${TOPPINGS[special as Topping].en}, please.`,
  }, [TOPPINGS[special as Topping].zh.slice(0, 2), "那就"], { key: "take_suggestion", expect: { topping: special }, core: true });

/** Sugar-and-ice cards for whatever she still needs to know. */
function sugarIceCards(state: ScenarioState): IntentCard[] {
  const needSugar = !state.slots.sugar;
  const needIce = !state.slots.ice;
  const rec = state.flags.sugarRecommended;
  const options = card("ask_options", "🤔", needSugar ? "Ask what the sweetness options are" : "Ask what the ice options are", {
    intent: needSugar ? "Ask which sweetness levels you can choose from." : "Ask which ice levels you can choose from.",
    vocab: needSugar
      ? [
          { term: "甜度", reading: "tiándù", meaning: "sweetness level" },
          { term: "哪几种", reading: "nǎ jǐ zhǒng", meaning: "which kinds?" },
        ]
      : [
          { term: "冰量", reading: "bīngliàng", meaning: "amount of ice" },
          { term: "哪几种", reading: "nǎ jǐ zhǒng", meaning: "which kinds?" },
        ],
    starter: needSugar ? "甜度…" : "冰量…",
    full: needSugar ? "甜度有哪几种？" : "冰量有哪几种？",
    fullReading: needSugar ? "Tiándù yǒu nǎ jǐ zhǒng?" : "Bīngliàng yǒu nǎ jǐ zhǒng?",
    fullMeaning: needSugar ? "What sweetness levels are there?" : "What ice levels are there?",
  }, needSugar ? ["甜度", "哪几种"] : ["冰量", "哪几种"], { key: needSugar ? "options_sugar" : "options_ice" });

  if (needSugar && needIce)
    return [
      card("customize", "🍯", "Ask for 70% sugar and less ice", {
        intent: "Ask for 70% sweetness and less ice, the most popular way.",
        vocab: [
          { term: "七分糖", reading: "qī fēn táng", meaning: "70% sugar (lit. seven parts sugar)" },
          { term: "少冰", reading: "shǎo bīng", meaning: "less ice" },
        ],
        starter: "七分糖，…",
        full: "七分糖，少冰。",
        fullReading: "Qī fēn táng, shǎo bīng.",
        fullMeaning: "70% sugar, less ice.",
      }, ["七分", "少冰"], { key: "seventy_less", expect: { sugar: "seventy", ice: "less" }, core: true }),
      card("customize", "🌗", "Ask for half sugar and no ice", {
        intent: "Ask for half the sugar and no ice.",
        vocab: [
          { term: "半糖", reading: "bàn táng", meaning: "half sugar" },
          { term: "去冰", reading: "qù bīng", meaning: "no ice (lit. remove the ice)" },
        ],
        starter: "半糖，…",
        full: "半糖，去冰。",
        fullReading: "Bàn táng, qù bīng.",
        fullMeaning: "Half sugar, no ice.",
      }, ["半糖", "去冰"], { key: "half_none", expect: { sugar: "half", ice: "no_ice" }, core: true }),
      card("customize", "🌡️", "Ask for 30% sugar at room temperature", {
        intent: "Ask for 30% sweetness, and no ice at all: room temperature.",
        vocab: [
          { term: "三分糖", reading: "sān fēn táng", meaning: "30% sugar" },
          { term: "常温", reading: "chángwēn", meaning: "room temperature" },
        ],
        starter: "三分糖，…",
        full: "三分糖，常温的。",
        fullReading: "Sān fēn táng, chángwēn de.",
        fullMeaning: "30% sugar, room temperature.",
      }, ["三分", "常温"], { key: "thirty_room", expect: { sugar: "thirty", ice: "room" }, core: true }),
      card("customize", "♨️", "Ask for no sugar, and hot", {
        intent: "Say you don't want sugar, and you'd like it hot.",
        vocab: [
          { term: "不要糖", reading: "bú yào táng", meaning: "no sugar" },
          { term: "热的", reading: "rè de", meaning: "a hot one" },
        ],
        starter: "不要糖，…",
        full: "不要糖，要热的。",
        fullReading: "Bú yào táng, yào rè de.",
        fullMeaning: "No sugar, and make it hot.",
      }, ["不要糖", "热的"], { key: "zero_hot", expect: { sugar: "zero", ice: "hot" }, core: true }),
      card("customize", "🍬", "Say full sugar is fine", {
        intent: "Say you're happy with the full sweetness.",
        vocab: [
          { term: "全糖", reading: "quán táng", meaning: "full sugar" },
          { term: "就好", reading: "jiù hǎo", meaning: "…is fine" },
        ],
        starter: "全糖…",
        full: "全糖就好。",
        fullReading: "Quán táng jiù hǎo.",
        fullMeaning: "Full sugar is fine.",
      }, ["全糖"], { key: "full_only", expect: { sugar: "full" }, core: true }),
      card("customize", "🧊", "Just say less ice", {
        intent: "Just ask for less ice.",
        vocab: [
          { term: "少冰", reading: "shǎo bīng", meaning: "less ice" },
          { term: "就行", reading: "jiù xíng", meaning: "that'll do" },
        ],
        starter: "少冰…",
        full: "少冰就行。",
        fullReading: "Shǎo bīng jiù xíng.",
        fullMeaning: "Just less ice.",
      }, ["少冰"], { key: "less_only", expect: { ice: "less" }, core: true }),
      rec
        ? card("customize", "👍", "Take her suggestion", {
            intent: "Go with what she recommended: 70% sugar, less ice.",
            vocab: [
              { term: "那就", reading: "nà jiù", meaning: "then, in that case" },
              { term: "七分糖少冰", reading: "qī fēn táng shǎo bīng", meaning: "70% sugar, less ice" },
            ],
            starter: "那就七分糖…",
            full: "那就七分糖少冰吧。",
            fullReading: "Nà jiù qī fēn táng shǎo bīng ba.",
            fullMeaning: "Then 70% sugar, less ice.",
          }, ["七分", "那就"], { key: "rec_take", expect: { sugar: "seventy", ice: "less" }, core: true })
        : card("ask_recommendation", "⭐", "Ask how sweet she recommends", {
            intent: "Ask how sweet she'd recommend it.",
            vocab: [
              { term: "推荐", reading: "tuījiàn", meaning: "to recommend" },
              { term: "几分糖", reading: "jǐ fēn táng", meaning: "how much sugar? (lit. how many parts)" },
            ],
            starter: "你们推荐…",
            full: "你们推荐几分糖？",
            fullReading: "Nǐmen tuījiàn jǐ fēn táng?",
            fullMeaning: "How sweet do you recommend?",
          }, ["几分", "推荐"], { key: "rec_sugar" }),
      options,
    ];
  if (needSugar)
    return [
      card("customize", "🍯", "Ask for 70% sugar", {
        intent: "Ask for 70% sweetness.",
        vocab: [{ term: "七分糖", reading: "qī fēn táng", meaning: "70% sugar" }],
        starter: "七分…",
        full: "七分糖。",
        fullReading: "Qī fēn táng.",
        fullMeaning: "70% sugar.",
      }, ["七分"], { key: "s_seventy", expect: { sugar: "seventy" }, core: true }),
      card("customize", "🌗", "Say half sugar is fine", {
        intent: "Say half the sugar is fine.",
        vocab: [
          { term: "半糖", reading: "bàn táng", meaning: "half sugar" },
          { term: "就好", reading: "jiù hǎo", meaning: "…is fine" },
        ],
        starter: "半糖…",
        full: "半糖就好。",
        fullReading: "Bàn táng jiù hǎo.",
        fullMeaning: "Half sugar is fine.",
      }, ["半糖"], { key: "s_half", expect: { sugar: "half" }, core: true }),
      card("customize", "🍃", "Ask for 30% sugar", {
        intent: "Ask for just 30% sweetness.",
        vocab: [{ term: "三分糖", reading: "sān fēn táng", meaning: "30% sugar" }],
        starter: "三分…",
        full: "三分糖吧。",
        fullReading: "Sān fēn táng ba.",
        fullMeaning: "30% sugar, I think.",
      }, ["三分"], { key: "s_thirty", expect: { sugar: "thirty" }, core: true }),
      card("customize", "🍬", "Ask for full sugar", {
        intent: "Ask for the full sweetness.",
        vocab: [{ term: "全糖", reading: "quán táng", meaning: "full sugar" }],
        starter: "全糖…",
        full: "全糖，谢谢。",
        fullReading: "Quán táng, xièxie.",
        fullMeaning: "Full sugar, thanks.",
      }, ["全糖"], { key: "s_full", expect: { sugar: "full" }, core: true }),
      card("customize", "🚫", "Say no sugar", {
        intent: "Say you don't want any sugar.",
        vocab: [{ term: "不要糖", reading: "bú yào táng", meaning: "no sugar" }],
        starter: "不要…",
        full: "不要糖。",
        fullReading: "Bú yào táng.",
        fullMeaning: "No sugar.",
      }, ["不要糖", "无糖", "不加糖"], { key: "s_zero", expect: { sugar: "zero" }, core: true }),
      rec
        ? card("customize", "👍", "Take her suggestion", {
            intent: "Go with the sweetness she recommended: 70%.",
            vocab: [
              { term: "那就", reading: "nà jiù", meaning: "then, in that case" },
              { term: "七分糖", reading: "qī fēn táng", meaning: "70% sugar" },
            ],
            starter: "那就七分…",
            full: "那就七分糖吧。",
            fullReading: "Nà jiù qī fēn táng ba.",
            fullMeaning: "Then 70% sugar.",
          }, ["七分", "那就"], { key: "rec_take_sugar", expect: { sugar: "seventy" }, core: true })
        : card("ask_recommendation", "⭐", "Ask how sweet she recommends", {
            intent: "Ask how sweet she'd recommend it.",
            vocab: [
              { term: "推荐", reading: "tuījiàn", meaning: "to recommend" },
              { term: "几分糖", reading: "jǐ fēn táng", meaning: "how much sugar? (lit. how many parts)" },
            ],
            starter: "你们推荐…",
            full: "你们推荐几分糖？",
            fullReading: "Nǐmen tuījiàn jǐ fēn táng?",
            fullMeaning: "How sweet do you recommend?",
          }, ["几分", "推荐"], { key: "rec_sugar" }),
      options,
    ];
  return [
    card("customize", "🧊", "Ask for less ice", {
      intent: "Ask for less ice.",
      vocab: [{ term: "少冰", reading: "shǎo bīng", meaning: "less ice" }],
      starter: "少…",
      full: "少冰。",
      fullReading: "Shǎo bīng.",
      fullMeaning: "Less ice.",
    }, ["少冰"], { key: "i_less", expect: { ice: "less" }, core: true }),
    card("customize", "🚫", "Ask for no ice", {
      intent: "Ask for no ice.",
      vocab: [{ term: "去冰", reading: "qù bīng", meaning: "no ice (lit. remove the ice)" }],
      starter: "去冰…",
      full: "去冰吧。",
      fullReading: "Qù bīng ba.",
      fullMeaning: "No ice, I think.",
    }, ["去冰"], { key: "i_none", expect: { ice: "no_ice" }, core: true }),
    card("customize", "🥤", "Say regular ice is fine", {
      intent: "Say the normal amount of ice is fine.",
      vocab: [
        { term: "正常冰", reading: "zhèngcháng bīng", meaning: "regular ice" },
        { term: "就行", reading: "jiù xíng", meaning: "that'll do" },
      ],
      starter: "正常冰…",
      full: "正常冰就行。",
      fullReading: "Zhèngcháng bīng jiù xíng.",
      fullMeaning: "Regular ice is fine.",
    }, ["正常冰"], { key: "i_regular", expect: { ice: "regular" }, core: true }),
    card("customize", "🌡️", "Ask for it at room temperature", {
      intent: "Ask for it at room temperature: not cold, not hot.",
      vocab: [{ term: "常温", reading: "chángwēn", meaning: "room temperature" }],
      starter: "常温…",
      full: "常温的。",
      fullReading: "Chángwēn de.",
      fullMeaning: "Room temperature.",
    }, ["常温"], { key: "i_room", expect: { ice: "room" }, core: true }),
    card("customize", "♨️", "Ask for it hot", {
      intent: "Ask for a hot one.",
      vocab: [{ term: "热的", reading: "rè de", meaning: "a hot one" }],
      starter: "要热…",
      full: "要热的。",
      fullReading: "Yào rè de.",
      fullMeaning: "Hot, please.",
    }, ["热的"], { key: "i_hot", expect: { ice: "hot" }, core: true }),
    rec
      ? card("customize", "👍", "Take her suggestion", {
          intent: "Go with the ice she recommended: less ice.",
          vocab: [
            { term: "那就", reading: "nà jiù", meaning: "then, in that case" },
            { term: "少冰", reading: "shǎo bīng", meaning: "less ice" },
          ],
          starter: "那就少…",
          full: "那就少冰吧。",
          fullReading: "Nà jiù shǎo bīng ba.",
          fullMeaning: "Then less ice.",
        }, ["少冰", "那就"], { key: "rec_take_ice", expect: { ice: "less" }, core: true })
      : card("ask_recommendation", "⭐", "Ask which ice level she recommends", {
          intent: "Ask whether she'd recommend less ice or no ice.",
          vocab: [
            { term: "推荐", reading: "tuījiàn", meaning: "to recommend" },
            { term: "还是", reading: "háishi", meaning: "or (in a question)" },
          ],
          starter: "你推荐少冰…",
          full: "你推荐少冰还是去冰？",
          fullReading: "Nǐ tuījiàn shǎo bīng háishi qù bīng?",
          fullMeaning: "Do you recommend less ice or no ice?",
        }, ["推荐", "还是"], { key: "rec_ice" }),
    options,
  ];
}

/* ---------- the scene ---------- */

export const boba: ScenarioDef = {
  id: "boba",
  language: "zh",
  languageName: "中文",
  languageEnglish: "Mandarin Chinese",
  flag: "🇨🇳",
  city: "Shanghai",
  locationLabel: "SHANGHAI · JING'AN",
  title: "Shanghai Boba Shop",
  venueName: "晴茶 · Qing Cha",
  objective: "Order a milk tea with the topping you like, pay, and leave with your drink.",
  goal: "Order a milk tea and pay",
  demoRole: "generalization",
  isNew: true,
  blurb: "A bright, minimalist tea shop in Jing'an on a hot Saturday afternoon. Xiaoyu is at the register and the shakers never stop.",
  npc: {
    name: "Xiaoyu",
    role: "Cashier",
    voiceKey: "xiaoyu",
    look: {
      skin: "#f7dccb",
      skinShade: "#e8c1aa",
      hair: "#15110f",
      hairStyle: "ponytail",
      outfit: "#f4f2ee",
      outfitShade: "#dcd8d0",
      apron: "#1d1d1f",
      accent: "#7fb89a",
      accessory: "headset",
      eyes: "#241a16",
      build: "slender",
      makeup: { lashes: true, lips: "#d4687a", blush: "#f6a5ad" },
      apronMark: "晴",
      badgeText: "小雨",
    },
  },
  backgroundVoices: {
    bar: { voiceKey: "ahao", name: "Ahao (drinks bar)" },
    caller: { voiceKey: "caller_zh", name: "Pickup screen" },
  },
  art: "boba",
  ambienceAsset: "boba-ambience",
  sfx: { enter: "boba-door", order_placed: "boba-shaker", time_skip: "boba-sealer", payment_done: "boba-pay", item_shown: "boba-straw" },
  briefing: {
    title: "Your notes",
    lines: ["¥20 in cash · a payment app on your phone", "It's 33 °C outside and you really want a milk tea", "Look for 售罄 (sold out) tags on the menu"],
  },
  initialStage: "greeting",
  randomizeCards: true,
  requiredSlots: ["drink", "topping", "paid"],
  intents: {
    order_drink:
      "Orders a drink (我要一杯奶茶, 来一杯奶茶, 请给我一杯…, 珍珠奶茶): fill `drink` (milk_tea for any milk tea; other for fruit tea or anything else), plus `topping` / `sugar` / `ice` / `where` if they say them too (珍珠奶茶 = milk_tea + tapioca, 热奶茶 = ice hot)",
    ask_order_here: "Asks if they can order here, at your register (可以在这儿点单吗？)",
    ask_menu: "Asks for the menu or where it is (有菜单吗？, 菜单在哪儿？)",
    ask_english_menu: "Asks if there's an English menu (有英文菜单吗？)",
    ask_recommendation:
      "Asks a QUESTION about what you recommend, without choosing yet (有什么推荐的吗？, 哪个好喝？, 哪个比较好吃？, 你们推荐几分糖？)",
    no_preference:
      "Chooses your recommendation or leaves the choice to you: a CHOICE, not a question (你推荐吧, 你帮我选吧, 都可以, 随便, 就要这个, 听你的)",
    ask_time: "Asks for a moment to decide (我再看看, 等一下)",
    ask_price: "Asks how much something costs (多少钱？, 一共多少钱？, 加小料多少钱？)",
    choose_topping: "Chooses a topping, or none (加珍珠, 我要荔枝冻, 仙草冻吧, 不加了): fill `topping` (plain = no topping)",
    ask_about_topping: "Asks what a topping is or what it's like (仙草冻是什么？, 珍珠甜吗？): fill `topping` with the one they ask about",
    ask_two_toppings: "Asks for two toppings in one cup (可以加两种吗？, 珍珠和荔枝冻都要)",
    customize: "Says the sweetness and/or the ice (七分糖少冰, 半糖去冰, 常温, 要热的, 不要糖): fill `sugar` and/or `ice`",
    ask_options: "Asks what the sweetness or ice options are (甜度有哪几种？, 冰量有哪些？)",
    to_go: "Says whether it's for here or to go (带走, 打包, 在这儿喝): fill `where`",
    ask_seat: "Asks if there are seats (有座位吗？)",
    ask_wait_time: "Asks how long it takes (要等多久？, 大概多久？)",
    ask_pickup: "Asks where or how to pick the drink up (在哪儿取？, 在哪儿拿？)",
    confirm: "Confirms your read-back is correct (对, 没错, 是的, 对的)",
    correct_order: "Says your read-back is wrong and corrects it (不对, 不是…是…): fill the slot they correct, e.g. `topping`",
    change_order: "Changes part of the order after the read-back (改成去冰, 换成半糖): fill the slots they change",
    pay: "Pays or says how (我扫你, 你扫我, 扫码, 给你现金, 刷卡): fill `payment_method`",
    ask_card: "Asks whether cards are accepted (可以刷卡吗？)",
    ask_payment: "Asks whether a payment app or method works (可以用支付宝吗？, 微信可以吗？)",
    ask_receipt: "Asks for a receipt (可以给我小票吗？)",
    claim_order: "Says which drink is theirs or gives their number (我是A128号, 这杯是我的吗？)",
    ask_straw: "Asks for a straw (可以给我一根吸管吗？)",
    ask_toilet: "Asks where the restroom is (洗手间在哪儿？)",
    compliment: "Compliments the drink or the shop (看起来很好喝！, 好喝！)",
    come_again: "Says they'll come again (我下次再来！)",
    decline: "Politely turns something down (不用了，谢谢)",
  },
  slots: {
    drink: { description: "Drink ordered: milk_tea for any milk tea (珍珠奶茶 included), other for fruit tea or anything else", values: ["milk_tea", "other"] },
    topping: {
      description: "Topping (小料): tapioca = 珍珠, lychee_jelly = 荔枝冻, grass_jelly = 仙草冻, plain = no topping (不加)",
      values: ["tapioca", "lychee_jelly", "grass_jelly", "plain"],
    },
    sugar: {
      description: "Sweetness (甜度): full = 全糖, seventy = 七分糖, half = 半糖 or 五分糖, thirty = 三分糖, zero = 不要糖 / 无糖 / 不加糖",
      values: ["full", "seventy", "half", "thirty", "zero"],
    },
    ice: {
      description: "Ice (冰量) or temperature: regular = 正常冰, less = 少冰, no_ice = 去冰, room = 常温, hot = 热的",
      values: ["regular", "less", "no_ice", "room", "hot"],
    },
    where: { description: "For here or to go: here = 在这儿喝 / 堂食, takeaway = 带走 / 打包", values: ["here", "takeaway"] },
    payment_method: {
      description: "How they pay: scan = they scan your QR code (我扫你, 扫码), show_code = you scan the payment code on their phone (你扫我), cash = 现金, card = 刷卡",
      values: ["scan", "show_code", "cash", "card"],
    },
  },
  greetings: {
    beginner: [
      { text: "欢迎光临！你好！", meaning: "Welcome! Hello!" },
      { text: "你好，欢迎光临！", meaning: "Hello, welcome!" },
      { text: "欢迎光临！您好！", meaning: "Welcome! Hello!" },
    ],
    intermediate: [
      { text: "欢迎光临！您好，想喝点什么？", meaning: "Welcome! Hello, what would you like to drink?" },
      { text: "您好，欢迎光临！今天想喝点什么？", meaning: "Hello, welcome! What would you like today?" },
      {
        text: "欢迎光临～您好，这边可以点单哦。",
        meaning: "Welcome! Hi, you can order right here.",
        forms: { masculine: "欢迎光临～帅哥，这边可以点单哦。", feminine: "欢迎光临～美女，这边可以点单哦。" },
      },
    ],
    immersion: [
      {
        text: "欢迎光临～喝点啥？",
        meaning: "Welcome! What'll it be?",
        forms: { masculine: "欢迎光临～帅哥，喝点啥？", feminine: "欢迎光临～美女，喝点啥？" },
      },
      { text: "您好～要喝点什么？", meaning: "Hi! What would you like to drink?" },
      {
        text: "欢迎光临！看看喝点啥？",
        meaning: "Welcome! Have a look, what'll you have?",
        forms: { masculine: "帅哥，欢迎光临！看看喝点啥？", feminine: "美女，欢迎光临！看看喝点啥？" },
      },
    ],
  },
  makeVariant: (difficulty, rand) => {
    const special: Topping = rand() < 0.7 ? "tapioca" : "grass_jelly";
    const soldOutChance = difficulty === "beginner" ? 0 : difficulty === "immersion" ? 0.4 : 0.25;
    const soldOut = rand() < soldOutChance ? pick<Topping>((["lychee_jelly", "grass_jelly"] as Topping[]).filter((t) => t !== special), rand) : "";
    return {
      special,
      soldOut,
      mishear: difficulty !== "beginner" && rand() < (difficulty === "immersion" ? 0.45 : 0.3),
      cardOk: rand() < 0.5,
      number: pick(NUMBERS, rand),
    };
  },
  persona:
    "You are Xiaoyu (小雨), 22, the cheerful cashier at 晴茶 (Qing Cha), a bright, minimalist bubble tea shop in Jing'an, Shanghai. It's a hot, busy Saturday afternoon. Your coworker Ahao (阿浩) makes the drinks at the bar behind you and calls out orders. You're quick, sweet and efficient, exactly like staff at a popular Chinese tea shop, and you use natural shop-talk (欢迎光临, 好嘞, 请稍等, 慢走). The customer has just walked up to your register.",
  facts: (v) => {
    const soldOut = v.soldOut ? TOPPINGS[v.soldOut as Topping] : null;
    const special = TOPPINGS[v.special as Topping];
    const number = String(v.number);
    return [
      "MENU (prices in 元, but say 块 when you speak): 招牌奶茶 (signature milk tea) 15元, one size (500 ml). The fruit teas (水果茶) are SOLD OUT for the afternoon (售罄) after a delivery rush.",
      `TOPPINGS (小料), one per cup: 珍珠 (tapioca pearls, freshly cooked, chewy and bouncy: Q弹) +2元; 荔枝冻 (lychee jelly, light and fruity) +3元; 仙草冻 (grass jelly: black, a little herbal and bitter, very refreshing) +3元.${soldOut ? ` SOLD OUT today: ${soldOut.zh} (今天${soldOut.zh}卖完了).` : ""}`,
      `Your topping recommendation today: ${special.zh}${v.special === "grass_jelly" ? " (夏天喝很清爽, so refreshing in summer)" : " (现煮的，特别Q弹, freshly cooked and extra chewy)"}.`,
      "SWEETNESS (甜度): 全糖, 七分糖 (the most popular), 半糖 (= 五分糖), 三分糖, 不另外加糖 (no added sugar). ICE (冰量): 正常冰, 少冰, 去冰, 常温 (room temperature), or 热 (hot). For a first visit you recommend 七分糖少冰.",
      `PAYMENT: by QR code, either the customer scans the shop's code on the acrylic stand (我扫你) or shows their own payment code for you to scan (你扫我); 支付宝 and 微信 both work. Cash works too. ${v.cardOk ? "Bank cards work on the terminal (可以刷卡)." : "NO bank cards today (不能刷卡): only QR code or cash."}`,
      `AFTER PAYING: they get a receipt (小票) with their pickup number (取餐号), ${number}. Write it as printed (${number}号); it's read digit by digit, 1 as 幺 (yāo). It takes about five minutes; the number shows on the screen and is announced, and pickup is at the counter on the right.`,
      "OTHER: no English menu, but every drink has a photo. They can also order in the mini program by scanning the code on the counter. Restroom: in the mall, out the door to the left. The Wi-Fi password is on the receipt. There are a few stools by the window.",
      v.mishear ? "On the syrup rail there's also 香草 (vanilla) +2元, rarely ordered: never suggest it." : "",
      "ADDRESS the customer as 您. Only call them 帅哥 or 美女 if the note about the customer says so.",
    ]
      .filter(Boolean)
      .join("\n");
  },
  asrKeywords: [
    "奶茶", "珍珠", "荔枝冻", "仙草冻", "小料", "七分糖", "半糖", "三分糖", "全糖", "无糖", "少冰", "去冰", "正常冰", "常温", "热的",
    "带走", "打包", "扫码", "现金", "刷卡", "支付宝", "微信", "小票", "吸管", "推荐", "招牌", "多少钱", "谢谢", "再见", "拜拜",
  ],
  vocabulary: [
    { term: "欢迎光临", reading: "huānyíng guānglín", meaning: "Welcome (to the shop)", stages: ["greeting"] },
    { term: "你好 / 您好", reading: "nǐ hǎo / nín hǎo", meaning: "hello / hello (polite)", stages: ["greeting"] },
    { term: "帅哥 / 美女", reading: "shuàigē / měinǚ", meaning: "friendly shop-talk for a young man / woman", stages: ["greeting"] },
    { term: "点单", reading: "diǎndān", meaning: "to order (at a counter)", stages: ["greeting", "order"] },
    { term: "奶茶", reading: "nǎichá", meaning: "milk tea", stages: ["greeting", "order"] },
    { term: "一杯", reading: "yì bēi", meaning: "one cup (of)", stages: ["greeting", "order"] },
    { term: "来一杯", reading: "lái yì bēi", meaning: "I'll have one (casual)", stages: ["order"] },
    { term: "招牌", reading: "zhāopái", meaning: "house signature (best seller)", stages: ["order"] },
    { term: "推荐", reading: "tuījiàn", meaning: "to recommend", stages: ["greeting", "order", "topping", "sugar_ice"] },
    { term: "多少钱", reading: "duōshao qián", meaning: "how much (money)?", stages: ["order", "confirm", "pay"] },
    { term: "售罄 / 卖完了", reading: "shòuqìng / mài wán le", meaning: "sold out (written / spoken)", stages: ["order", "topping"] },
    { term: "小料", reading: "xiǎoliào", meaning: "toppings", stages: ["topping"] },
    { term: "珍珠", reading: "zhēnzhū", meaning: "tapioca pearls (lit. pearls)", stages: ["topping"] },
    { term: "荔枝冻", reading: "lìzhī dòng", meaning: "lychee jelly", stages: ["topping"] },
    { term: "仙草冻", reading: "xiāncǎo dòng", meaning: "grass jelly (a dark herbal jelly)", stages: ["topping", "confirm"] },
    { term: "Q弹", reading: "Q tán", meaning: "bouncy and chewy (food slang)", stages: ["topping"] },
    { term: "甜度", reading: "tiándù", meaning: "sweetness level", stages: ["sugar_ice"] },
    { term: "七分糖 / 全糖 / 半糖 / 三分糖 / 无糖", reading: "qī fēn táng / quán táng / bàn táng / sān fēn táng / wú táng", meaning: "70% / full / half / 30% / no sugar", stages: ["sugar_ice"] },
    { term: "冰量", reading: "bīngliàng", meaning: "amount of ice", stages: ["sugar_ice"] },
    { term: "少冰 / 正常冰 / 去冰", reading: "shǎo bīng / zhèngcháng bīng / qù bīng", meaning: "less / regular / no ice", stages: ["sugar_ice"] },
    { term: "常温", reading: "chángwēn", meaning: "room temperature", stages: ["sugar_ice"] },
    { term: "热的", reading: "rè de", meaning: "a hot one", stages: ["order", "sugar_ice"] },
    { term: "带走", reading: "dàizǒu", meaning: "to go (lit. take away)", stages: ["to_go"] },
    { term: "在这儿喝", reading: "zài zhèr hē", meaning: "(I'll) drink it here", stages: ["to_go"] },
    { term: "打包", reading: "dǎbāo", meaning: "to pack up (to go)", stages: ["to_go"] },
    { term: "对 / 没错", reading: "duì / méi cuò", meaning: "right / that's right", stages: ["confirm"] },
    { term: "不对", reading: "bú duì", meaning: "that's not right", stages: ["confirm"] },
    { term: "香草", reading: "xiāngcǎo", meaning: "vanilla (careful: not 仙草 xiāncǎo)", stages: ["confirm"] },
    { term: "一共", reading: "yígòng", meaning: "altogether, in total", stages: ["confirm", "pay"] },
    { term: "块", reading: "kuài", meaning: "yuan, when speaking (menus say 元)", stages: ["pay"] },
    { term: "扫码", reading: "sǎomǎ", meaning: "to scan a QR code", stages: ["pay"] },
    { term: "我扫你 / 你扫我", reading: "wǒ sǎo nǐ / nǐ sǎo wǒ", meaning: "I'll scan your code / you scan mine", stages: ["pay"] },
    { term: "付款码", reading: "fùkuǎnmǎ", meaning: "your payment code (in your app)", stages: ["pay"] },
    { term: "现金", reading: "xiànjīn", meaning: "cash", stages: ["pay"] },
    { term: "找您", reading: "zhǎo nín", meaning: "here's your change", stages: ["pay"] },
    { term: "刷卡", reading: "shuākǎ", meaning: "to pay by card (lit. swipe a card)", stages: ["pay"] },
    { term: "小票", reading: "xiǎopiào", meaning: "receipt", stages: ["pay", "pickup"] },
    { term: "取餐", reading: "qǔcān", meaning: "to pick up an order", stages: ["to_go", "pickup"] },
    { term: "号", reading: "hào", meaning: "number", stages: ["pay", "pickup"] },
    { term: "幺", reading: "yāo", meaning: "\"one\" when reading digits (A128 = A幺二八)", stages: ["pay", "pickup"] },
    { term: "请稍等", reading: "qǐng shāo děng", meaning: "one moment, please", stages: ["pay"] },
    { term: "吸管", reading: "xīguǎn", meaning: "straw", stages: ["pickup"] },
    { term: "好喝", reading: "hǎohē", meaning: "tasty (for drinks)", stages: ["pickup"] },
    { term: "慢走", reading: "mànzǒu", meaning: "take care (lit. walk slowly)", stages: ["pickup"] },
    { term: "欢迎下次光临", reading: "huānyíng xiàcì guānglín", meaning: "please come again", stages: ["pickup"] },
  ],
  eventLines: {
    // The bar calls the drink being made: the misheard topping if nobody caught it, the corrected one if they did.
    order_placed: (s) => {
      const topping = s.slots.served || s.slots.heard_topping || s.slots.topping;
      return { voice: "bar", text: `好嘞！${drinkZh(topping)}一杯！`, meaning: `Coming up! One ${drinkEn(topping)}!` };
    },
    // The pickup screen calls the number after the sealer. Written as printed (A128): the voice reads a
    // code like this digit by digit, 1 as 幺 (spelling it A幺二八 garbles it).
    time_skip: (s) => ({
      voice: "caller",
      text: `请${s.slots.ticket}号顾客取餐。`,
      meaning: `Customer ${s.slots.ticket}, please pick up your order.`,
    }),
  },
  timeSkipText: "A few minutes later… the shaker stops, the sealer thunks, and your number lights up on the screen.",
  successTitle: "好喝！",
  stages: [
    {
      id: "greeting",
      group: "Greeting",
      npcGoal: "Welcome the customer and ask what they'd like to drink (想喝点什么？).",
      meaning: "Welcome! What would you like to drink?",
      situation: "You've walked up to the register, and Xiaoyu welcomed you.",
      cards: () => [
        card("greet", "👋", "Say hello back", {
          intent: "Return Xiaoyu's greeting.",
          vocab: [{ term: "你好", reading: "nǐ hǎo", meaning: "hello" }],
          starter: "你…",
          full: "你好！",
          fullReading: "Nǐ hǎo!",
          fullMeaning: "Hello!",
        }, ["你好", "哈喽"], { core: true }),
        card("greet", "🙂", "Greet her politely", {
          intent: "Return her greeting with the polite form of \"you\".",
          vocab: [{ term: "您好", reading: "nín hǎo", meaning: "hello (您 is the respectful \"you\")" }],
          starter: "您…",
          full: "您好！",
          fullReading: "Nín hǎo!",
          fullMeaning: "Hello! (polite)",
        }, ["您好"], { key: "greet_polite", core: true }),
        card("order_drink", "🧋", "Say hi and ask for a milk tea", {
          intent: "Greet her and ask for a milk tea straight away.",
          vocab: [
            { term: "我要", reading: "wǒ yào", meaning: "I'd like" },
            { term: "一杯", reading: "yì bēi", meaning: "one cup (of)" },
            { term: "奶茶", reading: "nǎichá", meaning: "milk tea" },
          ],
          starter: "你好，我要…",
          full: "你好，我要一杯奶茶。",
          fullReading: "Nǐ hǎo, wǒ yào yì bēi nǎichá.",
          fullMeaning: "Hi, I'd like a milk tea.",
        }, ["奶茶"], { key: "hi_milk_tea", expect: { drink: "milk_tea" }, core: true }),
        card("order_drink", "🙏", "Say hi and ask for a milk tea, politely", {
          intent: "Greet her and politely ask for a milk tea.",
          vocab: [
            { term: "请给我", reading: "qǐng gěi wǒ", meaning: "please give me" },
            { term: "一杯奶茶", reading: "yì bēi nǎichá", meaning: "a milk tea" },
          ],
          starter: "你好，请给我…",
          full: "你好，请给我一杯奶茶。",
          fullReading: "Nǐ hǎo, qǐng gěi wǒ yì bēi nǎichá.",
          fullMeaning: "Hi, a milk tea, please.",
        }, ["请给我", "奶茶"], { key: "hi_milk_tea_polite", expect: { drink: "milk_tea" }, core: true }),
        card("ask_order_here", "🛎️", "Ask if you can order here", {
          intent: "Check that this is where you order.",
          vocab: [
            { term: "可以", reading: "kěyǐ", meaning: "can, may" },
            { term: "在这儿", reading: "zài zhèr", meaning: "here" },
            { term: "点单", reading: "diǎndān", meaning: "to order" },
          ],
          starter: "你好，可以在这儿…",
          full: "你好，可以在这儿点单吗？",
          fullReading: "Nǐ hǎo, kěyǐ zài zhèr diǎndān ma?",
          fullMeaning: "Hi, can I order here?",
        }, ["点单"], { core: true }),
        card("ask_menu", "📋", "Ask for the menu", {
          intent: "Greet her and ask if there's a menu.",
          vocab: [
            { term: "有…吗", reading: "yǒu…ma", meaning: "is there…? / do you have…?" },
            { term: "菜单", reading: "càidān", meaning: "menu" },
          ],
          starter: "你好，有…",
          full: "你好，有菜单吗？",
          fullReading: "Nǐ hǎo, yǒu càidān ma?",
          fullMeaning: "Hi, is there a menu?",
        }, ["菜单"], { core: true }),
        card("ask_english_menu", "🔤", "Ask if there's an English menu", {
          intent: "Ask whether they have a menu in English.",
          vocab: [
            { term: "英文", reading: "Yīngwén", meaning: "English (language)" },
            { term: "菜单", reading: "càidān", meaning: "menu" },
          ],
          starter: "有英文…",
          full: "有英文菜单吗？",
          fullReading: "Yǒu Yīngwén càidān ma?",
          fullMeaning: "Is there an English menu?",
        }, ["英文"]),
        card("ask_recommendation", "⭐", "Ask what she recommends", {
          intent: "Greet her and ask what she'd recommend.",
          vocab: [
            { term: "什么", reading: "shénme", meaning: "what" },
            { term: "推荐", reading: "tuījiàn", meaning: "to recommend" },
          ],
          starter: "你好，有什么…",
          full: "你好，有什么推荐吗？",
          fullReading: "Nǐ hǎo, yǒu shénme tuījiàn ma?",
          fullMeaning: "Hi, what do you recommend?",
        }, ["推荐"], { key: "hi_recommend" }),
      ],
      resolve: (ctx) => {
        const { report, slot } = ctx;
        const extras = details(slot);
        const toOrder = (directive: string, meaning: string, extra: Partial<Outcome> = {}) => advance("order", directive, meaning, extra);
        if (slot("drink") === "other") return fruitSoldOut("greeting");
        if (choosesRecommendation(report))
          return orderDrink(ctx, extras, "Return the greeting, then say you'll make them the signature milk tea (那就给您来一杯招牌奶茶).");
        if (report.intent === "order_drink" || ((report.intent === "choose_topping" || report.intent === "customize") && (extras.topping || slot("drink"))))
          return orderDrink(ctx, extras, `Return the greeting and acknowledge the order briefly (您好！好的，${extras.topping ? drinkZh(extras.topping) : "一杯奶茶"}).`);
        if (report.intent === "greet") return toOrder("Return the greeting warmly (您好！) and ask what they'd like to drink (想喝点什么？).", "Hello! What would you like to drink?");
        if (report.intent === "ask_order_here")
          return toOrder("Say yes, they can order right here with you (可以的，这边点单), then ask what they'd like to drink.", "Yes, you can order right here. What would you like?");
        if (report.intent === "ask_menu")
          return toOrder(
            "Point at the menu board above you (菜单在上面) and mention they can also scan the code on the counter to see it (也可以扫码看). Then ask what they'd like.",
            "The menu's up there, or you can scan the code. What would you like?",
          );
        if (report.intent === "ask_english_menu")
          return toOrder(
            "Apologize: there's no English menu, but every drink has a photo (不好意思，没有英文的，不过都有图片). Then ask what they'd like.",
            "Sorry, there's no English menu, but every drink has a photo. What would you like?",
          );
        if (report.intent === "ask_recommendation")
          return toOrder(
            "Return the greeting, then recommend the signature milk tea (招牌奶茶), your best seller, in one enthusiastic sentence, and ask if they'd like one.",
            "Hello! Our signature milk tea is the most popular. Would you like one?",
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_price")
          return toOrder("Say the signature milk tea is 15 yuan (十五块), toppings are extra, then ask what they'd like.", "The signature milk tea is 15 yuan. What would you like?");
        if (report.intent === "ask_time")
          return toOrder("Say of course, take your time (好的，您慢慢看), one short phrase only, then wait.", "Sure, take your time.", { setFlags: { askedTime: true } });
        return null;
      },
    },
    {
      id: "order",
      group: "Order",
      npcGoal: "Ask what they'd like to drink (想喝点什么？).",
      meaning: "What would you like to drink?",
      situation: "Xiaoyu is asking what you'd like to drink. The menu is on the lightbox above her.",
      cards: ({ state, difficulty }) => [
        card("order_drink", "🧋", "Order a milk tea", {
          intent: "Ask for one milk tea.",
          vocab: [
            { term: "我要", reading: "wǒ yào", meaning: "I'd like" },
            { term: "一杯", reading: "yì bēi", meaning: "one cup (of)" },
            { term: "奶茶", reading: "nǎichá", meaning: "milk tea" },
          ],
          starter: "我要…",
          full: "我要一杯奶茶。",
          fullReading: "Wǒ yào yì bēi nǎichá.",
          fullMeaning: "I'd like a milk tea.",
        }, ["奶茶"], { key: "order_milk_tea", expect: { drink: "milk_tea" }, core: true }),
        card("order_drink", "😎", "Order casually", {
          intent: "Order a milk tea the relaxed, everyday way.",
          vocab: [
            { term: "来一杯", reading: "lái yì bēi", meaning: "I'll have one (casual)" },
            { term: "吧", reading: "ba", meaning: "(softens the sentence)" },
          ],
          starter: "来一杯…",
          full: "来一杯奶茶吧。",
          fullReading: "Lái yì bēi nǎichá ba.",
          fullMeaning: "I'll have a milk tea.",
        }, ["来一杯", "奶茶"], { key: "lai_yi_bei", expect: { drink: "milk_tea" }, core: true }),
        // Beginner hears the topping question: ordering it all in one go is for the busier levels.
        ...(difficulty === "beginner"
          ? []
          : [
              card("order_drink", "⚫", "Order a tapioca milk tea in one go", {
                intent: "Order a milk tea with tapioca pearls, all in one sentence.",
                vocab: [
                  { term: "珍珠", reading: "zhēnzhū", meaning: "tapioca pearls (lit. pearls)" },
                  { term: "珍珠奶茶", reading: "zhēnzhū nǎichá", meaning: "bubble tea (pearl milk tea)" },
                ],
                starter: "我要一杯珍珠…",
                full: "我要一杯珍珠奶茶。",
                fullReading: "Wǒ yào yì bēi zhēnzhū nǎichá.",
                fullMeaning: "I'd like a tapioca milk tea.",
              }, ["珍珠"], { key: "order_tapioca", expect: { drink: "milk_tea", topping: "tapioca" }, core: true }),
            ]),
        card("order_drink", "☕", "Ask for it hot", {
          intent: "Order a hot milk tea (it's 33 °C out, but it's your call!).",
          vocab: [
            { term: "热", reading: "rè", meaning: "hot" },
            { term: "谢谢", reading: "xièxie", meaning: "thanks" },
          ],
          starter: "一杯热…",
          full: "一杯热奶茶，谢谢。",
          fullReading: "Yì bēi rè nǎichá, xièxie.",
          fullMeaning: "A hot milk tea, thanks.",
        }, ["热奶茶", "热的"], { key: "order_hot", expect: { drink: "milk_tea", ice: "hot" }, core: true }),
        card("no_preference", "🎲", "Let her choose for you", {
          intent: "Let Xiaoyu pick for you.",
          vocab: [
            { term: "帮我", reading: "bāng wǒ", meaning: "for me (lit. help me)" },
            { term: "选", reading: "xuǎn", meaning: "to choose" },
          ],
          starter: "你帮我…",
          full: "你帮我选一个吧。",
          fullReading: "Nǐ bāng wǒ xuǎn yí ge ba.",
          fullMeaning: "You pick one for me.",
        }, ["帮我选", "你选"], { key: "pick_for_me", core: true }),
        state.flags.recommended || state.flags.fruitSoldOut
          ? card("order_drink", "🌟", "Have the signature milk tea", {
              intent: "Go for the signature milk tea she suggested.",
              vocab: [
                { term: "那就", reading: "nà jiù", meaning: "then, in that case" },
                { term: "招牌", reading: "zhāopái", meaning: "house signature (best seller)" },
              ],
              starter: "那就要…",
              full: "那就要招牌奶茶吧。",
              fullReading: "Nà jiù yào zhāopái nǎichá ba.",
              fullMeaning: "Then I'll have the signature milk tea.",
            }, ["招牌"], { key: "order_signature", expect: { drink: "milk_tea" }, core: true })
          : card("ask_recommendation", "⭐", "Ask what she recommends", {
              intent: "Ask what she'd recommend.",
              vocab: [{ term: "推荐", reading: "tuījiàn", meaning: "to recommend" }],
              starter: "有什么…",
              full: "有什么推荐的吗？",
              fullReading: "Yǒu shénme tuījiàn de ma?",
              fullMeaning: "Anything you'd recommend?",
            }, ["推荐"]),
        card("ask_price", "💴", "Ask how much a milk tea is", {
          intent: "Ask what a milk tea costs.",
          vocab: [{ term: "多少钱", reading: "duōshao qián", meaning: "how much (money)?" }],
          starter: "奶茶多少…",
          full: "奶茶多少钱？",
          fullReading: "Nǎichá duōshao qián?",
          fullMeaning: "How much is a milk tea?",
        }, ["多少钱"]),
        card("ask_time", "⏳", "Ask for a moment", {
          intent: "Tell her you need a moment to look.",
          vocab: [
            { term: "再", reading: "zài", meaning: "a bit more, again" },
            { term: "看看", reading: "kànkan", meaning: "to have a look" },
          ],
          starter: "我再…",
          full: "我再看看。",
          fullReading: "Wǒ zài kànkan.",
          fullMeaning: "Let me have another look.",
        }, ["看看"]),
      ],
      resolve: (ctx) => {
        const { report, slot, state } = ctx;
        const extras = details(slot);
        if (slot("drink") === "other" && ["order_drink", "choose_topping", "yes", "customize"].includes(report.intent)) return fruitSoldOut("order");
        // « 你帮我选吧 », or « 好 » to her suggestion: the signature milk tea.
        if (choosesRecommendation(report) || (report.intent === "yes" && (state.flags.recommended || state.flags.fruitSoldOut)))
          return orderDrink(ctx, extras, "Say you'll make them the signature milk tea (那就给您来一杯招牌奶茶).");
        if (report.intent === "order_drink" || ((report.intent === "choose_topping" || report.intent === "customize") && (extras.topping || slot("drink") === "milk_tea")))
          return orderDrink(ctx, extras);
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "order",
            "Recommend the signature milk tea (招牌奶茶) in one enthusiastic sentence: it's your best seller. Then ask if they'd like one.",
            "Our signature milk tea is the best seller! Would you like one?",
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_price")
          return stay("info", "order", "Say the signature milk tea is 15 yuan (十五块), and toppings are extra (小料另外加). Then ask what they'd like.", "It's 15 yuan, toppings extra. What would you like?");
        if (report.intent === "ask_time")
          return stay("info", "order", "Say of course, take your time (好的，您慢慢看), one short phrase only, then wait silently.", "Sure, take your time.", { setFlags: { askedTime: true } });
        if (report.intent === "ask_menu" || report.intent === "ask_english_menu")
          return stay(
            "info",
            "order",
            "Point at the menu board above you (菜单在上面): there's no English version, but every drink has a photo. Then ask what they'd like.",
            "The menu's up there: no English, but there are photos. What would you like?",
          );
        if (report.intent === "ask_order_here") return stay("info", "order", "Say yes, right here with you (对，这边点单), then ask what they'd like.", "Yes, right here. What would you like?");
        return null;
      },
    },
    {
      id: "topping",
      group: "Your drink",
      npcGoal: "Ask which topping they'd like: 珍珠 (tapioca pearls), 荔枝冻 (lychee jelly) or 仙草冻 (grass jelly), one per cup.",
      meaning: "Which topping would you like? Tapioca pearls, lychee jelly or grass jelly?",
      situation: "Xiaoyu is asking which topping (小料) you'd like in your milk tea. The sample cups on the counter show them.",
      cards: ({ state, variant }) => {
        const special = String(variant.special);
        const gone = state.flags.soldOutHit ? String(variant.soldOut) : "";
        return [
          ...CHOICES.filter((t) => t !== gone).map((t) => TOPPING_CARDS[t]),
          card("choose_topping", "🚫", "No topping, thanks", {
            intent: "Say you don't want a topping.",
            vocab: [
              { term: "不加", reading: "bù jiā", meaning: "not add (none)" },
              { term: "了", reading: "le", meaning: "(it's settled)" },
            ],
            starter: "不加…",
            full: "不加了，谢谢。",
            fullReading: "Bù jiā le, xièxie.",
            fullMeaning: "No topping, thanks.",
          }, ["不加", "不用加"], { key: "plain", expect: { topping: "plain" }, core: true }),
          card("no_preference", "🤲", "Leave it to her", {
            intent: "Say any is fine and let her choose.",
            vocab: [
              { term: "都可以", reading: "dōu kěyǐ", meaning: "any is fine" },
              { term: "帮我选", reading: "bāng wǒ xuǎn", meaning: "choose for me" },
            ],
            starter: "都可以，…",
            full: "都可以，你帮我选吧。",
            fullReading: "Dōu kěyǐ, nǐ bāng wǒ xuǎn ba.",
            fullMeaning: "Any is fine, you choose.",
          }, ["都可以", "帮我选"], { key: "leave_it", core: true }),
          state.flags.toppingRecommended
            ? takeSuggestion(special)
            : card("ask_recommendation", "🤔", "Ask which one is best", {
                intent: "Ask which topping she thinks is best.",
                vocab: [
                  { term: "哪个", reading: "nǎge", meaning: "which one" },
                  { term: "比较", reading: "bǐjiào", meaning: "rather, more" },
                  { term: "好吃", reading: "hǎochī", meaning: "tasty (for food)" },
                ],
                starter: "哪个…",
                full: "哪个比较好吃？",
                fullReading: "Nǎge bǐjiào hǎochī?",
                fullMeaning: "Which one is better?",
              }, ["哪个", "比较"], { key: "which_best" }),
          card("ask_about_topping", "❓", "Ask what grass jelly is", {
            intent: "You've never tried grass jelly. Ask what it is.",
            vocab: [
              { term: "仙草冻", reading: "xiāncǎo dòng", meaning: "grass jelly" },
              { term: "是什么", reading: "shì shénme", meaning: "what is…?" },
            ],
            starter: "仙草冻是…",
            full: "仙草冻是什么？",
            fullReading: "Xiāncǎo dòng shì shénme?",
            fullMeaning: "What's grass jelly?",
          }, ["是什么"], { key: "what_grass" }),
          card("ask_two_toppings", "✌️", "Ask for two toppings", {
            intent: "Ask whether you can have two toppings in one cup.",
            vocab: [
              { term: "两种", reading: "liǎng zhǒng", meaning: "two kinds (两 for \"two of something\")" },
              { term: "可以…吗", reading: "kěyǐ…ma", meaning: "can I…?" },
            ],
            starter: "可以加两…",
            full: "可以加两种吗？",
            fullReading: "Kěyǐ jiā liǎng zhǒng ma?",
            fullMeaning: "Can I add two kinds?",
          }, ["两种"]),
        ];
      },
      resolve: (ctx) => {
        const { report, slot, state, variant } = ctx;
        const topping = slot("topping");
        const special = String(variant.special);
        // « 你帮我选吧 », or « 好 » after she recommended one: her pick.
        if (choosesRecommendation(report) || (report.intent === "yes" && state.flags.toppingRecommended && !topping))
          return chooseTopping(ctx, special, `Say you'll give them ${TOPPINGS[special as Topping].zh} (那就给您加${TOPPINGS[special as Topping].zh}).`);
        if (topping && ["choose_topping", "order_drink", "yes", "customize", "change_order", "correct_order"].includes(report.intent))
          return chooseTopping(ctx, topping);
        // « 不要了 » / « 不用了 » to "which topping?": none.
        if (report.intent === "no" || report.intent === "decline") return chooseTopping(ctx, "plain");
        if (report.intent === "choose_topping")
          return {
            ...stay("info", "topping", "They want a topping but didn't say which one. Ask which: 珍珠, 荔枝冻 or 仙草冻.", "Which one would you like?"),
            success: false,
            reaction: "confused",
            note: "Name the topping you want.",
          };
        if (report.intent === "customize") {
          const early = details(slot, ["sugar", "ice"]);
          if (Object.keys(early).length)
            return stay("info", "topping", `${iceAck(early)} Then ask which topping they'd like (那小料呢？).`, "Got it. And which topping?", { setSlots: early });
        }
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "topping",
            special === "grass_jelly"
              ? "Recommend the grass jelly (仙草冻) in one enthusiastic sentence: it's so refreshing in summer (夏天喝很清爽). Then ask which they'd like."
              : "Recommend the pearls (珍珠) in one enthusiastic sentence: freshly cooked and extra chewy (现煮的，特别Q弹). Then ask which they'd like.",
            special === "grass_jelly" ? "The grass jelly, it's so refreshing in summer! Which would you like?" : "The pearls! They're freshly cooked and super chewy. Which would you like?",
            { setFlags: { toppingRecommended: true } },
          );
        if (report.intent === "ask_about_topping") {
          const about = topping || "grass_jelly";
          const what =
            about === "tapioca"
              ? "chewy, bouncy tapioca pearls, freshly cooked (Q弹)"
              : about === "lychee_jelly"
                ? "a light, sweet, fruity jelly"
                : about === "plain"
                  ? "the milk tea on its own"
                  : "a black herbal jelly, a little bitter and very refreshing";
          return stay(
            "info",
            "topping",
            `Explain it simply in Mandarin (no English): ${TOPPINGS[about as Topping]?.zh ?? "仙草冻"} is ${what}. Then ask which topping they'd like.`,
            about === "grass_jelly" ? "It's a black herbal jelly, a little bitter, very refreshing. Which would you like?" : "Here's what it's like… Which would you like?",
          );
        }
        if (report.intent === "ask_two_toppings")
          return stay("info", "topping", "Say sweetly that it's one topping per cup (一杯只能加一种哦), and ask which one they'd like.", "It's one topping per cup. Which one would you like?");
        if (report.intent === "ask_price" || report.intent === "ask_options")
          return stay(
            "info",
            "topping",
            "Say 珍珠 is 2 yuan extra, 荔枝冻 and 仙草冻 are 3 yuan extra (珍珠加两块，荔枝冻和仙草冻加三块). Then ask which they'd like.",
            "Pearls are 2 yuan extra, the jellies 3. Which would you like?",
          );
        return null;
      },
    },
    {
      id: "sugar_ice",
      group: "Your drink",
      npcGoal: "Ask how sweet (甜度) and how much ice (冰量) they'd like: only what they haven't told you yet.",
      meaning: "How sweet, and how much ice?",
      situation: "The famous boba ritual: Xiaoyu wants to know the sweetness (甜度) and the ice (冰量).",
      cards: ({ state }) => sugarIceCards(state),
      resolve: (ctx) => {
        const { report, slot, state, variant } = ctx;
        const got = details(slot, ["sugar", "ice"]);
        // « 听你的 », or « 好 » after her recommendation: 七分糖少冰 (only the half that's missing).
        if (choosesRecommendation(report) || (report.intent === "yes" && state.flags.sugarRecommended && !Object.keys(got).length)) {
          const rec: Record<string, string> = {};
          if (!state.slots.sugar) rec.sugar = "seventy";
          if (!state.slots.ice) rec.ice = "less";
          return takeSugarIce(ctx, rec, `Say "好的，${[SUGAR[rec.sugar]?.zh, ICE[rec.ice]?.zh].filter(Boolean).join("")}" (the recommendation it is).`);
        }
        if (Object.keys(got).length && ["customize", "yes", "order_drink", "change_order", "choose_topping", "correct_order", "no_preference"].includes(report.intent)) {
          const topping = slot("topping");
          if (topping && topping !== state.slots.topping) {
            if (topping === variant.soldOut) return stay("branch", "sugar_ice", soldOutDirective(topping), soldOutMeaning(topping), { setFlags: { soldOutHit: true }, setSlots: got, note: SOLD_OUT_NOTE });
            return takeSugarIce(ctx, { ...got, topping }, iceAck(got));
          }
          return takeSugarIce(ctx, got, iceAck(got));
        }
        // Changing the topping on the way: fine, then back to sweetness and ice.
        if (report.intent === "choose_topping" && slot("topping")) {
          const topping = slot("topping");
          if (topping === variant.soldOut) return stay("branch", "sugar_ice", soldOutDirective(topping), soldOutMeaning(topping), { setFlags: { soldOutHit: true }, note: SOLD_OUT_NOTE });
          return stay("info", "sugar_ice", `Say fine, ${drinkZh(topping)} then (好的，换成${TOPPINGS[topping as Topping].zh}). Then ${askSugarIce(state.slots)}`, `OK, ${drinkEn(topping)}. ${sugarIceMeaning(state.slots)}`, {
            setSlots: { topping },
          });
        }
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "sugar_ice",
            !state.slots.sugar && !state.slots.ice
              ? "Say for a first visit you recommend 70% sugar and less ice (第一次来的话，推荐七分糖少冰). Then ask what they'd like."
              : !state.slots.ice
                ? "Say you recommend less ice (推荐少冰), so it doesn't get watery. Then ask what they'd like."
                : "Say you recommend 70% sugar (推荐七分糖), it's the most popular. Then ask what they'd like.",
            !state.slots.sugar && !state.slots.ice ? "For a first visit, I'd go 70% sugar, less ice. What would you like?" : "I'd recommend that one. What would you like?",
            { setFlags: { sugarRecommended: true } },
          );
        if (report.intent === "ask_options")
          return stay(
            "info",
            "sugar_ice",
            !state.slots.sugar
              ? "List the sweetness levels briefly: 全糖, 七分糖, 半糖, 三分糖, or no added sugar (不另外加糖). Then ask which they'd like."
              : "List the ice levels briefly: 正常冰, 少冰, 去冰, 常温, or hot (热的). Then ask which they'd like.",
            !state.slots.sugar ? "Full, 70%, half, 30%, or no added sugar. Which would you like?" : "Regular, less, no ice, room temperature, or hot. Which would you like?",
          );
        if (report.intent === "customize")
          return {
            ...stay("info", "sugar_ice", `They answered, but you didn't catch the level. ${askSugarIce(state.slots).replace(/^ask/, "Ask")}`, sugarIceMeaning(state.slots)),
            success: false,
            reaction: "confused",
          };
        return null;
      },
    },
    {
      id: "to_go",
      group: "Your drink",
      npcGoal: "Ask whether it's for here or to go (在这儿喝还是带走？).",
      meaning: "For here or to go?",
      situation: "Xiaoyu is asking if you'll drink it here or take it with you.",
      cards: () => [
        card("to_go", "🥡", "Take it to go", {
          intent: "Say you'll take it with you.",
          vocab: [{ term: "带走", reading: "dàizǒu", meaning: "to go (lit. take away)" }],
          starter: "带…",
          full: "带走。",
          fullReading: "Dàizǒu.",
          fullMeaning: "To go.",
        }, ["带走"], { key: "takeaway", expect: { where: "takeaway" }, core: true }),
        card("to_go", "🛍️", "Ask her to pack it to go", {
          intent: "Ask her to pack it up to take away.",
          vocab: [
            { term: "打包", reading: "dǎbāo", meaning: "to pack up (to go)" },
            { term: "带走", reading: "dàizǒu", meaning: "to take away" },
          ],
          starter: "打包…",
          full: "打包带走，谢谢。",
          fullReading: "Dǎbāo dàizǒu, xièxie.",
          fullMeaning: "To go, please. Thanks.",
        }, ["打包"], { key: "dabao", expect: { where: "takeaway" }, core: true }),
        card("to_go", "🪑", "Say you'll drink it here", {
          intent: "Say you'll drink it in the shop.",
          vocab: [
            { term: "在这儿", reading: "zài zhèr", meaning: "here" },
            { term: "喝", reading: "hē", meaning: "to drink" },
          ],
          starter: "在这儿…",
          full: "在这儿喝。",
          fullReading: "Zài zhèr hē.",
          fullMeaning: "I'll drink it here.",
        }, ["这儿喝", "在这里喝"], { key: "here", expect: { where: "here" }, core: true }),
        card("ask_seat", "💺", "Ask if there are seats", {
          intent: "Ask whether there's anywhere to sit.",
          vocab: [{ term: "座位", reading: "zuòwèi", meaning: "seat" }],
          starter: "有座…",
          full: "有座位吗？",
          fullReading: "Yǒu zuòwèi ma?",
          fullMeaning: "Are there any seats?",
        }, ["座位"]),
        card("ask_wait_time", "⏱️", "Ask how long it takes", {
          intent: "Ask how long you'll have to wait.",
          vocab: [
            { term: "等", reading: "děng", meaning: "to wait" },
            { term: "多久", reading: "duō jiǔ", meaning: "how long" },
          ],
          starter: "要等…",
          full: "要等多久？",
          fullReading: "Yào děng duō jiǔ?",
          fullMeaning: "How long is the wait?",
        }, ["多久"]),
        card("ask_pickup", "📍", "Ask where to pick it up", {
          intent: "Ask where you collect your drink.",
          vocab: [
            { term: "在哪儿", reading: "zài nǎr", meaning: "where" },
            { term: "取", reading: "qǔ", meaning: "to collect, pick up" },
          ],
          starter: "在哪儿…",
          full: "在哪儿取？",
          fullReading: "Zài nǎr qǔ?",
          fullMeaning: "Where do I pick it up?",
        }, ["哪儿取", "哪里取"]),
      ],
      resolve: ({ report, slot, state, variant, difficulty }) => {
        const where = slot("where");
        if (where && ["to_go", "yes", "customize", "order_drink", "change_order", "no_preference"].includes(report.intent))
          return nextStep(state, variant, difficulty, { where }, `Acknowledge (${where === "takeaway" ? "好的，带走" : "好的，在这儿喝"}).`);
        if (report.intent === "to_go")
          return {
            ...stay("info", "to_go", "They answered, but you didn't catch whether it's for here or to go. Ask again (在这儿喝还是带走？).", "For here or to go?"),
            success: false,
            reaction: "confused",
          };
        if (report.intent === "ask_seat")
          return stay("info", "to_go", "Say yes, there are a few stools by the window (窗边有几个位子). Then ask: for here or to go?", "Yes, there are a few stools by the window. For here or to go?");
        if (report.intent === "ask_wait_time")
          return stay("info", "to_go", "Say about five minutes (大概五分钟). Then ask: for here or to go?", "About five minutes. For here or to go?");
        if (report.intent === "ask_pickup")
          return stay(
            "info",
            "to_go",
            "Say they pick it up at the counter on the right when their number is called on the screen (右边取餐台，看屏幕叫号). Then ask: for here or to go?",
            "At the counter on the right, when your number is on the screen. For here or to go?",
          );
        return null;
      },
    },
    {
      id: "confirm",
      group: "Your drink",
      npcGoal: "Read the order back and ask if it's right (对吗？).",
      meaning: "Let me read your order back. Is that right?",
      situation: "Xiaoyu is reading your order back. Listen carefully: is it what you ordered?",
      cards: ({ state }) => {
        const real = state.slots.topping || "tapioca";
        const heardVanilla = state.slots.heard_topping === "vanilla";
        const iceTo = state.slots.ice === "no_ice" || state.slots.ice === "hot" ? "less" : "no_ice";
        return [
          card("confirm", "✅", "Confirm the order", {
            intent: "Tell her yes, that's right, but only if it really IS what you ordered!",
            vocab: [
              { term: "对", reading: "duì", meaning: "right, correct" },
              { term: "没错", reading: "méi cuò", meaning: "that's right (lit. no mistake)" },
            ],
            starter: "对，…",
            full: "对，没错。",
            fullReading: "Duì, méi cuò.",
            fullMeaning: "Yes, that's right.",
          }, ["没错", "对的"], { core: true }),
          card("confirm", "👍", "Say yes", {
            intent: "Say yes, that's it, but only if the order she read back is right!",
            vocab: [{ term: "是的", reading: "shì de", meaning: "yes (that's it)" }],
            starter: "是…",
            full: "是的。",
            fullReading: "Shì de.",
            fullMeaning: "Yes, it is.",
          }, ["是的"], { key: "shi_de", core: true }),
          heardVanilla
            ? card("correct_order", "✏️", "Correct the topping", {
                intent: "Tell her that's not right and say which topping you actually ordered.",
                vocab: [
                  { term: "不是…是…", reading: "bú shì … shì …", meaning: "not …, but …" },
                  { term: "仙草", reading: "xiāncǎo", meaning: "grass jelly herb (ends in -n)" },
                  { term: "香草", reading: "xiāngcǎo", meaning: "vanilla (ends in -ng)" },
                ],
                starter: "不是香草，…",
                full: "不是香草，是仙草冻。",
                fullReading: "Bú shì xiāngcǎo, shì xiāncǎo dòng.",
                fullMeaning: "Not vanilla: grass jelly.",
              }, ["仙草", "不是"], { key: "correct_topping", expect: { topping: "grass_jelly" }, core: !!state.flags.misheard })
            : real === "plain"
              ? card("correct_order", "✏️", "Correct the topping", {
                  intent: "Tell her that's not right: you didn't want a topping.",
                  vocab: [
                    { term: "不对", reading: "bú duì", meaning: "that's not right" },
                    { term: "小料", reading: "xiǎoliào", meaning: "toppings" },
                  ],
                  starter: "不对，…",
                  full: "不对，我不要小料。",
                  fullReading: "Bú duì, wǒ bú yào xiǎoliào.",
                  fullMeaning: "No, I didn't want a topping.",
                }, ["不对", "不要小料"], { key: "correct_topping", expect: { topping: "plain" }, core: !!state.flags.misheard })
              : card("correct_order", "✏️", "Correct the topping", {
                  intent: "Tell her that's not right and say which topping you actually ordered.",
                  vocab: [
                    { term: "不对", reading: "bú duì", meaning: "that's not right" },
                    { term: "我要的是", reading: "wǒ yào de shì", meaning: "what I want is…" },
                    { term: TOPPINGS[real as Topping].zh, reading: TOPPINGS[real as Topping].reading, meaning: TOPPINGS[real as Topping].en },
                  ],
                  starter: "不对，我要的是…",
                  full: `不对，我要的是${TOPPINGS[real as Topping].zh}。`,
                  fullReading: `Bú duì, wǒ yào de shì ${TOPPINGS[real as Topping].reading}.`,
                  fullMeaning: `No, I wanted ${TOPPINGS[real as Topping].en}.`,
                }, ["不对", TOPPINGS[real as Topping].zh.slice(0, 2)], { key: "correct_topping", expect: { topping: real }, core: !!state.flags.misheard }),
          card("change_order", "🔄", iceTo === "less" ? "Change to less ice" : "Change to no ice", {
            intent: iceTo === "less" ? "You've changed your mind: ask for it iced, with less ice." : "You've changed your mind: ask for no ice.",
            vocab: [
              { term: "等一下", reading: "děng yíxià", meaning: "wait a moment" },
              { term: "改成", reading: "gǎi chéng", meaning: "change it to" },
            ],
            starter: "等一下，改成…",
            full: iceTo === "less" ? "等一下，改成少冰吧。" : "等一下，改成去冰吧。",
            fullReading: iceTo === "less" ? "Děng yíxià, gǎi chéng shǎo bīng ba." : "Děng yíxià, gǎi chéng qù bīng ba.",
            fullMeaning: iceTo === "less" ? "Wait, make it less ice." : "Wait, make it no ice.",
          }, ["改成"], { key: "change_ice", expect: { ice: iceTo } }),
          card("ask_price", "💴", "Ask the total", {
            intent: "Ask how much it comes to altogether.",
            vocab: [
              { term: "一共", reading: "yígòng", meaning: "altogether" },
              { term: "多少钱", reading: "duōshao qián", meaning: "how much?" },
            ],
            starter: "一共…",
            full: "一共多少钱？",
            fullReading: "Yígòng duōshao qián?",
            fullMeaning: "How much is it altogether?",
          }, ["一共", "多少钱"]),
          card("ask_wait_time", "⏱️", "Ask how long it takes", {
            intent: "Ask how long you'll have to wait.",
            vocab: [
              { term: "等", reading: "děng", meaning: "to wait" },
              { term: "多久", reading: "duō jiǔ", meaning: "how long" },
            ],
            starter: "要等…",
            full: "要等多久？",
            fullReading: "Yào děng duō jiǔ?",
            fullMeaning: "How long is the wait?",
          }, ["多久"]),
        ];
      },
      // « 对 » / « 不对 » to the read-back.
      aliases: { yes: "confirm", no: "correct_order" },
      resolve: ({ report, slot, state, variant }) => {
        const heardTopping = state.slots.heard_topping || state.slots.topping;
        if (report.intent === "confirm") {
          if (state.flags.misheard)
            return toPay(heardTopping, {}, "Say 好嘞 and ring up the order you read back.", {
              success: false,
              setFlags: { wrongOrder: true, misheard: false },
              note: mishearNote(state.slots.topping, heardTopping),
            });
          return toPay(state.slots.topping, {}, "Say 好嘞 (great).");
        }
        if (report.intent === "correct_order" || report.intent === "change_order") {
          const changes = details(slot);
          if (!Object.keys(changes).length)
            return stay("info", "confirm", "Ask politely what's not right (哪里不对？).", "Sorry, what's not right?", { note: report.intent === "correct_order" ? undefined : "Say what you'd like to change." });
          if (changes.topping && changes.topping === variant.soldOut)
            return stay("branch", "confirm", soldOutDirective(changes.topping), soldOutMeaning(changes.topping), { setFlags: { soldOutHit: true }, note: SOLD_OUT_NOTE });
          if (state.flags.misheard && changes.topping)
            return toPay(changes.topping, { ...changes, heard_topping: changes.topping }, `Apologize for mishearing (不好意思，我听错了！) and fix it: ${drinkZh(changes.topping)}.`, {
              setFlags: { corrected: true, misheard: false },
              note: "You caught the cashier's mistake and corrected it. Great listening!",
            });
          const merged = { ...state.slots, ...changes };
          if (!Object.entries(changes).some(([k, v]) => state.slots[k] !== v)) {
            const again = orderSummary(merged, state.flags.misheard ? heardTopping : undefined);
            return stay(
              "info",
              "confirm",
              `Politely say that's what you have (您点的就是${drinkZh(merged.topping)}哦), read the order back once more (${again.zh}) and ask if it's OK.`,
              `That's what I have: ${again.en}. OK?`,
            );
          }
          // They changed their mind: read it back again (a misheard topping stays wrong until they catch it).
          const updated = orderSummary(merged, state.flags.misheard ? heardTopping : undefined);
          return stay("info", "confirm", `Update the order, then read it back again (好的，${updated.zh}，对吗？).`, `OK, ${updated.en}. Is that right?`, {
            setSlots: { ...changes, ...(changes.topping ? { heard_topping: changes.topping } : {}) },
          });
        }
        if (report.intent === "ask_price") {
          const t = bobaTotal(heardTopping);
          return stay("info", "confirm", `Tell them the total for the order as you read it back, ${t}块 (${kuai(t)}块). Then ask if the order is right.`, `It's ${t} yuan. Is the order right?`);
        }
        if (report.intent === "ask_wait_time")
          return stay("info", "confirm", "Say about five minutes (大概五分钟). Then ask them to confirm the order.", "About five minutes. Is the order right?");
        return null;
      },
    },
    {
      id: "pay",
      group: "Payment",
      npcGoal: "Tell the customer the total and ask how they'd like to pay: scan the QR code or cash (扫码还是现金？).",
      meaning: "That's … yuan. QR code or cash?",
      situation: "Xiaoyu told you the total. Pay for your drink: in China most people pay by scanning a QR code.",
      cards: ({ state }) => [
        card("pay", "📱", "Scan her QR code", {
          intent: "Say you'll scan the shop's QR code (the stand on the counter).",
          vocab: [
            { term: "扫", reading: "sǎo", meaning: "to scan" },
            { term: "我扫你", reading: "wǒ sǎo nǐ", meaning: "I'll scan you (your code)" },
          ],
          starter: "我扫…",
          full: "我扫你吧。",
          fullReading: "Wǒ sǎo nǐ ba.",
          fullMeaning: "I'll scan your code.",
        }, ["我扫你"], { key: "scan_you", expect: { payment_method: "scan" }, core: true }),
        card("pay", "📲", "Show your payment code", {
          intent: "Hold up the payment code in your phone's app for her to scan.",
          vocab: [
            { term: "你扫我", reading: "nǐ sǎo wǒ", meaning: "you scan me (my code)" },
            { term: "付款码", reading: "fùkuǎnmǎ", meaning: "payment code" },
          ],
          starter: "你扫…",
          full: "你扫我吧。",
          fullReading: "Nǐ sǎo wǒ ba.",
          fullMeaning: "You scan mine.",
        }, ["你扫我", "付款码"], { key: "scan_me", expect: { payment_method: "show_code" }, core: true }),
        card("pay", "🔳", "Just say QR code", {
          intent: "Just say you'll pay by QR code.",
          vocab: [{ term: "扫码", reading: "sǎomǎ", meaning: "to scan a (QR) code" }],
          starter: "扫…",
          full: "扫码。",
          fullReading: "Sǎomǎ.",
          fullMeaning: "QR code.",
        }, ["扫码"], { key: "saoma", expect: { payment_method: "scan" }, core: true }),
        card("pay", "💵", "Pay in cash", {
          intent: "Hand her your ¥20 note and say it's cash.",
          vocab: [
            { term: "给你", reading: "gěi nǐ", meaning: "here you go (lit. give you)" },
            { term: "现金", reading: "xiànjīn", meaning: "cash" },
          ],
          starter: "给你，…",
          full: "给你，现金。",
          fullReading: "Gěi nǐ, xiànjīn.",
          fullMeaning: "Here you go, cash.",
        }, ["现金"], { key: "cash", expect: { payment_method: "cash" }, core: true }),
        state.flags.cardOk
          ? card("pay", "💳", "Pay by card", {
              intent: "Cards work: say you'll pay by card.",
              vocab: [
                { term: "那", reading: "nà", meaning: "then" },
                { term: "刷卡", reading: "shuākǎ", meaning: "to pay by card" },
              ],
              starter: "那我刷…",
              full: "那我刷卡吧。",
              fullReading: "Nà wǒ shuākǎ ba.",
              fullMeaning: "Then I'll pay by card.",
            }, ["刷卡"], { key: "card", expect: { payment_method: "card" }, core: true })
          : card("ask_card", "💳", "Ask if cards work", {
              intent: "Ask whether you can pay by card.",
              vocab: [{ term: "刷卡", reading: "shuākǎ", meaning: "to pay by card (lit. swipe a card)" }],
              starter: "可以刷…",
              full: "可以刷卡吗？",
              fullReading: "Kěyǐ shuākǎ ma?",
              fullMeaning: "Can I pay by card?",
            }, ["刷卡"]),
        card("ask_payment", "💠", "Ask if a payment app works", {
          intent: "Ask whether you can pay with Alipay.",
          vocab: [
            { term: "用", reading: "yòng", meaning: "to use" },
            { term: "支付宝", reading: "Zhīfùbǎo", meaning: "Alipay (a payment app)" },
            { term: "微信", reading: "Wēixìn", meaning: "WeChat (also pays)" },
          ],
          starter: "可以用…",
          full: "可以用支付宝吗？",
          fullReading: "Kěyǐ yòng Zhīfùbǎo ma?",
          fullMeaning: "Can I use Alipay?",
        }, ["支付宝", "微信"]),
        card("ask_price", "🔁", "Ask her to repeat the total", {
          intent: "You missed the total. Ask her to say it again.",
          vocab: [
            { term: "不好意思", reading: "bù hǎoyìsi", meaning: "sorry, excuse me" },
            { term: "多少钱", reading: "duōshao qián", meaning: "how much?" },
          ],
          starter: "不好意思，…",
          full: "不好意思，多少钱？",
          fullReading: "Bù hǎoyìsi, duōshao qián?",
          fullMeaning: "Sorry, how much?",
        }, ["多少钱"]),
        card("ask_receipt", "🧾", "Ask for a receipt", {
          intent: "Ask for a receipt.",
          vocab: [{ term: "小票", reading: "xiǎopiào", meaning: "receipt (the little slip)" }],
          starter: "可以给我…",
          full: "可以给我小票吗？",
          fullReading: "Kěyǐ gěi wǒ xiǎopiào ma?",
          fullMeaning: "Could I have a receipt?",
        }, ["小票"]),
      ],
      resolve: ({ report, slot, state, variant }) => {
        const topping = state.slots.served || state.slots.topping;
        const t = bobaTotal(topping);
        const number = String(variant.number);
        const method = slot("payment_method");
        // « 好 » after she said "scan this code" (QR code) or "cards are fine" (card): paying that way.
        if (report.intent === "pay" || (report.intent === "yes" && (method || state.flags.qrOffered || state.flags.cardOk))) {
          const how = method || (report.intent === "yes" && state.flags.cardOk && !state.flags.qrOffered ? "card" : "scan");
          if (how === "card" && !variant.cardOk)
            return stay("branch", "pay", "Apologize: no cards here, only QR code or cash (不好意思，只能扫码或者现金). Ask how they'd like to pay.", "Sorry, only QR code or cash. How would you like to pay?", {
              setFlags: { cardRefused: true },
              note: "No cards here: most shops in China take QR code payments or cash, and you found out by trying.",
            });
          const handOver = `hand them the receipt (这是您的小票) and tell them their pickup number, ${number}号 (write it as printed). Say it'll be ready in about five minutes and you'll call the number (好了叫您).`;
          const end = `Here's your receipt: you're number ${number}. I'll call you when it's ready.`;
          return advance(
            "pickup",
            how === "cash"
              ? `Take their ¥20 note (收您二十), give them ${20 - t}块 change (找您${kuai(20 - t)}块), ${handOver}`
              : how === "card"
                ? `Tap their card on the terminal, say it went through (好了), hand the card back, ${handOver}`
                : how === "show_code"
                  ? `Scan the payment code on their phone, say it went through (好了，支付成功), ${handOver}`
                  : `Point at the QR code on the stand (扫这个码就可以了). After a moment, say it went through (好了，支付成功), ${handOver}`,
            how === "cash" ? `Out of 20… here's ${20 - t} yuan change. ${end}` : how === "card" ? `All done. ${end}` : `Payment done! ${end}`,
            {
              objectiveComplete: true,
              events: ["payment_done", "order_placed", "time_skip", "served"],
              setSlots: { paid: how, served: topping, ticket: number },
            },
          );
        }
        if (report.intent === "ask_card") {
          if (!variant.cardOk)
            return stay("branch", "pay", "Apologize: no cards, only QR code or cash (不好意思，只能扫码或者现金).", "Sorry, only QR code or cash.", {
              setFlags: { cardRefused: true },
              note: "No cards here: most shops in China take QR code payments or cash, and you found out by asking.",
            });
          return stay("info", "pay", "Say yes, cards are fine (可以刷卡).", "Yes, cards are fine.", { setFlags: { cardOk: true } });
        }
        if (report.intent === "ask_payment")
          return stay("info", "pay", `Say yes, 支付宝 and 微信 both work: they can just scan this code (扫这个码就行). It's ${t}块.`, `Yes, Alipay and WeChat both work: just scan this code. It's ${t} yuan.`, {
            setFlags: { qrOffered: true },
          });
        if (report.intent === "ask_price") return stay("info", "pay", `Repeat the total clearly: ${t}块 (一共${kuai(t)}块).`, `It's ${t} yuan.`);
        if (report.intent === "ask_receipt")
          return stay("info", "pay", `Say of course, the receipt prints once they've paid (付完就给您小票). It's ${t}块.`, `Of course, it prints once you've paid. It's ${t} yuan.`, { setFlags: { receipt: true } });
        return null;
      },
    },
    {
      id: "pickup",
      group: "Pickup",
      learnerOpens: "Your number is on the screen and a sealed cup is waiting on the counter. Pick it up: you speak first.",
      npcGoal: "Stand at the pickup counter with their sealed drink and respond to what the customer says.",
      meaning: "",
      situation: "Your drink is ready. Collect it, then thank Xiaoyu and say goodbye.",
      cards: ({ variant }) => {
        const number = String(variant.number);
        return [
          card("goodbye", "👋", "Thank her and say goodbye", {
            intent: "Thank Xiaoyu and say goodbye.",
            vocab: [
              { term: "谢谢", reading: "xièxie", meaning: "thank you" },
              { term: "再见", reading: "zàijiàn", meaning: "goodbye" },
            ],
            starter: "谢谢！…",
            full: "谢谢！再见！",
            fullReading: "Xièxie! Zàijiàn!",
            fullMeaning: "Thanks! Goodbye!",
          }, ["再见", "谢谢"], { key: "bye", core: true }),
          card("goodbye", "🙌", "Thanks, bye-bye!", {
            intent: "Say thanks and a casual bye-bye.",
            vocab: [{ term: "拜拜", reading: "bāibāi", meaning: "bye-bye (casual)" }],
            starter: "谢谢，…",
            full: "谢谢，拜拜！",
            fullReading: "Xièxie, bāibāi!",
            fullMeaning: "Thanks, bye-bye!",
          }, ["拜拜"], { key: "baibai", core: true }),
          card("come_again", "🌟", "Say you'll come again", {
            intent: "Tell her you'll be back.",
            vocab: [
              { term: "下次", reading: "xiàcì", meaning: "next time" },
              { term: "再来", reading: "zài lái", meaning: "to come again" },
            ],
            starter: "我下次…",
            full: "我下次再来！",
            fullReading: "Wǒ xiàcì zài lái!",
            fullMeaning: "I'll come again next time!",
          }, ["下次", "再来"], { core: true }),
          card("claim_order", "🔢", "Say your number", {
            intent: `Tell her your pickup number, ${number}. Read it digit by digit: 1 is yāo (幺).`,
            vocab: [
              { term: numberZh(number), reading: numberReading(number), meaning: `${number}, read digit by digit` },
              { term: "号", reading: "hào", meaning: "number" },
            ],
            starter: "我是…",
            full: `我是${number}号。`,
            fullReading: `Wǒ shì ${numberReading(number)} hào.`,
            fullMeaning: `I'm number ${number}.`,
          }, [number.slice(1), numberZh(number).slice(1), numberZh(number).slice(1).replace(/幺/g, "一")], { key: "claim_number" }),
          card("claim_order", "🥤", "Ask if this one is yours", {
            intent: "Point at the sealed cup and ask if it's yours.",
            vocab: [
              { term: "这杯", reading: "zhè bēi", meaning: "this cup" },
              { term: "我的", reading: "wǒ de", meaning: "mine" },
            ],
            starter: "这杯…",
            full: "这杯是我的吗？",
            fullReading: "Zhè bēi shì wǒ de ma?",
            fullMeaning: "Is this one mine?",
          }, ["这杯"], { key: "claim_mine" }),
          card("ask_straw", "🧃", "Ask for a straw", {
            intent: "Ask for one of the fat boba straws.",
            vocab: [
              { term: "一根", reading: "yì gēn", meaning: "one (long, thin thing)" },
              { term: "吸管", reading: "xīguǎn", meaning: "straw" },
            ],
            starter: "可以给我一根…",
            full: "可以给我一根吸管吗？",
            fullReading: "Kěyǐ gěi wǒ yì gēn xīguǎn ma?",
            fullMeaning: "Could I have a straw?",
          }, ["吸管"]),
          card("compliment", "😋", "Say it looks delicious", {
            intent: "Tell her the drink looks delicious.",
            vocab: [
              { term: "看起来", reading: "kàn qǐlái", meaning: "it looks…" },
              { term: "好喝", reading: "hǎohē", meaning: "tasty (for drinks)" },
            ],
            starter: "看起来…",
            full: "看起来很好喝！",
            fullReading: "Kàn qǐlái hěn hǎohē!",
            fullMeaning: "It looks delicious!",
          }, ["好喝", "看起来"]),
          card("ask_toilet", "🚻", "Ask where the restroom is", {
            intent: "Before you go, ask where the restroom is.",
            vocab: [
              { term: "请问", reading: "qǐngwèn", meaning: "excuse me, may I ask" },
              { term: "洗手间", reading: "xǐshǒujiān", meaning: "restroom" },
            ],
            starter: "请问洗手间…",
            full: "请问洗手间在哪儿？",
            fullReading: "Qǐngwèn xǐshǒujiān zài nǎr?",
            fullMeaning: "Excuse me, where's the restroom?",
          }, ["洗手间", "厕所"]),
        ];
      },
      resolve: ({ report, state, variant }) => {
        const number = state.slots.ticket || String(variant.number);
        const served = state.slots.served || state.slots.topping;
        if (report.intent === "thanks" || report.intent === "goodbye")
          return complete("pickup", "Say a warm final goodbye in one short sentence (不客气，慢走！欢迎下次光临！).", "You're welcome, take care! Come again!");
        if (report.intent === "come_again")
          return complete("pickup", "Say you'd love that, then a warm final goodbye in one short sentence (好呀，欢迎下次光临！慢走！).", "Great, see you next time! Take care!");
        // Handing the cup over: the straw goes in (once).
        const straw = state.flags.strawIn ? {} : { events: ["item_shown" as const], setFlags: { strawIn: true } };
        if (report.intent === "claim_order")
          return stay(
            "info",
            "pickup",
            `Smile and confirm it's theirs: number ${number}, their ${drinkZh(served)} (对，${number}号，您的${drinkZh(served)}，请拿好！). Hand it over with a straw.`,
            `Yes, number ${number}, your ${drinkEn(served)}. Here you go!`,
            straw,
          );
        if (report.intent === "ask_straw") return stay("info", "pickup", "Hand them a fat boba straw (给您吸管).", "Here's a straw for you.", straw);
        if (report.intent === "compliment") return stay("info", "pickup", "Thank them happily (谢谢！希望您喜欢).", "Thank you! I hope you like it!");
        if (report.intent === "ask_toilet")
          return stay("info", "pickup", "Say it's in the mall: out the door and to the left (商场里，出门左转).", "It's in the mall, out the door and to the left.");
        return null;
      },
    },
  ],
};
