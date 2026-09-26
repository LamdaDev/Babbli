import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { card } from "./helpers";
import type { Outcome, ScenarioDef, ScenarioState, Variant } from "./types";

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

const dishJa = (d: string) => DISHES[d as Dish]?.ja ?? d;
const dishEn = (d: string) => DISHES[d as Dish]?.en ?? d;

function total(slots: Record<string, string>) {
  const dish = (slots.served || slots.dish) as Dish;
  return (
    (DISHES[dish]?.price ?? 900) +
    (slots.side ? SIDES[slots.side]?.price ?? 0 : 0) +
    (slots.drink ? DRINKS[slots.drink]?.price ?? 0 : 0)
  );
}

function orderSummary(slots: Record<string, string>, dishOverride?: string) {
  const dish = dishOverride || slots.dish;
  const parts = [`${dishJa(dish)} (${FIRMNESS[slots.firmness]?.ja ?? "普通"})`];
  if (slots.side) parts.push(SIDES[slots.side]?.ja ?? slots.side);
  if (slots.drink) parts.push(DRINKS[slots.drink]?.ja ?? slots.drink);
  const en = [`${dishEn(dish)} (${FIRMNESS[slots.firmness]?.en ?? "regular"} noodles)`];
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
  const ack = slots.side ? `Acknowledge (${SIDES[slots.side]?.ja}).` : slots.firmness ? `Acknowledge (${FIRMNESS[slots.firmness]?.ja}).` : "Acknowledge briefly.";
  return advance(
    "confirm",
    wrong
      ? `${ack} Then read the order back to confirm — but you MISHEARD the dish: say "${heard.ja}" (NOT what they ordered). Ask "is that right?" naturally. Do not hint that it might be wrong.`
      : `${ack} Then read the whole order back — ${heard.ja} — and ask if that's correct.`,
    `So that's ${heard.en} — is that right?`,
    {
      setSlots: { ...slots, heard_dish: wrong ?? merged.dish },
      setFlags: { misheard: !!wrong, misheardOnce: state.flags.misheardOnce || !!wrong },
    },
  );
}

const orderDishCard = (dish: Dish, label?: string, key?: string) =>
  card(
    "order_dish",
    "🍜",
    label ?? `Order the ${dishEn(dish).split(" (")[0]} ramen`.replace("ramen ramen", "ramen"),
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
    { key: key ?? `order_${dish}`, expect: { dish } },
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
  locationLabel: "TOKYO — SHINJUKU",
  title: "Tokyo Ramen Shop",
  venueName: "麺屋ほし · Menya Hoshi",
  objective: "Order a meal, answer the follow-up questions, and pay.",
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
  requiredSlots: ["dish", "firmness", "paid"],
  intents: {
    party_size: "Says how many people are in their party (e.g. 一人です)",
    ask_seat: "Asks to sit somewhere / asks if a seat is free",
    order_dish: "Orders a ramen dish (fill `dish`)",
    ask_recommendation: "Asks what you recommend",
    ask_time: "Asks for more time to decide / asks you to wait",
    ask_price: "Asks how much something costs",
    order_side: "Orders or accepts a side dish (fill `side`)",
    order_drink: "Orders a drink (fill `drink`)",
    set_firmness: "States noodle firmness preference (fill `firmness`)",
    ask_options: "Asks what the options/choices are",
    decline: "Politely declines an offer (no thank you)",
    confirm: "Confirms that what you read back is correct (yes, that's right)",
    correct_order: "Says your read-back is wrong and corrects it (fill `dish` with what they actually want)",
    ask_bill: "Asks for the check / says they want to pay",
    compliment: "Compliments the food / says ごちそうさまでした",
    ask_card: "Asks whether card payment is accepted",
    pay: "Pays / says how they will pay (fill `payment_method`)",
    ask_receipt: "Asks for a receipt",
    come_again: "Says they will come again",
  },
  slots: {
    dish: { description: "Ramen dish the customer names", values: Object.keys(DISHES) },
    firmness: { description: "Noodle firmness requested", values: ["soft", "normal", "firm"] },
    side: { description: "Side dish ordered/accepted", values: ["gyoza", "rice", "egg"] },
    drink: { description: "Drink ordered", values: ["oolong", "beer", "water"] },
    payment_method: { description: "How they pay", values: ["cash", "card"] },
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
          .map(([k, d]) => `${d.ja} ${d.price}円${k === v.soldOut ? " — SOLD OUT today (本日売り切れ)" : ""}`)
          .join(" / "),
      "Sides: 餃子セット +300円 (5 gyoza), ライス 150円, 味玉 150円. Drinks: 生ビール 600円, ウーロン茶 250円, water is free.",
      `Today's recommendation: ${dishJa(String(v.special))}.`,
      "Noodle firmness options: やわらかめ (soft), 普通 (regular), かため (firm).",
      v.cashOnly ? "PAYMENT: CASH ONLY (現金のみ). Cards are NOT accepted." : "Payment: cash and credit cards are both accepted.",
    ].join("\n"),
  asrKeywords: [
    "醤油ラーメン", "味噌ラーメン", "塩ラーメン", "豚骨ラーメン", "つけ麺", "餃子", "かため", "普通", "やわらかめ",
    "お会計", "ウーロン茶", "生ビール", "現金", "カード", "一人", "おすすめ", "ごちそうさまでした",
  ],
  vocabulary: [
    { term: "いらっしゃいませ", reading: "irasshaimase", meaning: "Welcome (to the shop)", stages: ["greeting"] },
    { term: "何名様", reading: "nanmei-sama", meaning: "How many people? (polite)", stages: ["greeting"] },
    { term: "一人", reading: "hitori", meaning: "one person", stages: ["greeting"] },
    { term: "ご注文", reading: "go-chūmon", meaning: "order (polite)", stages: ["order"] },
    { term: "おすすめ", reading: "osusume", meaning: "recommendation", stages: ["order"] },
    { term: "売り切れ", reading: "urikire", meaning: "sold out", stages: ["order"] },
    { term: "お願いします", reading: "onegaishimasu", meaning: "please (request)", stages: ["order", "preference", "pay"] },
    { term: "麺のかたさ", reading: "men no katasa", meaning: "noodle firmness", stages: ["preference"] },
    { term: "かため / 普通 / やわらかめ", reading: "katame / futsū / yawarakame", meaning: "firm / regular / soft", stages: ["preference"] },
    { term: "餃子", reading: "gyōza", meaning: "pan-fried dumplings", stages: ["extras"] },
    { term: "かしこまりました", reading: "kashikomarimashita", meaning: "Certainly (formal)", stages: ["confirm"] },
    { term: "少々お待ちください", reading: "shōshō omachi kudasai", meaning: "Please wait a moment", stages: ["confirm"] },
    { term: "お会計", reading: "okaikei", meaning: "the check / bill", stages: ["payment", "pay"] },
    { term: "現金のみ", reading: "genkin nomi", meaning: "cash only", stages: ["payment", "pay"] },
    { term: "お釣り", reading: "otsuri", meaning: "change (money)", stages: ["pay"] },
    { term: "ごちそうさまでした", reading: "gochisōsama deshita", meaning: "Thank you for the meal", stages: ["payment", "farewell"] },
    { term: "またお越しください", reading: "mata okoshi kudasai", meaning: "Please come again", stages: ["farewell"] },
  ],
  eventLines: {
    order_placed: (s) => ({
      voice: "chef",
      text: `はいよっ！${dishJa(s.slots.heard_dish || s.slots.dish).replace("ラーメン", "")}一丁！`,
      meaning: `Coming up! One ${dishEn(s.slots.heard_dish || s.slots.dish)}!`,
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
          intent: "Tell Hiroshi how many people are in your group — just you.",
          vocab: [
            { term: "一人", reading: "hitori", meaning: "one person" },
            { term: "です", reading: "desu", meaning: "is / am (polite)" },
          ],
          starter: "一人…",
          full: "一人です。",
          fullReading: "Hitori desu.",
          fullMeaning: "Just one (person).",
        }, ["一人", "ひとり", "1人"]),
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
        }, ["カウンター", "席", "いいですか"]),
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
      ],
      resolve: ({ report }) => {
        if (report.intent === "party_size")
          return advance(
            "order",
            "Say 'this way, please' (こちらへどうぞ), seat them at the counter, put a menu in front of them, and ask what they'd like to order.",
            "Right this way — here's the menu. What would you like to order?",
            { setSlots: { party: "1" } },
          );
        if (report.intent === "ask_seat")
          return advance(
            "order",
            "Say yes, the counter is free, invite them to sit, and ask what they'd like to order.",
            "Sure, the counter's free — have a seat. What would you like?",
          );
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
        const first = state.flags.soldOutHit
          ? orderDishCard(special, `Order the ${dishEn(special).split(" (")[0]} he suggested`, "order_suggested")
          : orderDishCard("shoyu");
        const second = state.flags.recommended && !state.flags.soldOutHit
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
            }, [DISHES[special].ja, "にします", "じゃあ"], { key: "order_recommended", expect: { dish: special } })
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
            }, ["おすすめ", "何"]);
        return [
          first,
          second,
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
        ];
      },
      resolve: ({ report, slot, variant, state }) => {
        const side = slot("side");
        const drink = slot("drink");
        const extras: Record<string, string> = {};
        if (side) extras.side = side;
        if (drink) extras.drink = drink;
        if (report.intent === "order_dish") {
          const dish = slot("dish");
          if (!dish)
            return {
              ...stay("info", "order", "They want to order but didn't say which ramen. Ask which one they'd like.", "Which ramen would you like?"),
              kind: "clarify",
              success: false,
              reaction: "confused",
              note: "Name the dish you want.",
            };
          if (dish === variant.soldOut)
            return stay(
              "branch",
              "order",
              `Apologize: ${dishJa(dish)} is sold out today (本日売り切れです). Suggest ${dishJa(String(variant.special))}, today's recommendation, or another ramen, and ask what they'd like instead.`,
              `Sorry, the ${dishEn(dish)} is sold out today. How about the ${dishEn(String(variant.special))}?`,
              {
                setFlags: { soldOutHit: true },
                setSlots: extras,
                note: "That dish was sold out (the 売切 tag on the menu) — you handled an unavailable item.",
              },
            );
          return advance(
            "preference",
            `Acknowledge the order of ${dishJa(dish)} briefly (e.g. "${dishJa(dish)}ですね"), then ask how firm they'd like the noodles: regular (普通), firm (かため), or soft (やわらかめ).`,
            `One ${dishEn(dish)}, got it. How would you like your noodles — regular, firm, or soft?`,
            { setSlots: { dish, ...extras } },
          );
        }
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "order",
            `Recommend today's special, ${dishJa(String(variant.special))}, in one enthusiastic sentence (say why it's good), then ask what they'd like.`,
            `I recommend the ${dishEn(String(variant.special))} — it's really good today! What would you like?`,
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_time")
          return stay(
            "info",
            "order",
            'Say warmly "of course, take your time" (はい、ごゆっくりどうぞ) — one short phrase only — then wait silently.',
            "Of course — take your time.",
            { setFlags: { askedTime: true } },
          );
        if (report.intent === "ask_price")
          return stay("info", "order", "Tell them the price they asked about (use the menu), then ask what they'd like.", "Here's the price… What would you like?");
        if (report.intent === "order_side" || report.intent === "order_drink")
          return stay(
            "info",
            "order",
            `Note the ${side ? "side" : "drink"} they ordered, then ask which ramen they'd like.`,
            "Got it. And which ramen would you like?",
            { setSlots: extras },
          );
        void state;
        return null;
      },
    },
    {
      id: "preference",
      group: "Noodles",
      npcGoal: "Ask how firm they want their noodles: regular (普通), firm (かため) or soft (やわらかめ).",
      meaning: "How would you like your noodles — regular, firm, or soft?",
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
        }, ["かため", "硬め", "固め"], { key: "firm", expect: { firmness: "firm" } }),
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
        }, ["普通", "ふつう", "大丈夫"], { key: "regular", expect: { firmness: "normal" } }),
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
      ],
      resolve: ({ report, slot, state, variant, difficulty }) => {
        if (report.intent === "set_firmness") {
          const firmness = slot("firmness") || "normal";
          if (difficulty === "beginner") return toConfirm(state, variant, { firmness });
          return advance(
            "extras",
            `Acknowledge (${FIRMNESS[firmness].ja}). Then, as a follow-up, offer to make it a set with gyoza for +300 yen and ask if they'd like that.`,
            "Got it. Would you like to make it a set with gyoza? It's 300 yen more.",
            { setSlots: { firmness } },
          );
        }
        if (report.intent === "ask_options")
          return stay(
            "info",
            "preference",
            "Explain the three options simply in Japanese only: やわらかめ (soft), 普通 (regular), かため (firm). Then ask which they'd like.",
            "We have soft, regular, or firm. Which would you like?",
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
      cards: () => [
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
        }, ["餃子", "ぎょうざ", "セット", "はい"], { expect: { side: "gyoza" } }),
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
        }, ["大丈夫", "結構", "いいえ"]),
        card("ask_price", "💴", "Ask how much it is", {
          intent: "Ask about the price of the set.",
          vocab: [{ term: "いくら", reading: "ikura", meaning: "how much" }],
          starter: "いくら…",
          full: "いくらですか？",
          fullReading: "Ikura desu ka?",
          fullMeaning: "How much is it?",
        }, ["いくら"]),
      ],
      resolve: ({ report, state, variant, slot }) => {
        if (report.intent === "order_side") return toConfirm(state, variant, { side: slot("side") || "gyoza" });
        if (report.intent === "decline") return toConfirm(state, variant, {});
        if (report.intent === "ask_price")
          return stay("info", "extras", "Say it's 300 yen extra for five gyoza, and ask if they'd like it.", "It's 300 yen extra for five gyoza. Would you like it?");
        return null;
      },
    },
    {
      id: "confirm",
      group: "Confirm",
      npcGoal: "Read the order back and ask the customer to confirm it.",
      meaning: "Let me confirm your order — is that right?",
      situation: "Hiroshi is reading your order back. Listen carefully: is it what you ordered?",
      cards: ({ state }) => {
        const dish = (state.slots.dish || "shoyu") as Dish;
        return [
          card("confirm", "✅", "Confirm the order", {
            intent: "Tell him yes, that's correct — but only if it really IS what you ordered!",
            vocab: [
              { term: "はい", reading: "hai", meaning: "yes" },
              { term: "そうです", reading: "sō desu", meaning: "that's right" },
            ],
            starter: "はい、…",
            full: "はい、そうです。",
            fullReading: "Hai, sō desu.",
            fullMeaning: "Yes, that's right.",
          }, ["はい", "そうです", "お願いします"]),
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
          }, ["違います", "ちがいます", "じゃなくて", "すみません"], { expect: { dish } }),
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
        ];
      },
      extraIntents: ["order_side"],
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
                note: `Hiroshi read back ${dishJa(wrong)} (${dishEn(wrong)}) — not what you ordered! Listen closely when an order is repeated back.`,
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
              `Oh, my apologies — ${dishEn(wanted)}. Coming right up!`,
              {
                events: [...placed],
                setSlots: { dish: wanted, served: wanted },
                setFlags: { corrected: true, misheard: false },
                note: "You caught the waiter's mistake and corrected it — great listening!",
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
          return stay("info", "confirm", "Politely say that's what you have, read the order back once more, and ask if it's OK.", "That's what I have — is that OK?");
        }
        if (report.intent === "order_drink" || report.intent === "order_side") {
          const extra: Record<string, string> = {};
          if (report.intent === "order_drink") extra.drink = slot("drink") || "oolong";
          else extra.side = slot("side") || "gyoza";
          const merged = { ...state.slots, ...extra };
          const summary = orderSummary(merged, state.slots.heard_dish);
          return stay(
            "info",
            "confirm",
            `Add it, then read the full order back again — ${summary.ja} — and ask to confirm.`,
            `Sure. So that's ${summary.en} — right?`,
            { setSlots: extra },
          );
        }
        return null;
      },
    },
    {
      id: "payment",
      group: "Payment",
      learnerOpens: "You've finished eating. Walk up to the register — you speak first.",
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
        }, ["お会計", "会計", "すみません"]),
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
        }, ["ごちそうさま", "美味しかった", "おいしかった"]),
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
        }, ["カード", "使えます"]),
      ],
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
              note: "Many small ramen shops are cash only — you found out by asking.",
            };
          return advance("pay", `Say yes, cards are fine, and tell them the total: ${t}円.`, `Yes, cards are fine. That'll be ${t} yen.`, { events: ["bill_shown"] });
        }
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
        }, ["現金", "げんきん", "はい"], { key: "pay_cash", expect: { payment_method: "cash" } }),
        state.flags.cardRefused
          ? card("pay", "👛", "Say you'll pay cash then", {
              intent: "Accept that it's cash only and say you'll pay in cash.",
              vocab: [
                { term: "じゃあ", reading: "jā", meaning: "well then" },
                { term: "払います", reading: "haraimasu", meaning: "(I will) pay" },
              ],
              starter: "じゃあ、現金…",
              full: "じゃあ、現金で払います。",
              fullReading: "Jā, genkin de haraimasu.",
              fullMeaning: "Then I'll pay in cash.",
            }, ["現金", "払います", "じゃあ"], { key: "pay_cash_then", expect: { payment_method: "cash" } })
          : card("pay", "💳", "Pay by card", {
              intent: "Say you'd like to pay by card.",
              vocab: [{ term: "カード", reading: "kādo", meaning: "card" }],
              starter: "カードで…",
              full: "カードでお願いします。",
              fullReading: "Kādo de onegaishimasu.",
              fullMeaning: "By card, please.",
            }, ["カード"], { key: "pay_card", expect: { payment_method: "card" } }),
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
      ],
      extraIntents: ["ask_card"],
      resolve: ({ report, slot, variant, state }) => {
        const t = total(state.slots);
        if (report.intent === "pay") {
          const method = slot("payment_method") || "cash";
          if (method === "card" && variant.cashOnly)
            return stay(
              "branch",
              "pay",
              "Apologize: this shop only takes cash (現金のみです). Ask if they have cash.",
              "Sorry, we only take cash. Do you have cash?",
              { setFlags: { cardRefused: true }, note: "Cash only! You needed a recovery path." },
            );
          return advance(
            "farewell",
            method === "card"
              ? "Process the card, hand back the card and receipt, and thank them warmly (ありがとうございました)."
              : `Take the cash (e.g. "2000円お預かりします"), give the change for a ${t}円 total, hand them the receipt, and thank them warmly (ありがとうございました).`,
            method === "card" ? "Thank you very much! Here's your receipt." : "Out of ¥2,000… here's your change. Thank you very much!",
            { objectiveComplete: true, events: ["payment_done"], setSlots: { paid: method } },
          );
        }
        if (report.intent === "ask_receipt")
          return stay("info", "pay", `Say of course, you'll give them a receipt, and remind them the total is ${t}円.`, `Of course. The total is ${t} yen.`, { setFlags: { receipt: true } });
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
        }, ["ごちそうさま", "ありがとう"]),
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
        }, ["また", "来ます"]),
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
        }, ["最高", "美味しかった", "おいしかった"]),
      ],
      resolve: ({ report }) => {
        if (["thanks", "goodbye", "come_again", "compliment", "greet"].includes(report.intent))
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
