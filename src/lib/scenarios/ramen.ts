import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { containsTerm } from "@/lib/evaluation/text";
import { card } from "./helpers";
import type { Outcome, ScenarioDef, ScenarioState, TurnReport, Variant } from "./types";

const DISHES = {
  shoyu: { ja: "醤油ラーメン", reading: "shōyu rāmen", en: "shoyu (soy-sauce) ramen", price: 900 },
  miso: { ja: "味噌ラーメン", reading: "miso rāmen", en: "miso ramen", price: 950 },
  shio: { ja: "塩ラーメン", reading: "shio rāmen", en: "shio (salt) ramen", price: 900 },
  tonkotsu: { ja: "豚骨ラーメン", reading: "tonkotsu rāmen", en: "tonkotsu (pork-bone) ramen", price: 1000 },
  tsukemen: { ja: "つけ麺", reading: "tsukemen", en: "tsukemen (dipping noodles)", price: 1000 },
} as const;
type Dish = keyof typeof DISHES;

const FIRMNESS: Record<string, { ja: string; en: string }> = {
  soft: { ja: "やわらかめ", en: "soft" },
  normal: { ja: "普通", en: "regular" },
  firm: { ja: "かため", en: "firm" },
};
const DRINKS: Record<string, { ja: string; en: string; price: number }> = {
  oolong: { ja: "ウーロン茶", en: "oolong tea", price: 250 },
  beer: { ja: "生ビール", en: "draft beer", price: 600 },
  water: { ja: "お水", en: "water", price: 0 },
};
const SIDES: Record<string, { ja: string; en: string; price: number }> = {
  gyoza: { ja: "餃子セット", en: "gyoza set", price: 300 },
  rice: { ja: "ライス", en: "rice", price: 150 },
  egg: { ja: "味玉", en: "seasoned egg", price: 150 },
};
/** A large portion (大盛り) costs this much more. */
const LARGE = 100;

/**
 * « おすすめでお願いします » / « お任せします » / « …にします » make a choice, even when the agent files them
 * under asking for a recommendation: the words decide.
 */
const CHOOSING = ["でお願い", "お任せ", "おまかせ", "にします"];
const choosesRecommendation = (report: TurnReport) => {
  if (report.intent === "no_preference") return true;
  // A question (« …何にしますか？ ») still only asks.
  const question = /[?？]|か[。\s]*$/.test(report.heard.trim());
  return report.intent === "ask_recommendation" && !question && CHOOSING.some((k) => containsTerm(report.heard, k, "ja"));
};

const dishJa = (d: string) => DISHES[d as Dish]?.ja ?? d;
const dishEn = (d: string) => DISHES[d as Dish]?.en ?? d;
const dishShort = (d: string) => dishEn(d).split(" (")[0];

function total(slots: Record<string, string>) {
  const dish = (slots.served || slots.dish) as Dish;
  return (
    (DISHES[dish]?.price ?? 900) +
    (slots.portion === "large" ? LARGE : 0) +
    (slots.side ? SIDES[slots.side]?.price ?? 0 : 0) +
    (slots.drink ? DRINKS[slots.drink]?.price ?? 0 : 0)
  );
}

function orderSummary(slots: Record<string, string>, dishOverride?: string) {
  const dish = dishOverride || slots.dish;
  const large = slots.portion === "large";
  const parts = [`${dishJa(dish)} (${FIRMNESS[slots.firmness]?.ja ?? "普通"}${large ? "・大盛り" : ""})`];
  if (slots.side) parts.push(SIDES[slots.side]?.ja ?? slots.side);
  if (slots.drink) parts.push(DRINKS[slots.drink]?.ja ?? slots.drink);
  const en = [`${large ? "large " : ""}${dishEn(dish)} (${FIRMNESS[slots.firmness]?.en ?? "regular"} noodles)`];
  if (slots.side) en.push(SIDES[slots.side]?.en ?? slots.side);
  if (slots.drink) en.push(DRINKS[slots.drink]?.en ?? slots.drink);
  return { ja: parts.join("、"), en: en.join(", ") };
}

function mishearDish(ordered: string, variant: Variant): Dish {
  const options = (["miso", "shio", "shoyu", "tonkotsu"] as Dish[]).filter(
    (d) => d !== ordered && d !== variant.soldOut,
  );
  return options[0];
}

/** Directive for entering the confirm stage (may deliberately mishear). */
function toConfirm(state: ScenarioState, variant: Variant, slots: Record<string, string>): Outcome {
  const merged = { ...state.slots, ...slots };
  const wrong = variant.mishear && !state.flags.misheardOnce ? mishearDish(merged.dish, variant) : null;
  const heard = orderSummary(merged, wrong ?? undefined);
  const ack = slots.side
    ? `Acknowledge (${SIDES[slots.side]?.ja}).`
    : slots.drink
      ? `Acknowledge (${DRINKS[slots.drink]?.ja}).`
      : slots.firmness
        ? `Acknowledge (${FIRMNESS[slots.firmness]?.ja}).`
        : "Acknowledge briefly.";
  return advance(
    "confirm",
    wrong
      ? `${ack} Then read the order back to confirm, but you MISHEARD the dish: say "${heard.ja}" (NOT what they ordered). Ask "is that right?" naturally. Do not hint that it might be wrong.`
      : `${ack} Then read the whole order back, ${heard.ja}, and ask if that's correct.`,
    `So that's ${heard.en}, is that right?`,
    {
      setSlots: { ...slots, heard_dish: wrong ?? merged.dish },
      setFlags: { misheard: !!wrong, misheardOnce: state.flags.misheardOnce || !!wrong },
    },
  );
}

/** Ordering a dish (or the recommendation), from the order stage. */
function orderDish(state: ScenarioState, variant: Variant, dish: string, extras: Record<string, string>): Outcome {
  if (dish === variant.soldOut)
    return stay(
      "branch",
      "order",
      `Apologize: ${dishJa(dish)} is sold out today (本日売り切れです). Suggest ${dishJa(String(variant.special))}, today's recommendation, or another ramen, and ask what they'd like instead.`,
      `Sorry, the ${dishEn(dish)} is sold out today. How about the ${dishEn(String(variant.special))}?`,
      {
        setFlags: { soldOutHit: true },
        setSlots: extras,
        note: "That dish was sold out (the 売切 tag on the menu), and you handled an unavailable item.",
      },
    );
  const large = extras.portion === "large";
  return advance(
    "preference",
    `Acknowledge the order of ${dishJa(dish)}${large ? ", large portion (大盛り, 100 yen extra)" : ""} briefly (e.g. "${dishJa(dish)}${large ? "の大盛り" : ""}ですね"), then ask how firm they'd like the noodles: regular (普通), firm (かため), or soft (やわらかめ).`,
    `One ${large ? "large " : ""}${dishEn(dish)}, got it. How would you like your noodles: regular, firm, or soft?`,
    { setSlots: { dish, ...extras } },
  );
}

/** From noodle firmness to the next step: the gyoza offer, or the read-back (Beginner, or a side already ordered). */
function afterFirmness(state: ScenarioState, variant: Variant, difficulty: string, slots: Record<string, string>, ack?: string): Outcome {
  if (difficulty === "beginner" || state.slots.side) return toConfirm(state, variant, slots);
  return advance(
    "extras",
    `${ack ?? `Acknowledge (${FIRMNESS[slots.firmness].ja}${slots.portion === "large" ? "・大盛り" : ""}).`} Then, as a follow-up, offer to make it a set with gyoza for +300 yen and ask if they'd like that.`,
    "Got it. Would you like to make it a set with gyoza? It's 300 yen more.",
    { setSlots: slots },
  );
}

const orderDishCard = (dish: Dish, label?: string, key?: string) =>
  card(
    "order_dish",
    "🍜",
    label ?? `Order the ${dishShort(dish)} ramen`.replace("ramen ramen", "ramen"),
    {
      intent: `Ask for one bowl of ${dishEn(dish)}, politely.`,
      vocab: [
        { term: DISHES[dish].ja, reading: DISHES[dish].reading, meaning: dishEn(dish) },
        { term: "一つ", reading: "hitotsu", meaning: "one (item)" },
        { term: "お願いします", reading: "onegaishimasu", meaning: "please (polite request)" },
      ],
      starter: `${DISHES[dish].ja}を…`,
      full: `${DISHES[dish].ja}を一つお願いします。`,
      fullReading: `${cap(DISHES[dish].reading)} o hitotsu onegaishimasu.`,
      fullMeaning: `One ${dishEn(dish)}, please.`,
    },
    [DISHES[dish].ja, DISHES[dish].ja.replace("ラーメン", ""), "一つ", "ひとつ", "お願いします", "ください"],
    { key: key ?? `order_${dish}`, expect: { dish }, core: true },
  );

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ramen: ScenarioDef = {
  id: "ramen",
  language: "ja",
  languageName: "日本語",
  languageEnglish: "Japanese",
  flag: "🇯🇵",
  city: "Tokyo",
  locationLabel: "TOKYO · SHINJUKU",
  title: "Tokyo Ramen Shop",
  venueName: "麺屋ほし · Menya Hoshi",
  objective: "Order a meal, answer the follow-up questions, and pay.",
  goal: "Order a meal and pay",
  demoRole: "generalization",
  blurb: "A tiny ten-seat ramen counter near Shinjuku Station. It's a busy evening and Hiroshi is working the floor.",
  npc: {
    name: "Hiroshi",
    role: "Waiter",
    voiceKey: "hiroshi",
    look: {
      skin: "#f1c7a0",
      skinShade: "#d9a57c",
      hair: "#1f1a17",
      hairStyle: "short",
      outfit: "#27365a",
      outfitShade: "#1c2743",
      apron: "#3b2a22",
      accent: "#f4efe6",
      accessory: "headband",
      eyes: "#2a211c",
    },
  },
  backgroundVoices: { chef: { voiceKey: "kenji", name: "Kenji (chef)" } },
  art: "ramen",
  ambienceAsset: "ramen-ambience",
  sfx: { enter: "ramen-door", served: "ramen-bowl", time_skip: "ramen-slurp", payment_done: "register" },
  briefing: {
    title: "Your notes",
    lines: [
      "¥2,000 cash in your wallet · a credit card",
      "You're alone, and very hungry",
      "Look for 売切 (sold out) tags on the menu",
    ],
  },
  initialStage: "greeting",
  randomizeCards: true,
  requiredSlots: ["dish", "firmness", "paid"],
  intents: {
    party_size: "Says how many people are in their party (e.g. 一人です)",
    ask_seat: "Asks to sit somewhere / asks if a seat is free",
    ask_ticket: "Asks whether they need to buy a meal ticket (食券) first",
    ask_open: "Asks if the shop is still open",
    order_dish: "Orders a ramen dish (fill `dish`, and `portion` if they ask for a large one)",
    ask_recommendation: "Asks a QUESTION about what you recommend, without choosing yet (おすすめは何ですか？, どれがいいですか？)",
    no_preference: "Chooses your recommendation / leaves the choice to you, without naming it: this is an order, not a question (おすすめでお願いします, お任せします, 何でもいいです)",
    ask_time: "Asks for more time to decide / asks you to wait",
    ask_english_menu: "Asks if there's an English menu",
    ask_about_dish: "Asks a question about a dish or side (is it spicy, what's in it, how many pieces)",
    ask_price: "Asks how much something costs",
    order_side: "Orders or accepts a side dish (fill `side`)",
    order_drink: "Orders a drink (fill `drink`)",
    set_firmness: "States noodle firmness preference (fill `firmness`, and `portion` if they ask for a large one)",
    ask_options: "Asks what the options/choices are",
    decline: "Politely declines an offer (no thank you)",
    confirm: "Confirms that what you read back is correct (yes, that's right)",
    correct_order: "Says your read-back is wrong and corrects it (fill `dish` with what they actually want)",
    ask_wait_time: "Asks how long the food will take",
    ask_bill: "Asks for the check / says they want to pay / asks how much it comes to",
    compliment: "Compliments the food / says ごちそうさまでした",
    ask_toilet: "Asks where the restroom is",
    ask_card: "Asks whether card payment is accepted",
    pay: "Pays / says how they will pay (fill `payment_method`)",
    ask_receipt: "Asks for a receipt",
    come_again: "Says they will come again",
    ask_directions: "Asks the way to the station / how to get somewhere nearby",
  },
  slots: {
    dish: { description: "Ramen dish the customer names", values: Object.keys(DISHES) },
    portion: { description: "Portion size, if they ask for a large one (大盛り)", values: ["regular", "large"] },
    firmness: { description: "Noodle firmness requested", values: ["soft", "normal", "firm"] },
    side: { description: "Side dish ordered/accepted", values: ["gyoza", "rice", "egg"] },
    drink: { description: "Drink ordered", values: ["oolong", "beer", "water"] },
    payment_method: { description: "How they pay (ic = an IC transit card like Suica, or phone pay)", values: ["cash", "card", "ic"] },
  },
  greetings: {
    beginner: [
      { text: "いらっしゃいませ！何名様ですか？", meaning: "Welcome! How many people?" },
      { text: "こんばんは、いらっしゃいませ！何名様ですか？", meaning: "Good evening, welcome! How many people?" },
      { text: "いらっしゃいませ！お一人様ですか？", meaning: "Welcome! Just one person?" },
    ],
    intermediate: [
      { text: "いらっしゃいませー！何名様でしょうか？", meaning: "Welcome! How many in your party?" },
      { text: "へい、いらっしゃい！何名様ですか？", meaning: "Hey, welcome in! How many?" },
      { text: "いらっしゃいませ！今カウンター空いてますよ。何名様ですか？", meaning: "Welcome! The counter's free right now. How many?" },
    ],
    immersion: [
      { text: "らっしゃいませー！何名様っすか？", meaning: "Welcome! How many?" },
      { text: "へいらっしゃい！お一人？", meaning: "Hey, welcome! Just you?" },
      { text: "いらっしゃいませー！何名様ー？カウンターどうぞー！", meaning: "Welcome! How many? Counter's this way!" },
    ],
  },
  makeVariant: (difficulty, rand) => {
    const shoyuSoldOut = difficulty !== "beginner" && rand() < (difficulty === "immersion" ? 0.4 : 0.3);
    const soldOut: Dish = shoyuSoldOut ? "shoyu" : pick<Dish>(["tsukemen", "tonkotsu"], rand);
    const special = pick<Dish>((["miso", "tonkotsu", "shio"] as Dish[]).filter((d) => d !== soldOut), rand);
    return {
      soldOut,
      special,
      cashOnly: rand() < (difficulty === "beginner" ? 0.3 : 0.55),
      mishear: difficulty !== "beginner" && rand() < 0.45,
    };
  },
  persona:
    "You are Hiroshi (ひろし), 45, the friendly, energetic waiter at 麺屋ほし (Menya Hoshi), a tiny ten-seat ramen counter near Shinjuku Station in Tokyo. It is a busy evening; the chef, Kenji, works the kitchen behind you. You are warm, a little playful, and efficient, exactly like a real Tokyo ramen shop worker. The customer has just walked in alone.",
  facts: (v) =>
    [
      "MENU (prices in yen): " +
        Object.entries(DISHES)
          .map(([k, d]) => `${d.ja} ${d.price}円${k === v.soldOut ? ", SOLD OUT today (本日売り切れ)" : ""}`)
          .join(" / "),
      `Large portion (大盛り) +${LARGE}円. Sides: 餃子セット +300円 (5 gyoza), ライス 150円, 味玉 (seasoned egg) 150円. Drinks: 生ビール 600円, ウーロン茶 250円, water is free (self-service jug on the counter).`,
      `Today's recommendation: ${dishJa(String(v.special))}.`,
      "Noodle firmness options: やわらかめ (soft), 普通 (regular), かため (firm). かため is the most popular with regulars.",
      "No meal-ticket machine (食券) here: customers order directly with you. The menu is in Japanese only, with photos. None of the ramen is spicy; chili oil (ラー油) is on the counter. All broths use pork or chicken. A bowl takes about five minutes.",
      "Open until 23:00. Restroom: at the back, on the right. Shinjuku Station: straight down the street to the right, five minutes on foot.",
      v.cashOnly
        ? "PAYMENT: CASH ONLY (現金のみ). Cards, IC cards (Suica) and phone payments are NOT accepted."
        : "Payment: cash, credit cards and IC cards (Suica) are all accepted.",
    ].join("\n"),
  asrKeywords: [
    "醤油ラーメン", "味噌ラーメン", "塩ラーメン", "豚骨ラーメン", "つけ麺", "餃子", "かため", "普通", "やわらかめ",
    "大盛り", "味玉", "ライス", "食券", "お会計", "ウーロン茶", "生ビール", "現金", "カード", "Suica", "一人",
    "おすすめ", "お任せ", "お手洗い", "ごちそうさまでした",
  ],
  vocabulary: [
    { term: "いらっしゃいませ", reading: "irasshaimase", meaning: "Welcome (to the shop)", stages: ["greeting"] },
    { term: "何名様", reading: "nanmei-sama", meaning: "How many people? (polite)", stages: ["greeting"] },
    { term: "一人", reading: "hitori", meaning: "one person", stages: ["greeting"] },
    { term: "食券", reading: "shokken", meaning: "meal ticket (from a ticket machine)", stages: ["greeting"] },
    { term: "ご注文", reading: "go-chūmon", meaning: "order (polite)", stages: ["order"] },
    { term: "おすすめ", reading: "osusume", meaning: "recommendation", stages: ["order", "preference"] },
    { term: "売り切れ", reading: "urikire", meaning: "sold out", stages: ["order"] },
    { term: "大盛り", reading: "ōmori", meaning: "large portion", stages: ["order", "preference"] },
    { term: "とりあえず生", reading: "toriaezu nama", meaning: "a draft beer to start (a classic first order)", stages: ["order"] },
    { term: "辛い", reading: "karai", meaning: "spicy", stages: ["order"] },
    { term: "お願いします", reading: "onegaishimasu", meaning: "please (request)", stages: ["order", "preference", "pay"] },
    { term: "麺のかたさ", reading: "men no katasa", meaning: "noodle firmness", stages: ["preference"] },
    { term: "かため / 普通 / やわらかめ", reading: "katame / futsū / yawarakame", meaning: "firm / regular / soft", stages: ["preference"] },
    { term: "お任せします", reading: "omakase shimasu", meaning: "I'll leave it to you", stages: ["order", "preference"] },
    { term: "餃子", reading: "gyōza", meaning: "pan-fried dumplings", stages: ["extras"] },
    { term: "味玉", reading: "ajitama", meaning: "seasoned soft-boiled egg", stages: ["extras", "confirm"] },
    { term: "かしこまりました", reading: "kashikomarimashita", meaning: "Certainly (formal)", stages: ["confirm"] },
    { term: "どのくらいかかりますか", reading: "dono kurai kakarimasu ka", meaning: "How long will it take?", stages: ["confirm"] },
    { term: "少々お待ちください", reading: "shōshō omachi kudasai", meaning: "Please wait a moment", stages: ["confirm"] },
    { term: "お会計", reading: "okaikei", meaning: "the check / bill", stages: ["payment", "pay"] },
    { term: "お手洗い", reading: "otearai", meaning: "restroom (polite)", stages: ["payment"] },
    { term: "現金のみ", reading: "genkin nomi", meaning: "cash only", stages: ["payment", "pay"] },
    { term: "〜からお願いします", reading: "…kara onegaishimasu", meaning: "out of … (handing over a bill)", stages: ["pay"] },
    { term: "お釣り", reading: "otsuri", meaning: "change (money)", stages: ["pay"] },
    { term: "ごちそうさまでした", reading: "gochisōsama deshita", meaning: "Thank you for the meal", stages: ["payment", "farewell"] },
    { term: "失礼します", reading: "shitsurei shimasu", meaning: "Excuse me (as I leave)", stages: ["farewell"] },
    { term: "またお越しください", reading: "mata okoshi kudasai", meaning: "Please come again", stages: ["farewell"] },
  ],
  eventLines: {
    // The chef calls the bowl being made: the misheard dish if nobody caught it, the corrected one if they did.
    order_placed: (s) => ({
      voice: "chef",
      text: `はいよっ！${dishJa(s.slots.served || s.slots.heard_dish || s.slots.dish).replace("ラーメン", "")}一丁！`,
      meaning: `Coming up! One ${dishEn(s.slots.served || s.slots.heard_dish || s.slots.dish)}!`,
    }),
  },
  timeSkipText: "Twenty minutes later… the bowl is empty and you're blissfully full.",
  successTitle: "ごちそうさまでした！",
  stages: [
    {
      id: "greeting",
      group: "Greeting",
      npcGoal: "Ask how many people are in the customer's party (何名様ですか).",
      meaning: "Welcome! How many people?",
      situation: "Hiroshi welcomed you and is asking how many people are in your group.",
      cards: () => [
        card("party_size", "☝️", "Tell him it's just you", {
          intent: "Tell Hiroshi how many people are in your group: just you.",
          vocab: [
            { term: "一人", reading: "hitori", meaning: "one person" },
            { term: "です", reading: "desu", meaning: "is / am (polite)" },
          ],
          starter: "一人…",
          full: "一人です。",
          fullReading: "Hitori desu.",
          fullMeaning: "Just one (person).",
        }, ["一人", "ひとり", "1人"], { core: true }),
        card("ask_seat", "🪑", "Ask if you can sit at the counter", {
          intent: "Politely ask whether you can sit at the counter.",
          vocab: [
            { term: "カウンター", reading: "kauntā", meaning: "counter" },
            { term: "席", reading: "seki", meaning: "seat" },
            { term: "いいですか", reading: "ii desu ka", meaning: "is it OK?" },
          ],
          starter: "カウンター…",
          full: "カウンター席でもいいですか？",
          fullReading: "Kauntā-seki demo ii desu ka?",
          fullMeaning: "Is the counter OK?",
        }, ["カウンター", "席", "いいですか"], { core: true }),
        card("party_size", "🪑", "Say it's one person, at the counter please", {
          intent: "Say you're one person and ask for a seat at the counter.",
          vocab: [
            { term: "一人", reading: "hitori", meaning: "one person" },
            { term: "カウンター", reading: "kauntā", meaning: "counter" },
            { term: "でお願いします", reading: "de onegaishimasu", meaning: "…, please" },
          ],
          starter: "一人です。カウンター…",
          full: "一人です。カウンターでお願いします。",
          fullReading: "Hitori desu. Kauntā de onegaishimasu.",
          fullMeaning: "Just one. The counter, please.",
        }, ["一人", "カウンター"], { key: "one_counter", core: true }),
        card("party_size", "🌙", "Say good evening and that you're alone", {
          intent: "Greet him and tell him you're on your own.",
          vocab: [
            { term: "こんばんは", reading: "konbanwa", meaning: "good evening" },
            { term: "一人です", reading: "hitori desu", meaning: "just one person" },
          ],
          starter: "こんばんは、…",
          full: "こんばんは、一人です。",
          fullReading: "Konbanwa, hitori desu.",
          fullMeaning: "Good evening, just one.",
        }, ["こんばんは", "一人"], { key: "evening_one", core: true }),
        card("greet", "👋", "Greet him back", {
          intent: "Return his greeting politely.",
          vocab: [
            { term: "こんばんは", reading: "konbanwa", meaning: "good evening" },
            { term: "こんにちは", reading: "konnichiwa", meaning: "hello" },
          ],
          starter: "こん…",
          full: "こんばんは！",
          fullReading: "Konbanwa!",
          fullMeaning: "Good evening!",
        }, ["こんばんは", "こんにちは"]),
        card("ask_ticket", "🎫", "Ask if you need to buy a meal ticket first", {
          intent: "Many ramen shops have a ticket machine. Ask if you need a meal ticket.",
          vocab: [
            { term: "食券", reading: "shokken", meaning: "meal ticket" },
            { term: "必要ですか", reading: "hitsuyō desu ka", meaning: "is it necessary?" },
          ],
          starter: "食券は…",
          full: "食券は必要ですか？",
          fullReading: "Shokken wa hitsuyō desu ka?",
          fullMeaning: "Do I need a meal ticket?",
        }, ["食券", "必要"]),
        card("ask_open", "🕙", "Ask if they're still open", {
          intent: "It's late: ask if the shop is still open.",
          vocab: [
            { term: "まだ", reading: "mada", meaning: "still" },
            { term: "やっていますか", reading: "yatte imasu ka", meaning: "are you open? (lit. doing business)" },
          ],
          starter: "まだ…",
          full: "まだやっていますか？",
          fullReading: "Mada yatte imasu ka?",
          fullMeaning: "Are you still open?",
        }, ["まだ", "やって"]),
      ],
      // « はい » to « お一人様ですか？ » tells him how many.
      aliases: { yes: "party_size" },
      resolve: ({ report }) => {
        if (report.intent === "party_size")
          return advance(
            "order",
            "Say 'this way, please' (こちらへどうぞ), seat them at the counter, put a menu in front of them, and ask what they'd like to order.",
            "Right this way, here's the menu. What would you like to order?",
            { setSlots: { party: "1" } },
          );
        if (report.intent === "ask_seat")
          return advance(
            "order",
            "Say yes, the counter is free, invite them to sit, and ask what they'd like to order.",
            "Sure, the counter's free, have a seat. What would you like?",
          );
        if (report.intent === "ask_ticket")
          return stay(
            "info",
            "greeting",
            "Say no, there's no ticket machine here: they can just order with you at their seat. Then ask how many people they are.",
            "No, no tickets here, just order at your seat. How many people?",
          );
        if (report.intent === "ask_open")
          return stay("info", "greeting", "Say yes, you're open until 11pm (23時まで), then ask how many people they are.", "Yes, we're open until 11. How many people?");
        return null;
      },
    },
    {
      id: "order",
      group: "Order",
      npcGoal: "Ask what they would like to order (ご注文は？).",
      meaning: "What would you like to order?",
      situation: "Hiroshi is asking what you'd like to order. The menu hangs on the wall behind him.",
      extraIntents: ["ask_price", "order_side", "order_drink"],
      cards: ({ state, variant }) => {
        const special = String(variant.special) as Dish;
        return [
          state.flags.soldOutHit ? orderDishCard(special, `Order the ${dishShort(special)} he suggested`, "order_suggested") : orderDishCard("shoyu"),
          orderDishCard("tsukemen", "Order the tsukemen (dipping noodles)"),
          card("order_dish", "🍜", "Order a large miso ramen", {
            intent: "Order a miso ramen, and ask for a large portion.",
            vocab: [
              { term: "味噌ラーメン", reading: "miso rāmen", meaning: "miso ramen" },
              { term: "大盛り", reading: "ōmori", meaning: "large portion" },
              { term: "でお願いします", reading: "de onegaishimasu", meaning: "…, please" },
            ],
            starter: "味噌ラーメン、大盛り…",
            full: "味噌ラーメン、大盛りでお願いします。",
            fullReading: "Miso rāmen, ōmori de onegaishimasu.",
            fullMeaning: "A miso ramen, large, please.",
          }, ["味噌", "大盛り", "おおもり"], { key: "order_miso_large", expect: { dish: "miso", portion: "large" }, core: true }),
          state.flags.recommended && !state.flags.soldOutHit
            ? card("order_dish", "🌟", "Order what he recommended", {
                intent: "Order the dish Hiroshi just recommended.",
                vocab: [
                  { term: DISHES[special].ja, reading: DISHES[special].reading, meaning: dishEn(special) },
                  { term: "じゃあ", reading: "jā", meaning: "well then" },
                  { term: "にします", reading: "ni shimasu", meaning: "I'll have…" },
                ],
                starter: "じゃあ、…",
                full: `じゃあ、${DISHES[special].ja}にします。`,
                fullReading: `Jā, ${DISHES[special].reading} ni shimasu.`,
                fullMeaning: `Then I'll have the ${dishEn(special)}.`,
              }, [DISHES[special].ja, "にします", "じゃあ"], { key: "order_recommended", expect: { dish: special }, core: true })
            : card("ask_recommendation", "❓", "Ask what he recommends", {
                intent: "Ask Hiroshi which dish he recommends.",
                vocab: [
                  { term: "おすすめ", reading: "osusume", meaning: "recommendation" },
                  { term: "何", reading: "nan", meaning: "what" },
                ],
                starter: "おすすめは…",
                full: "おすすめは何ですか？",
                fullReading: "Osusume wa nan desu ka?",
                fullMeaning: "What do you recommend?",
              }, ["おすすめ", "何"]),
          card("no_preference", "🎲", "Order whatever he recommends", {
            intent: "Let Hiroshi choose: ask for today's recommendation, whatever it is.",
            vocab: [
              { term: "おすすめ", reading: "osusume", meaning: "the recommendation" },
              { term: "で", reading: "de", meaning: "(I'll go) with…" },
            ],
            starter: "おすすめで…",
            full: "おすすめでお願いします。",
            fullReading: "Osusume de onegaishimasu.",
            fullMeaning: "I'll have the recommendation, please.",
          }, ["おすすめ", "お任せ"], { key: "osusume_de", core: true }),
          card("ask_time", "⏳", "Ask for another minute", {
            intent: "Tell him you need a little more time to decide.",
            vocab: [
              { term: "ちょっと", reading: "chotto", meaning: "a little" },
              { term: "待ってください", reading: "matte kudasai", meaning: "please wait" },
              { term: "まだ", reading: "mada", meaning: "not yet" },
            ],
            starter: "すみません、ちょっと…",
            full: "すみません、ちょっと待ってください。",
            fullReading: "Sumimasen, chotto matte kudasai.",
            fullMeaning: "Sorry, please wait a moment.",
          }, ["ちょっと", "待って", "まだ"]),
          card("ask_english_menu", "🔤", "Ask if there's an English menu", {
            intent: "Ask whether they have a menu in English.",
            vocab: [
              { term: "英語", reading: "eigo", meaning: "English" },
              { term: "メニュー", reading: "menyū", meaning: "menu" },
              { term: "ありますか", reading: "arimasu ka", meaning: "do you have…?" },
            ],
            starter: "英語のメニューは…",
            full: "英語のメニューはありますか？",
            fullReading: "Eigo no menyū wa arimasu ka?",
            fullMeaning: "Do you have an English menu?",
          }, ["英語", "メニュー"]),
          card("ask_about_dish", "🌶️", "Ask if the miso ramen is spicy", {
            intent: "Ask whether the miso ramen is spicy.",
            vocab: [
              { term: "辛い", reading: "karai", meaning: "spicy" },
              { term: "ですか", reading: "desu ka", meaning: "is it…?" },
            ],
            starter: "味噌ラーメンは…",
            full: "味噌ラーメンは辛いですか？",
            fullReading: "Miso rāmen wa karai desu ka?",
            fullMeaning: "Is the miso ramen spicy?",
          }, ["辛い", "からい"]),
          // Only before a drink is on the order (the order holds one drink).
          ...(state.slots.drink
            ? []
            : [
                card("order_drink", "🍺", "Start with a draft beer", {
                  intent: "Order a draft beer to start, the classic Japanese way, before choosing your ramen.",
                  vocab: [
                    { term: "とりあえず", reading: "toriaezu", meaning: "for now / to start" },
                    { term: "生ビール", reading: "nama bīru", meaning: "draft beer" },
                  ],
                  starter: "とりあえず…",
                  full: "とりあえず生ビールをください。",
                  fullReading: "Toriaezu nama bīru o kudasai.",
                  fullMeaning: "A draft beer to start, please.",
                }, ["生ビール", "ビール", "とりあえず"], { key: "beer_first", expect: { drink: "beer" } }),
              ]),
        ];
      },
      resolve: ({ report, slot, variant, state }) => {
        const special = String(variant.special);
        const side = slot("side");
        const drink = slot("drink");
        const extras: Record<string, string> = {};
        if (side) extras.side = side;
        if (drink) extras.drink = drink;
        if (slot("portion") === "large") extras.portion = "large";
        // « おすすめで » / « お任せします », or « はい » to his suggestion: the recommended dish.
        if (choosesRecommendation(report) || (report.intent === "yes" && (state.flags.recommended || state.flags.soldOutHit) && !slot("dish")))
          return orderDish(state, variant, special, extras);
        if (report.intent === "order_dish") {
          const dish = slot("dish");
          if (!dish)
            return {
              ...stay("info", "order", "They want to order but didn't say which ramen. Ask which one they'd like.", "Which ramen would you like?"),
              kind: "info",
              success: false,
              reaction: "confused",
              note: "Name the dish you want.",
            };
          return orderDish(state, variant, dish, extras);
        }
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "order",
            `Recommend today's special, ${dishJa(special)}, in one enthusiastic sentence (say why it's good), then ask what they'd like.`,
            `I recommend the ${dishEn(special)}, it's really good today! What would you like?`,
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_time")
          return stay(
            "info",
            "order",
            'Say warmly "of course, take your time" (はい、ごゆっくりどうぞ), one short phrase only, then wait silently.',
            "Of course, take your time.",
            { setFlags: { askedTime: true } },
          );
        if (report.intent === "ask_english_menu")
          return stay(
            "info",
            "order",
            "Apologize: the menu is only in Japanese, but it has photos, so they can just point. Then ask what they'd like.",
            "Sorry, only Japanese, but there are photos, you can just point! What would you like?",
          );
        if (report.intent === "ask_about_dish")
          return stay(
            "info",
            "order",
            "Answer their question about the dish from the facts: none of the ramen is spicy, and there's chili oil (ラー油) on the counter if they like it hot. Then ask what they'd like.",
            "No, it's not spicy. There's chili oil on the counter if you like. What would you like?",
          );
        if (report.intent === "ask_price")
          return stay("info", "order", "Tell them the price they asked about (use the menu), then ask what they'd like.", "Here's the price… What would you like?");
        if (report.intent === "order_side" || report.intent === "order_drink")
          return stay(
            "info",
            "order",
            drink === "beer"
              ? "Say « はい、生一丁！» cheerfully (one draft beer), then ask which ramen they'd like."
              : `Note the ${side ? "side" : "drink"} they ordered, then ask which ramen they'd like.`,
            "Got it. And which ramen would you like?",
            { setSlots: extras },
          );
        return null;
      },
    },
    {
      id: "preference",
      group: "Noodles",
      npcGoal: "Ask how firm they want their noodles: regular (普通), firm (かため) or soft (やわらかめ).",
      meaning: "How would you like your noodles: regular, firm, or soft?",
      situation: "Hiroshi is asking how firm you want your noodles: firm, regular, or soft.",
      cards: () => [
        card("set_firmness", "💪", "Ask for firm noodles", {
          intent: "Say you'd like your noodles firm.",
          vocab: [
            { term: "かため", reading: "katame", meaning: "firm" },
            { term: "でお願いします", reading: "de onegaishimasu", meaning: "…, please" },
          ],
          starter: "かため…",
          full: "かためでお願いします。",
          fullReading: "Katame de onegaishimasu.",
          fullMeaning: "Firm, please.",
        }, ["かため", "硬め", "固め"], { key: "firm", expect: { firmness: "firm" }, core: true }),
        card("set_firmness", "👌", "Say regular is fine", {
          intent: "Tell him the normal firmness is fine.",
          vocab: [
            { term: "普通", reading: "futsū", meaning: "regular / normal" },
            { term: "で大丈夫です", reading: "de daijōbu desu", meaning: "…is fine" },
          ],
          starter: "普通で…",
          full: "普通で大丈夫です。",
          fullReading: "Futsū de daijōbu desu.",
          fullMeaning: "Regular is fine.",
        }, ["普通", "ふつう", "大丈夫"], { key: "regular", expect: { firmness: "normal" }, core: true }),
        card("set_firmness", "🍥", "Ask for soft noodles", {
          intent: "Say you'd like your noodles on the soft side.",
          vocab: [
            { term: "やわらかめ", reading: "yawarakame", meaning: "soft (softer than usual)" },
            { term: "でお願いします", reading: "de onegaishimasu", meaning: "…, please" },
          ],
          starter: "やわらかめ…",
          full: "やわらかめでお願いします。",
          fullReading: "Yawarakame de onegaishimasu.",
          fullMeaning: "Soft, please.",
        }, ["やわらかめ", "柔らかめ"], { key: "soft", expect: { firmness: "soft" }, core: true }),
        card("set_firmness", "🍜", "Ask for firm noodles and a large portion", {
          intent: "Ask for firm noodles, and make it a large portion.",
          vocab: [
            { term: "かため", reading: "katame", meaning: "firm" },
            { term: "大盛り", reading: "ōmori", meaning: "large portion" },
          ],
          starter: "かための大盛り…",
          full: "かための大盛りでお願いします。",
          fullReading: "Katame no ōmori de onegaishimasu.",
          fullMeaning: "Firm noodles, large portion, please.",
        }, ["かため", "大盛り"], { key: "firm_large", expect: { firmness: "firm", portion: "large" }, core: true }),
        card("no_preference", "🤲", "Leave it to him", {
          intent: "Tell Hiroshi you'll leave it to him.",
          vocab: [{ term: "お任せします", reading: "omakase shimasu", meaning: "I'll leave it to you" }],
          starter: "お任せ…",
          full: "お任せします。",
          fullReading: "Omakase shimasu.",
          fullMeaning: "I'll leave it to you.",
        }, ["お任せ", "おまかせ"], { core: true }),
        card("ask_options", "🤔", "Ask what the options are", {
          intent: "Ask him what choices you have.",
          vocab: [
            { term: "どんな", reading: "donna", meaning: "what kind of" },
            { term: "ありますか", reading: "arimasu ka", meaning: "is there…? / do you have…?" },
          ],
          starter: "どんな…",
          full: "どんなのがありますか？",
          fullReading: "Donna no ga arimasu ka?",
          fullMeaning: "What options are there?",
        }, ["どんな", "何", "ありますか"]),
        card("ask_recommendation", "⭐", "Ask which one he recommends", {
          intent: "Ask Hiroshi which firmness he'd recommend.",
          vocab: [
            { term: "おすすめ", reading: "osusume", meaning: "recommendation" },
            { term: "どれ", reading: "dore", meaning: "which one" },
          ],
          starter: "おすすめは…",
          full: "おすすめはどれですか？",
          fullReading: "Osusume wa dore desu ka?",
          fullMeaning: "Which do you recommend?",
        }, ["おすすめ", "どれ"]),
        card("ask_meaning", "💬", "Ask what « katame » means", {
          intent: "You didn't catch one of the words. Ask what « katame » means.",
          vocab: [
            { term: "どういう意味", reading: "dō iu imi", meaning: "what meaning" },
            { term: "〜って", reading: "…tte", meaning: "(quoting a word)" },
          ],
          starter: "「かため」って…",
          full: "「かため」ってどういう意味ですか？",
          fullReading: "\"Katame\" tte dō iu imi desu ka?",
          fullMeaning: "What does « katame » mean?",
        }, ["意味", "かため"]),
      ],
      resolve: ({ report, slot, state, variant, difficulty }) => {
        const portion: Record<string, string> = slot("portion") === "large" ? { portion: "large" } : {};
        if (report.intent === "set_firmness")
          return afterFirmness(state, variant, difficulty, { firmness: slot("firmness") || "normal", ...portion });
        // « お任せします », or « はい » after he recommended firm: his pick.
        if (choosesRecommendation(report) || (report.intent === "yes" && state.flags.firmRecommended && !slot("firmness"))) {
          const firmness = state.flags.firmRecommended ? "firm" : "normal";
          return afterFirmness(
            state,
            variant,
            difficulty,
            { firmness, ...portion },
            `Say "${firmness === "firm" ? "じゃあ、かためにしますね" : "じゃあ、普通にしておきますね"}" (${firmness === "firm" ? "firm it is" : "regular then"}).`,
          );
        }
        if (report.intent === "ask_options")
          return stay(
            "info",
            "preference",
            "Explain the three options simply in Japanese only: やわらかめ (soft), 普通 (regular), かため (firm). Then ask which they'd like.",
            "We have soft, regular, or firm. Which would you like?",
          );
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "preference",
            "Say firm (かため) is the most popular with regulars, it goes great with the soup, then ask which they'd like.",
            "Firm is the most popular! Which would you like?",
            { setFlags: { firmRecommended: true } },
          );
        return null;
      },
    },
    {
      id: "extras",
      group: "Noodles",
      npcGoal: "Offer a gyoza set for +300 yen and ask if they'd like it.",
      meaning: "Would you like to add gyoza as a set? It's 300 yen more.",
      situation: "An unexpected follow-up: Hiroshi is offering to add gyoza (dumplings) as a set for 300 yen.",
      cards: ({ state }) => [
        card("order_side", "🥟", "Add the gyoza", {
          intent: "Say yes, you'd like the gyoza set.",
          vocab: [
            { term: "餃子", reading: "gyōza", meaning: "dumplings" },
            { term: "セット", reading: "setto", meaning: "set (combo)" },
          ],
          starter: "はい、餃子…",
          full: "はい、餃子セットでお願いします。",
          fullReading: "Hai, gyōza setto de onegaishimasu.",
          fullMeaning: "Yes, the gyoza set please.",
        }, ["餃子", "ぎょうざ", "セット", "はい"], { expect: { side: "gyoza" }, core: true }),
        card("decline", "🙅", "Politely decline", {
          intent: "Say no thank you, politely.",
          vocab: [
            { term: "大丈夫です", reading: "daijōbu desu", meaning: "I'm fine (a polite no)" },
            { term: "結構です", reading: "kekkō desu", meaning: "no thank you" },
          ],
          starter: "いえ、…",
          full: "いえ、大丈夫です。",
          fullReading: "Ie, daijōbu desu.",
          fullMeaning: "No, I'm fine.",
        }, ["大丈夫", "結構", "いいえ"], { core: true }),
        card("decline", "🙏", "Decline with thanks", {
          intent: "Turn the offer down formally, and thank him.",
          vocab: [
            { term: "結構です", reading: "kekkō desu", meaning: "no thank you (formal)" },
            { term: "ありがとうございます", reading: "arigatō gozaimasu", meaning: "thank you" },
          ],
          starter: "結構です…",
          full: "結構です。ありがとうございます。",
          fullReading: "Kekkō desu. Arigatō gozaimasu.",
          fullMeaning: "No thank you. Thanks all the same.",
        }, ["結構", "ありがとう"], { key: "kekko", core: true }),
        card("order_side", "🍚", "Say no gyoza, but ask for rice", {
          intent: "Skip the gyoza, but ask for a bowl of rice instead.",
          vocab: [
            { term: "〜はいいので", reading: "…wa ii node", meaning: "I'll skip…, so" },
            { term: "ライス", reading: "raisu", meaning: "rice (with a meal)" },
          ],
          starter: "餃子はいいので、ライス…",
          full: "餃子はいいので、ライスをお願いします。",
          fullReading: "Gyōza wa ii node, raisu o onegaishimasu.",
          fullMeaning: "I'll skip the gyoza, but rice please.",
        }, ["ライス", "ご飯"], { key: "rice", expect: { side: "rice" }, core: true }),
        card("order_side", "🥚", "Ask for a seasoned egg instead", {
          intent: "Ask for a seasoned egg on your ramen instead of the gyoza.",
          vocab: [
            { term: "代わりに", reading: "kawari ni", meaning: "instead" },
            { term: "味玉", reading: "ajitama", meaning: "seasoned soft-boiled egg" },
          ],
          starter: "代わりに…",
          full: "代わりに味玉をお願いします。",
          fullReading: "Kawari ni ajitama o onegaishimasu.",
          fullMeaning: "A seasoned egg instead, please.",
        }, ["味玉", "代わり"], { key: "egg", expect: { side: "egg" }, core: true }),
        card("ask_price", "💴", "Ask how much it is", {
          intent: "Ask about the price of the set.",
          vocab: [{ term: "いくら", reading: "ikura", meaning: "how much" }],
          starter: "いくら…",
          full: "いくらですか？",
          fullReading: "Ikura desu ka?",
          fullMeaning: "How much is it?",
        }, ["いくら"]),
        card("ask_about_dish", "🔢", "Ask how many gyoza come in the set", {
          intent: "Ask how many gyoza the set comes with.",
          vocab: [
            { term: "何個", reading: "nanko", meaning: "how many (pieces)" },
            { term: "餃子", reading: "gyōza", meaning: "dumplings" },
          ],
          starter: "餃子は何…",
          full: "餃子は何個ですか？",
          fullReading: "Gyōza wa nanko desu ka?",
          fullMeaning: "How many gyoza are there?",
        }, ["何個", "なんこ"]),
        // Only before a drink is on the order (the order holds one drink).
        ...(state.slots.drink
          ? []
          : [
              card("order_drink", "🍵", "Say no gyoza, but order an oolong tea", {
                intent: "Turn down the gyoza, and order an oolong tea instead.",
                vocab: [
                  { term: "〜はいいです", reading: "…wa ii desu", meaning: "I'll pass on…" },
                  { term: "ウーロン茶", reading: "ūroncha", meaning: "oolong tea" },
                ],
                starter: "餃子はいいです。ウーロン茶…",
                full: "餃子はいいです。ウーロン茶をください。",
                fullReading: "Gyōza wa ii desu. Ūroncha o kudasai.",
                fullMeaning: "No gyoza, thanks. An oolong tea, please.",
              }, ["ウーロン茶", "ウーロン"], { key: "oolong", expect: { drink: "oolong" }, core: true }),
            ]),
      ],
      // « はい » / « いいえ » to the gyoza offer.
      aliases: { yes: "order_side", no: "decline" },
      resolve: ({ report, state, variant, slot }) => {
        if (report.intent === "order_side") return toConfirm(state, variant, { side: slot("side") || "gyoza" });
        if (report.intent === "decline") return toConfirm(state, variant, {});
        if (report.intent === "order_drink") return toConfirm(state, variant, { drink: slot("drink") || "oolong" });
        if (report.intent === "ask_price")
          return stay("info", "extras", "Say it's 300 yen extra for five gyoza, and ask if they'd like it.", "It's 300 yen extra for five gyoza. Would you like it?");
        if (report.intent === "ask_about_dish")
          return stay("info", "extras", "Say the set comes with five gyoza, for 300 yen more. Ask if they'd like it.", "Five gyoza, 300 yen more. Would you like it?");
        return null;
      },
    },
    {
      id: "confirm",
      group: "Confirm",
      npcGoal: "Read the order back and ask the customer to confirm it.",
      meaning: "Let me confirm your order. Is that right?",
      situation: "Hiroshi is reading your order back. Listen carefully: is it what you ordered?",
      cards: ({ state }) => {
        const dish = (state.slots.dish || "shoyu") as Dish;
        return [
          card("confirm", "✅", "Confirm the order", {
            intent: "Tell him yes, that's correct, but only if it really IS what you ordered!",
            vocab: [
              { term: "はい", reading: "hai", meaning: "yes" },
              { term: "そうです", reading: "sō desu", meaning: "that's right" },
            ],
            starter: "はい、…",
            full: "はい、そうです。",
            fullReading: "Hai, sō desu.",
            fullMeaning: "Yes, that's right.",
          }, ["はい", "そうです", "お願いします"], { core: true }),
          card("confirm", "👍", "Say yes, go ahead with that", {
            intent: "Tell him that's it and he can go ahead, but only if the order he read back is right!",
            vocab: [
              { term: "それで", reading: "sore de", meaning: "with that / like that" },
              { term: "お願いします", reading: "onegaishimasu", meaning: "please" },
            ],
            starter: "はい、それで…",
            full: "はい、それでお願いします。",
            fullReading: "Hai, sore de onegaishimasu.",
            fullMeaning: "Yes, that's it, please.",
          }, ["それで", "はい"], { key: "sore_de", core: true }),
          card("correct_order", "✏️", "Correct the order", {
            intent: "Tell him that's not right and say what you actually ordered.",
            vocab: [
              { term: "違います", reading: "chigaimasu", meaning: "that's wrong" },
              { term: "じゃなくて", reading: "ja nakute", meaning: "not…, but…" },
              { term: DISHES[dish].ja, reading: DISHES[dish].reading, meaning: dishEn(dish) },
            ],
            starter: "すみません、…",
            full: `すみません、${DISHES[dish].ja}です。`,
            fullReading: `Sumimasen, ${DISHES[dish].reading} desu.`,
            fullMeaning: `Sorry, it's ${dishEn(dish)}.`,
          }, ["違います", "ちがいます", "じゃなくて", "すみません"], { expect: { dish }, core: true }),
          card("ask_repeat", "🔁", "Ask him to say the order again", {
            intent: "You're not sure you heard the order right. Ask him to say it once more.",
            vocab: [
              { term: "もう一度", reading: "mō ichido", meaning: "once more" },
              { term: "すみません", reading: "sumimasen", meaning: "sorry / excuse me" },
            ],
            starter: "すみません、もう一度…",
            full: "すみません、もう一度お願いします。",
            fullReading: "Sumimasen, mō ichido onegaishimasu.",
            fullMeaning: "Sorry, once more please.",
          }, ["もう一度", "もういちど"]),
          card("ask_wait_time", "⏱️", "Ask how long it will take", {
            intent: "Ask how long the food will take.",
            vocab: [
              { term: "どのくらい", reading: "dono kurai", meaning: "how long / how much" },
              { term: "かかりますか", reading: "kakarimasu ka", meaning: "does it take?" },
            ],
            starter: "どのくらい…",
            full: "どのくらいかかりますか？",
            fullReading: "Dono kurai kakarimasu ka?",
            fullMeaning: "How long will it take?",
          }, ["どのくらい", "かかります"]),
          // Adding to the order: one drink and one side at most.
          ...(state.slots.drink
            ? []
            : [
                card("order_drink", "🍵", "Add an oolong tea", {
                  intent: "Add a drink to your order.",
                  vocab: [
                    { term: "ウーロン茶", reading: "ūroncha", meaning: "oolong tea" },
                    { term: "も", reading: "mo", meaning: "also" },
                    { term: "あと", reading: "ato", meaning: "and also" },
                  ],
                  starter: "あと、ウーロン茶…",
                  full: "あと、ウーロン茶もお願いします。",
                  fullReading: "Ato, ūroncha mo onegaishimasu.",
                  fullMeaning: "Also, an oolong tea please.",
                }, ["ウーロン茶", "も", "あと"], { expect: { drink: "oolong" } }),
              ]),
          ...(state.slots.side
            ? []
            : [
                card("order_side", "🥚", "Add a seasoned egg", {
                  intent: "Add a seasoned egg to your ramen.",
                  vocab: [
                    { term: "味玉", reading: "ajitama", meaning: "seasoned soft-boiled egg" },
                    { term: "あと", reading: "ato", meaning: "and also" },
                  ],
                  starter: "あと、味玉…",
                  full: "あと、味玉もお願いします。",
                  fullReading: "Ato, ajitama mo onegaishimasu.",
                  fullMeaning: "Also, a seasoned egg please.",
                }, ["味玉", "あと"], { key: "add_egg", expect: { side: "egg" } }),
              ]),
        ];
      },
      extraIntents: ["order_side"],
      // « はい » / « いいえ » to the read-back.
      aliases: { yes: "confirm", no: "correct_order" },
      resolve: ({ report, state, slot, variant }) => {
        const placed = ["order_placed", "time_skip", "served"] as const;
        if (report.intent === "confirm") {
          if (state.flags.misheard) {
            const wrong = state.slots.heard_dish;
            return advance(
              "payment",
              `Say "かしこまりました！" and call the order out to the kitchen (the ${dishJa(wrong)} you read back). Say it'll be ready shortly.`,
              "Certainly! Coming right up.",
              {
                success: false,
                events: [...placed],
                setSlots: { served: wrong },
                setFlags: { wrongOrder: true, misheard: false },
                note: `Hiroshi read back ${dishJa(wrong)} (${dishEn(wrong)}), not what you ordered! Listen closely when an order is repeated back.`,
              },
            );
          }
          return advance(
            "payment",
            'Say "かしこまりました！" (certainly), call the order out to the kitchen, and say it\'ll be ready soon.',
            "Certainly! Coming right up.",
            { events: [...placed], setSlots: { served: state.slots.dish } },
          );
        }
        if (report.intent === "correct_order") {
          const wanted = slot("dish") || state.slots.dish;
          if (wanted === variant.soldOut)
            return stay("branch", "confirm", `Apologize: ${dishJa(wanted)} is sold out today. Ask what they'd like instead.`, `Sorry, the ${dishEn(wanted)} is sold out. What would you like instead?`);
          if (state.flags.misheard)
            return advance(
              "payment",
              `Apologize for mishearing (失礼しました！), correct it to ${dishJa(wanted)}, and say it'll be ready soon.`,
              `Oh, my apologies, ${dishEn(wanted)}. Coming right up!`,
              {
                events: [...placed],
                setSlots: { dish: wanted, served: wanted },
                setFlags: { corrected: true, misheard: false },
                note: "You caught the waiter's mistake and corrected it. Great listening!",
              },
            );
          if (wanted !== state.slots.dish)
            return stay(
              "info",
              "confirm",
              `They changed their order to ${dishJa(wanted)}. Read back the updated order and ask them to confirm.`,
              `Ah, ${dishEn(wanted)} then. Is that right?`,
              { setSlots: { dish: wanted, heard_dish: wanted } },
            );
          return stay("info", "confirm", "Politely say that's what you have, read the order back once more, and ask if it's OK.", "That's what I have, is that OK?");
        }
        if (report.intent === "order_drink" || report.intent === "order_side") {
          const extra: Record<string, string> = {};
          if (report.intent === "order_drink") extra.drink = slot("drink") || "oolong";
          else extra.side = slot("side") || "egg";
          const merged = { ...state.slots, ...extra };
          const summary = orderSummary(merged, state.slots.heard_dish);
          return stay(
            "info",
            "confirm",
            `Add it, then read the full order back again, ${summary.ja}, and ask to confirm.`,
            `Sure. So that's ${summary.en}, right?`,
            { setSlots: extra },
          );
        }
        if (report.intent === "ask_wait_time")
          return stay(
            "info",
            "confirm",
            "Say it'll be about five minutes (5分くらいです), then ask them to confirm the order you read back.",
            "About five minutes. So, is the order right?",
          );
        return null;
      },
    },
    {
      id: "payment",
      group: "Payment",
      learnerOpens: "You've finished eating. Walk up to the register: you speak first.",
      npcGoal: "Stand at the register ready to take payment; when asked, tell the customer the total.",
      meaning: "",
      situation: "You've finished your ramen. Get Hiroshi's attention and ask to pay.",
      cards: () => [
        card("ask_bill", "🧾", "Ask for the check", {
          intent: "Get his attention and say you'd like to pay.",
          vocab: [
            { term: "すみません", reading: "sumimasen", meaning: "excuse me" },
            { term: "お会計", reading: "okaikei", meaning: "the check / bill" },
          ],
          starter: "すみません、お会計…",
          full: "すみません、お会計お願いします。",
          fullReading: "Sumimasen, okaikei onegaishimasu.",
          fullMeaning: "Excuse me, the check please.",
        }, ["お会計", "会計", "すみません"], { core: true }),
        card("ask_bill", "🙋", "Ask if you can pay now", {
          intent: "Ask him, casually but politely, if you can settle the bill.",
          vocab: [
            { term: "お会計", reading: "okaikei", meaning: "the check / bill" },
            { term: "いいですか", reading: "ii desu ka", meaning: "is it OK? / may I?" },
          ],
          starter: "お会計…",
          full: "お会計いいですか？",
          fullReading: "Okaikei ii desu ka?",
          fullMeaning: "Could I get the check?",
        }, ["お会計", "いいですか"], { key: "bill_ii", core: true }),
        card("ask_bill", "💴", "Ask how much it comes to", {
          intent: "Ask how much it all comes to.",
          vocab: [
            { term: "全部で", reading: "zenbu de", meaning: "in total" },
            { term: "いくら", reading: "ikura", meaning: "how much" },
          ],
          starter: "全部で…",
          full: "全部でいくらですか？",
          fullReading: "Zenbu de ikura desu ka?",
          fullMeaning: "How much is it in total?",
        }, ["全部で", "いくら"], { key: "total", core: true }),
        card("compliment", "😋", "Tell him it was delicious", {
          intent: "Thank him for the meal and say it was tasty.",
          vocab: [
            { term: "ごちそうさまでした", reading: "gochisōsama deshita", meaning: "thank you for the meal" },
            { term: "美味しかった", reading: "oishikatta", meaning: "it was delicious" },
          ],
          starter: "ごちそうさま…",
          full: "ごちそうさまでした！美味しかったです。",
          fullReading: "Gochisōsama deshita! Oishikatta desu.",
          fullMeaning: "Thank you for the meal! It was delicious.",
        }, ["ごちそうさま", "美味しかった", "おいしかった"], { core: true }),
        card("compliment", "🍲", "Say the soup was amazing", {
          intent: "Tell him the soup was the best part.",
          vocab: [
            { term: "スープ", reading: "sūpu", meaning: "soup / broth" },
            { term: "最高でした", reading: "saikō deshita", meaning: "was the best" },
          ],
          starter: "スープが…",
          full: "スープが最高でした！",
          fullReading: "Sūpu ga saikō deshita!",
          fullMeaning: "The soup was amazing!",
        }, ["スープ", "最高"], { key: "soup", core: true }),
        card("ask_card", "💳", "Ask if you can pay by card", {
          intent: "Ask whether cards are accepted.",
          vocab: [
            { term: "カード", reading: "kādo", meaning: "card" },
            { term: "使えますか", reading: "tsukaemasu ka", meaning: "can I use…?" },
          ],
          starter: "カード…",
          full: "カードは使えますか？",
          fullReading: "Kādo wa tsukaemasu ka?",
          fullMeaning: "Can I use a card?",
        }, ["カード", "使えます"], { core: true }),
        card("ask_toilet", "🚻", "Ask where the restroom is", {
          intent: "Before paying, ask where the restroom is.",
          vocab: [
            { term: "お手洗い", reading: "otearai", meaning: "restroom (polite)" },
            { term: "どこですか", reading: "doko desu ka", meaning: "where is it?" },
          ],
          starter: "お手洗いは…",
          full: "お手洗いはどこですか？",
          fullReading: "Otearai wa doko desu ka?",
          fullMeaning: "Where is the restroom?",
        }, ["お手洗い", "トイレ"]),
      ],
      aliases: { ask_price: "ask_bill" },
      resolve: ({ report, state, variant }) => {
        const t = total(state.slots);
        if (report.intent === "ask_bill" || report.intent === "pay")
          return advance("pay", `Say "はい、ありがとうございます" and tell them the total: ${t}円.`, `Thank you! That'll be ${t} yen.`, { events: ["bill_shown"] });
        if (report.intent === "compliment" || report.intent === "thanks")
          return advance(
            "pay",
            `Thank them warmly for the kind words (ありがとうございます！), then tell them the total: ${t}円.`,
            `Thank you so much! That'll be ${t} yen.`,
            { events: ["bill_shown"], setFlags: { complimented: true } },
          );
        if (report.intent === "ask_card") {
          if (variant.cashOnly)
            return {
              ...advance(
                "pay",
                `Apologize: this shop is cash only (すみません、うちは現金のみなんです). Then tell them the total: ${t}円.`,
                `Sorry, we're cash only. That'll be ${t} yen.`,
                { events: ["bill_shown"], setFlags: { cardRefused: true } },
              ),
              kind: "branch",
              reaction: "neutral",
              note: "Many small ramen shops are cash only, and you found out by asking.",
            };
          return advance("pay", `Say yes, cards are fine, and tell them the total: ${t}円.`, `Yes, cards are fine. That'll be ${t} yen.`, { events: ["bill_shown"] });
        }
        if (report.intent === "ask_toilet")
          return stay("info", "payment", "Tell them the restroom is at the back, on the right (奥の右側です). Nothing more.", "It's at the back, on the right.");
        return null;
      },
    },
    {
      id: "pay",
      group: "Payment",
      npcGoal: "Tell the customer the total and wait for them to pay.",
      meaning: "That'll be … yen.",
      situation: "Hiroshi told you the total. Pay for your meal.",
      cards: ({ state }) => [
        card("pay", "💴", "Pay with cash", {
          intent: "Hand over cash and say you'll pay in cash.",
          vocab: [
            { term: "現金", reading: "genkin", meaning: "cash" },
            { term: "で", reading: "de", meaning: "with / by" },
          ],
          starter: "現金で…",
          full: "現金でお願いします。",
          fullReading: "Genkin de onegaishimasu.",
          fullMeaning: "Cash, please.",
        }, ["現金", "げんきん", "はい"], { key: "pay_cash", expect: { payment_method: "cash" }, core: true }),
        card("pay", "💴", "Hand over a 2,000 yen note", {
          intent: "Hand him your 2,000 yen and say it the way people do at a Japanese register.",
          vocab: [
            { term: "二千円", reading: "nisen-en", meaning: "2,000 yen" },
            { term: "〜から", reading: "…kara", meaning: "out of… (handing over money)" },
          ],
          starter: "二千円から…",
          full: "二千円からお願いします。",
          fullReading: "Nisen-en kara onegaishimasu.",
          fullMeaning: "Out of 2,000 yen, please.",
        }, ["二千円", "2000円", "から"], { key: "nisen", expect: { payment_method: "cash" }, core: true }),
        // Once he's said it's cash only, the card and IC options are gone.
        ...(state.flags.cardRefused
          ? [
              card("pay", "👛", "Say you'll pay cash then", {
                intent: "Accept that it's cash only and say you'll pay in cash.",
                vocab: [
                  { term: "じゃあ", reading: "jā", meaning: "well then" },
                  { term: "払います", reading: "haraimasu", meaning: "(I will) pay" },
                ],
                starter: "じゃあ、現金…",
                full: "じゃあ、現金で払います。",
                fullReading: "Jā, genkin de haraimasu.",
                fullMeaning: "Then I'll pay in cash.",
              }, ["現金", "払います", "じゃあ"], { key: "pay_cash_then", expect: { payment_method: "cash" }, core: true }),
            ]
          : [
              card("pay", "💳", "Pay by card", {
                intent: "Say you'd like to pay by card.",
                vocab: [{ term: "カード", reading: "kādo", meaning: "card" }],
                starter: "カードで…",
                full: "カードでお願いします。",
                fullReading: "Kādo de onegaishimasu.",
                fullMeaning: "By card, please.",
              }, ["カード"], { key: "pay_card", expect: { payment_method: "card" }, core: true }),
              card("pay", "📲", "Pay with your Suica card", {
                intent: "Say you'd like to pay with Suica, your IC transit card.",
                vocab: [
                  { term: "Suica", reading: "suika", meaning: "an IC transit card (also works in shops)" },
                  { term: "で", reading: "de", meaning: "with / by" },
                ],
                starter: "Suicaで…",
                full: "Suicaでお願いします。",
                fullReading: "Suika de onegaishimasu.",
                fullMeaning: "With Suica, please.",
              }, ["suica", "スイカ"], { key: "pay_ic", expect: { payment_method: "ic" }, core: true }),
            ]),
        card("ask_receipt", "🧾", "Ask for a receipt", {
          intent: "Ask for a receipt.",
          vocab: [
            { term: "レシート", reading: "reshīto", meaning: "receipt" },
            { term: "領収書", reading: "ryōshūsho", meaning: "formal receipt" },
          ],
          starter: "レシート…",
          full: "レシートをお願いします。",
          fullReading: "Reshīto o onegaishimasu.",
          fullMeaning: "A receipt, please.",
        }, ["レシート", "領収書"]),
        card("ask_price", "❔", "Ask how much it was again", {
          intent: "You missed the total. Ask him how much it was again.",
          vocab: [
            { term: "いくら", reading: "ikura", meaning: "how much" },
            { term: "〜でしたっけ", reading: "…deshita kke", meaning: "…was it again?" },
          ],
          starter: "すみません、いくら…",
          full: "すみません、いくらでしたっけ？",
          fullReading: "Sumimasen, ikura deshita kke?",
          fullMeaning: "Sorry, how much was it again?",
        }, ["いくら", "でしたっけ"]),
      ],
      extraIntents: ["ask_card"],
      aliases: { ask_bill: "ask_price" },
      resolve: ({ report, slot, variant, state }) => {
        const t = total(state.slots);
        // « はい、カードで » counts only when it actually names how they'll pay.
        if (report.intent === "pay" || (report.intent === "yes" && slot("payment_method"))) {
          const method = slot("payment_method") || "cash";
          if ((method === "card" || method === "ic") && variant.cashOnly)
            return stay(
              "branch",
              "pay",
              `Apologize: this shop only takes cash (現金のみです)${method === "ic" ? ", no Suica or IC cards either" : ""}. Ask if they have cash.`,
              "Sorry, we only take cash. Do you have cash?",
              { setFlags: { cardRefused: true }, note: "Cash only! You needed a recovery path." },
            );
          return advance(
            "farewell",
            method === "card"
              ? "Process the card, hand back the card and receipt, and thank them warmly (ありがとうございました)."
              : method === "ic"
                ? "Hold out the reader for them to tap their IC card (はい、こちらにタッチお願いします), say it went through, hand them the receipt, and thank them warmly (ありがとうございました)."
                : `Take the cash (e.g. "2000円お預かりします"), give the change for a ${t}円 total, hand them the receipt, and thank them warmly (ありがとうございました).`,
            method === "card" ? "Thank you very much! Here's your receipt." : method === "ic" ? "Tap here, please… All done, thank you very much!" : "Out of ¥2,000… here's your change. Thank you very much!",
            { objectiveComplete: true, events: ["payment_done"], setSlots: { paid: method } },
          );
        }
        if (report.intent === "ask_receipt")
          return stay("info", "pay", `Say of course, you'll give them a receipt, and remind them the total is ${t}円.`, `Of course. The total is ${t} yen.`, { setFlags: { receipt: true } });
        if (report.intent === "ask_price") return stay("info", "pay", `Repeat the total clearly: ${t}円.`, `It's ${t} yen.`);
        if (report.intent === "compliment" || report.intent === "thanks")
          return stay("info", "pay", `Thank them warmly (ありがとうございます！), then remind them the total is ${t}円.`, `Thank you! That's ${t} yen.`);
        if (report.intent === "ask_card") {
          if (variant.cashOnly)
            return stay("branch", "pay", "Apologize: cash only here. Ask if they have cash.", "Sorry, it's cash only. Do you have cash?", { setFlags: { cardRefused: true } });
          return stay("info", "pay", "Say yes, cards are fine.", "Yes, cards are fine.");
        }
        return null;
      },
    },
    {
      id: "farewell",
      group: "Payment",
      npcGoal: "Thank the customer and see them off warmly (またお越しください).",
      meaning: "Thank you very much! Please come again!",
      situation: "You've paid! Say goodbye the way people do in Japan.",
      cards: () => [
        card("thanks", "🙏", "Thank him for the meal", {
          intent: "Say the set phrase people use when leaving a restaurant in Japan.",
          vocab: [{ term: "ごちそうさまでした", reading: "gochisōsama deshita", meaning: "thank you for the meal" }],
          starter: "ごちそう…",
          full: "ごちそうさまでした！",
          fullReading: "Gochisōsama deshita!",
          fullMeaning: "Thank you for the meal!",
        }, ["ごちそうさま", "ありがとう"], { core: true }),
        card("come_again", "🌟", "Say you'll come again", {
          intent: "Tell him you'll be back.",
          vocab: [
            { term: "また", reading: "mata", meaning: "again" },
            { term: "来ます", reading: "kimasu", meaning: "(I will) come" },
          ],
          starter: "また…",
          full: "また来ます！",
          fullReading: "Mata kimasu!",
          fullMeaning: "I'll come again!",
        }, ["また", "来ます"], { core: true }),
        card("compliment", "⭐", "Say it was the best ramen", {
          intent: "Tell him the ramen was amazing.",
          vocab: [
            { term: "最高", reading: "saikō", meaning: "the best" },
            { term: "でした", reading: "deshita", meaning: "was (polite)" },
          ],
          starter: "最高…",
          full: "最高でした！",
          fullReading: "Saikō deshita!",
          fullMeaning: "It was the best!",
        }, ["最高", "美味しかった", "おいしかった"], { core: true }),
        card("compliment", "📣", "Say you'll recommend it to your friends", {
          intent: "Tell him you'll recommend the shop to your friends.",
          vocab: [
            { term: "友達", reading: "tomodachi", meaning: "friend(s)" },
            { term: "勧めます", reading: "susumemasu", meaning: "(I will) recommend" },
          ],
          starter: "友達にも…",
          full: "友達にも勧めます！",
          fullReading: "Tomodachi ni mo susumemasu!",
          fullMeaning: "I'll recommend it to my friends too!",
        }, ["友達", "勧め"], { key: "friends", core: true }),
        card("goodbye", "🚪", "Thank him and excuse yourself", {
          intent: "Thank him and take your leave politely, the way people do in Japan.",
          vocab: [
            { term: "ありがとうございました", reading: "arigatō gozaimashita", meaning: "thank you (for everything)" },
            { term: "失礼します", reading: "shitsurei shimasu", meaning: "excuse me (as I leave)" },
          ],
          starter: "ありがとうございました。失礼…",
          full: "ありがとうございました。失礼します。",
          fullReading: "Arigatō gozaimashita. Shitsurei shimasu.",
          fullMeaning: "Thank you very much. Goodbye.",
        }, ["失礼します", "ありがとうございました"], { core: true }),
        card("ask_directions", "🚉", "Ask which way the station is", {
          intent: "On your way out, ask which way the station is.",
          vocab: [
            { term: "駅", reading: "eki", meaning: "station" },
            { term: "どちら", reading: "dochira", meaning: "which way (polite)" },
          ],
          starter: "駅は…",
          full: "駅はどちらですか？",
          fullReading: "Eki wa dochira desu ka?",
          fullMeaning: "Which way is the station?",
        }, ["駅", "どちら", "どっち"], { core: true }),
      ],
      extraIntents: ["ask_directions"],
      resolve: ({ report }) => {
        if (report.intent === "ask_directions")
          return complete(
            "farewell",
            "Point the way: Shinjuku Station is straight down the street to the right, about five minutes on foot. Then say a warm goodbye (ありがとうございました！).",
            "The station's straight down to the right, five minutes. Thank you, come again!",
          );
        if (["thanks", "goodbye", "come_again", "compliment", "greet", "yes", "no"].includes(report.intent))
          return complete(
            "farewell",
            'Say a warm final goodbye in one short sentence (e.g. "ありがとうございました！またお越しくださいませ！").',
            "Thank you! Please come again!",
          );
        return null;
      },
    },
  ],
};
