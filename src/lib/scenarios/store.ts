import { advance, complete, stay } from "@/lib/engine/engine";
import { containsTerm } from "@/lib/evaluation/text";
import { card } from "./helpers";
import type { IntentCard, Outcome, ResolveContext, ScenarioDef } from "./types";

const COLORS: Record<string, string> = {
  navy: "navy blue",
  charcoal: "charcoal grey",
  burgundy: "burgundy",
  camel: "camel",
};
const colorName = (c: string) => COLORS[c] ?? c;

function total(slots: Record<string, string>) {
  const base = 39.99 * (slots.storeCard === "yes" ? 0.8 : 1);
  return `$${(Math.round(base * 1.08875 * 100) / 100).toFixed(2)}`;
}

/** The scarf is picked out and presented — the learner decides next. */
function showItem(color: string, extra: string, meaning: string, more: Partial<Outcome> = {}): Outcome {
  return advance(
    "decide",
    `${extra} Present the ${colorName(color)} merino wool scarf: say it's really soft and warm, it's $39.99, and ask what they think.`,
    meaning,
    { events: ["item_shown"], setSlots: { color, fulfilment: "in_store" }, ...more },
  );
}

/**
 * The learner describes what they want — possibly everything at once in their
 * first reply ("I'm looking for a navy wool scarf for my sister").
 */
function describeOutcome({ slot, variant }: ResolveContext, from: "greeting" | "details"): Outcome {
  const color = slot("color");
  const set: Record<string, string> = { item: "scarf" };
  for (const k of ["material", "recipient"]) if (slot(k)) set[k] = slot(k);
  const reaction = `${set.recipient === "gift" ? " (a birthday gift — how nice!)" : ""}${set.material ? " (our merino wool ones are lovely and warm)" : ""}`;
  if (!color) {
    if (from === "greeting")
      return advance(
        "details",
        `Say great — you have a lovely selection of scarves right here. Respond to any detail they gave${reaction}, then ask what color they'd like.`,
        "Great, we have lots of scarves here. What color would you like?",
        { setSlots: set },
      );
    return stay("info", "details", `Respond warmly to what they said${reaction}, then ask what color they'd like.`, "Nice! What color would you like?", {
      setSlots: set,
      reaction: "positive",
    });
  }
  if (color === "navy" && variant.navyOut)
    return advance(
      "availability",
      "Check the shelf, then apologize: navy is sold out on the floor right now. Offer options: another color (charcoal, burgundy or camel), checking the stockroom, or ordering online.",
      "Oh, sorry — we're out of navy out here. I could check the back, or we have other colors.",
      { setSlots: { ...set, color }, reaction: "neutral", note: "Navy was sold out — you had to deal with an unavailable item." },
    );
  return showItem(color, "Say “great choice”.", `Here it is — a ${colorName(color)} merino wool scarf. It's $39.99. What do you think?`, {
    setSlots: { ...set, color, fulfilment: "in_store" },
  });
}

const COLOR_WORDS: Record<string, string[]> = {
  navy: ["navy"],
  charcoal: ["charcoal", "grey", "gray"],
  burgundy: ["burgundy"],
  camel: ["camel", "beige", "tan"],
};

/**
 * A color the learner actually named in THIS utterance and that differs from the one on record.
 * (The agent tends to repeat earlier slot values, so the words themselves must mention it.)
 */
function newColorSaid({ report, slot, state }: ResolveContext) {
  const color = slot("color");
  if (!color || color === state.slots.color) return "";
  return (COLOR_WORDS[color] ?? [color]).some((w) => containsTerm(report.heard, w, "en")) ? color : "";
}

/** "Do you have them in navy?" / "Can I see the charcoal one?" labeled as a colors question = choosing that color. */
function namesNewColor(ctx: ResolveContext) {
  return ctx.report.intent === "ask_alternatives" && !!newColorSaid(ctx);
}

const navyCard: IntentCard = card("describe_item", "🔵", "Say you want a navy blue one", {
  intent: "Say which color you want: navy blue.",
  vocab: [
    { term: "navy (blue)", meaning: "a very dark blue" },
    { term: "I'd like…", meaning: "a polite way to say “I want…”" },
  ],
  starter: "I'd like a navy…",
  full: "I'd like a navy blue one, please.",
  fullMeaning: "“One” replaces “scarf” so you don't repeat the word.",
}, ["navy", "blue", "I'd like"], { key: "navy", expect: { color: "navy" }, core: true });

export const store: ScenarioDef = {
  id: "store",
  language: "en",
  languageName: "English",
  languageEnglish: "English",
  flag: "🇺🇸",
  city: "New York",
  locationLabel: "NEW YORK · FIFTH AVENUE",
  title: "Department Store",
  venueName: "Whitmore's · Accessories",
  objective: "Find a navy wool scarf for your sister's birthday, sort out any problems, and buy it.",
  goal: "Buy a navy wool scarf for your sister",
  demoRole: "hero",
  blurb: "A grand old department store on Fifth Avenue on a busy Saturday. You need a birthday present, and Jordan, a sales associate, is on the Accessories floor.",
  npc: {
    name: "Jordan",
    role: "Sales associate",
    voiceKey: "jordan",
    look: {
      skin: "#8d5a3b",
      skinShade: "#74472d",
      hair: "#1c1410",
      hairStyle: "curly",
      outfit: "#1f5f5b",
      outfitShade: "#174844",
      accent: "#f2b84b",
      accessory: "lanyard",
      eyes: "#1c120c",
    },
  },
  backgroundVoices: { announcer: { voiceKey: "announcer", name: "Store announcement" } },
  art: "store",
  ambienceAsset: "store-ambience",
  sfx: {
    enter: "store-doors",
    time_skip: "store-pa-chime",
    item_shown: "store-paper",
    gift_wrapped: "store-wrap",
    payment_done: "store-beep",
  },
  briefing: {
    title: "Your notes",
    lines: [
      "Looking for: a navy wool scarf",
      "It's a birthday present for your sister",
      "You have a credit card, your phone, and $60 cash",
    ],
  },
  initialStage: "greeting",
  randomizeCards: true,
  requiredSlots: ["color", "paid"],
  intents: {
    looking_for: "Says what they are looking for (fill `item`)",
    just_browsing: "Says they're just browsing / looking around",
    ask_location: "Asks where something is or which way to go (a department, the exit, the restroom…)",
    describe_item: "Describes what they want (fill `color`, `material`, `recipient`)",
    ask_recommendation: "Asks what you recommend",
    ask_check_stock: "Asks you to check the stockroom / the back for more",
    ask_alternatives: "Asks what other colors or options there are",
    ask_order: "Asks if they can order it online / have it delivered",
    ask_found: "Asks whether you found it / how it went in the stockroom",
    take_it: "Says they'll take / buy it",
    ask_price: "Asks how much it costs",
    ask_discount: "Asks about discounts or sales",
    ask_returns: "Asks about returns or exchanges",
    accept_offer: "Accepts the store card offer",
    ask_offer_details: "Asks what the store card / offer is",
    gift_wrap: "Asks for / accepts gift wrapping",
    ask_gift_receipt: "Asks for a gift receipt",
    decline: "Politely says no to an offer",
    pay: "Pays / says how they will pay (fill `payment_method`)",
    compliment: "Compliments you or says you were helpful",
    ask_gift_ideas: "Asks for help finding a present / gift ideas, without naming an item",
    ask_restock: "Asks when you'll get more of something in stock",
    apologize: "Apologizes (sorry for the trouble / for bothering you)",
    ask_material: "Asks what the item is made of or how to wash / care for it",
    ask_delivery: "Asks when an online order would arrive",
    ask_card_fee: "Asks whether the store card has an annual fee",
    ask_savings: "Asks how much the store card discount would save them",
    remove_tag: "Asks you to take the price tag off",
    come_again: "Says they'll come back / see you again",
  },
  slots: {
    item: { description: "Item the customer is looking for", values: ["scarf", "gloves", "hat", "other"] },
    color: { description: "Color the customer asks for", values: Object.keys(COLORS) },
    material: { description: "Material the customer asks for", values: ["wool", "cashmere"] },
    recipient: { description: "Who it's for", values: ["gift", "self"] },
    payment_method: { description: "How they pay", values: ["card", "mobile", "cash"] },
  },
  greetings: {
    beginner: [
      { text: "Hi there! Welcome to Whitmore's. Can I help you find anything?", meaning: "Hello! Do you need help finding something?" },
      { text: "Hello! Are you looking for something today?", meaning: "Hello! Are you trying to find something?" },
    ],
    intermediate: [
      { text: "Hi! Welcome to Whitmore's — is there anything I can help you find today?", meaning: "Hello! Can I help you find something?" },
      { text: "Hey there, how's it going? Looking for anything in particular?", meaning: "Hello, how are you? Are you looking for something specific?" },
    ],
    immersion: [
      { text: "Hey! How's your day going? Anything I can help you track down?", meaning: "Hello! How are you? Can I help you find something?" },
      { text: "Hi there — finding everything okay? Lemme know if you need a hand.", meaning: "Hello — are you finding what you need? Tell me if you need help." },
    ],
  },
  makeVariant: (difficulty, rand) => ({
    navyOut: rand() < (difficulty === "beginner" ? 0.35 : 0.6),
    stockroomHasIt: rand() < 0.5,
    storeCard: difficulty !== "beginner",
    tapDown: rand() < (difficulty === "beginner" ? 0.2 : 0.4),
  }),
  persona:
    "You are Jordan, 28, a friendly, upbeat sales associate in the Accessories department of Whitmore's, a classic department store on Fifth Avenue in New York City. It's a busy Saturday afternoon. You're warm, helpful and chatty in a natural American way, and genuinely want to find the customer the right thing.",
  facts: (v) =>
    [
      `SCARVES: merino wool scarves $39.99 in navy blue${v.navyOut ? " (SOLD OUT on the shop floor today)" : ""}, charcoal grey, burgundy and camel. Cashmere scarves $120 in grey and cream.`,
      `STOCKROOM: ${v.stockroomHasIt ? "has exactly one navy merino scarf left" : "has no navy merino scarves"} — you only find out if you go and check.`,
      "Online orders: delivery in 3–5 business days, free shipping, same price. Returns: 30 days with a receipt; gift receipts available. Gift wrapping is free.",
      "Sales tax is 8.875%.",
      v.storeCard
        ? "Store card: signing up today gives 20% off this purchase (so $31.99 instead of $39.99), no annual fee — only bring it up when the engine tells you to."
        : "No discounts on scarves right now.",
      "The merino scarves are 100% merino wool: hand-wash cold or dry-clean, not machine-washable.",
      v.tapDown ? "PAYMENT: tap-to-pay / phone payments are NOT working today; inserted cards and cash are fine." : "Payment: cards, phone/tap payments and cash are all accepted.",
    ].join("\n"),
  asrKeywords: ["scarf", "navy", "merino", "wool", "cashmere", "stockroom", "gift-wrap", "gift receipt", "store card", "Whitmore's"],
  vocabulary: [
    { term: "Can I help you find anything?", meaning: "What sales staff say when they offer help", stages: ["greeting"] },
    { term: "I'm looking for…", meaning: "The standard way to say what you want to find", stages: ["greeting"] },
    { term: "I'm just browsing", meaning: "I'm only looking — I don't need help yet", stages: ["greeting"] },
    { term: "Do you have this in navy?", meaning: "Asking for the same item in another color", stages: ["details", "availability"] },
    { term: "sold out / out of stock", meaning: "There are none left", stages: ["availability"] },
    { term: "in the back / the stockroom", meaning: "The storage room where extra items are kept", stages: ["availability", "stock_wait"] },
    { term: "Any luck?", meaning: "Casual way to ask “did it work / did you find it?”", stages: ["stock_wait"] },
    { term: "I'll take it", meaning: "I want to buy it", stages: ["decide"] },
    { term: "return policy / exchange", meaning: "The rules for bringing an item back", stages: ["decide"] },
    { term: "store card", meaning: "A credit card for one store, often with discounts", stages: ["offer"] },
    { term: "Would you like it gift-wrapped?", meaning: "Do you want it wrapped in gift paper?", stages: ["checkout"] },
    { term: "gift receipt", meaning: "A receipt without the price, so the person can exchange the gift", stages: ["checkout"] },
    { term: "I'll ring you up", meaning: "I'll process your payment", stages: ["checkout", "pay"] },
    { term: "tap or insert your card", meaning: "Two ways to pay with a card", stages: ["pay"] },
    { term: "Have a good one!", meaning: "A casual American way to say “have a nice day”", stages: ["farewell"] },
    { term: "What colors does it come in?", meaning: "Asking which colors are available", stages: ["details"] },
    { term: "Sorry for all the trouble", meaning: "Polite apology for making work for someone", stages: ["stock_wait"] },
    { term: "machine-washable", meaning: "Safe to wash in a washing machine", stages: ["decide"] },
    { term: "annual fee", meaning: "Money you pay every year to have a card", stages: ["offer"] },
    { term: "price tag", meaning: "The label that shows the price", stages: ["checkout"] },
    { term: "Does that include tax?", meaning: "In the US, prices usually don't include sales tax", stages: ["pay"] },
  ],
  eventLines: {
    time_skip: () => ({
      voice: "announcer",
      text: "Attention Whitmore's shoppers: our fall sale continues on the third floor, with up to forty percent off outerwear. Thank you for shopping with us!",
      meaning: "Store announcement: there's a sale on the third floor.",
    }),
  },
  timeSkipText: "A few minutes later… Jordan hurries back from the stockroom.",
  successTitle: "Have a great day!",
  stages: [
    {
      id: "greeting",
      group: "Greeting",
      npcGoal: "Greet the customer and ask if you can help them find anything.",
      meaning: "Hello! Can I help you find something?",
      situation: "Jordan, a sales associate, is offering to help you.",
      extraIntents: ["ask_location", "describe_item"],
      aliases: { ask_recommendation: "ask_gift_ideas", ask_alternatives: "looking_for", no: "just_browsing" },
      cards: () => [
        card("looking_for", "🧣", "Say you're looking for a scarf", {
          intent: "Accept the help and say you're looking for a scarf.",
          vocab: [
            { term: "I'm looking for…", meaning: "the standard way to say what you want to find" },
            { term: "a scarf", meaning: "long piece of cloth worn around the neck" },
          ],
          starter: "Yes, I'm looking for…",
          full: "Yes, please. I'm looking for a scarf.",
          fullMeaning: "Short and polite — start with “Yes, please” to accept the offer of help.",
        }, ["looking for", "scarf", "please"], { expect: { item: "scarf" }, core: true }),
        card("just_browsing", "👀", "Say you're just looking around", {
          intent: "Tell Jordan you don't need help yet — you're only looking.",
          vocab: [
            { term: "just browsing", meaning: "only looking, not buying yet" },
            { term: "thanks", meaning: "short for “thank you”" },
          ],
          starter: "I'm just…",
          full: "I'm just browsing, thanks.",
          fullMeaning: "A very common, polite way to say “no help needed right now”.",
        }, ["browsing", "looking", "thanks"]),
        card("ask_location", "🗺️", "Ask where the scarves are", {
          intent: "Ask where you can find scarves in the store.",
          vocab: [
            { term: "Excuse me", meaning: "polite way to get someone's attention" },
            { term: "Where can I find…?", meaning: "asking for the location of something" },
          ],
          starter: "Excuse me, where can I…",
          full: "Excuse me, where can I find scarves?",
          fullMeaning: "“Where can I find…?” works for anything in a store.",
        }, ["where", "find", "scarves"], { core: true }),
        card("ask_gift_ideas", "🎂", "Ask for help finding a birthday gift", {
          intent: "Accept the help and say you need a birthday present for your sister.",
          vocab: [
            { term: "I need…", meaning: "I have to get…" },
            { term: "a birthday present", meaning: "a gift for someone's birthday" },
          ],
          starter: "Yes, I need a birthday…",
          full: "Yes, I need a birthday present for my sister.",
          fullMeaning: "“Present” and “gift” mean the same thing.",
        }, ["present", "gift", "sister", "birthday"], { key: "gift_help", core: true }),
        card("looking_for", "🐑", "Ask if they have wool scarves", {
          intent: "Ask whether the store sells wool scarves.",
          vocab: [
            { term: "Do you have any…?", meaning: "asking if something is available" },
            { term: "wool", meaning: "warm material from sheep" },
          ],
          starter: "Do you have any…",
          full: "Hi! Do you have any wool scarves?",
          fullMeaning: "“Any” is normal in questions about what a store sells.",
        }, ["wool", "scarves", "do you have"], { key: "wool_q", expect: { item: "scarf", material: "wool" }, core: true }),
        card("greet", "☕", "Say hi and ask how their day is going", {
          intent: "Greet Jordan back and ask how they're doing, before getting down to business.",
          vocab: [
            { term: "How's it going?", meaning: "casual “how are you?”" },
            { term: "Busy day?", meaning: "short question: is it busy today?" },
          ],
          starter: "Hi! How's it…",
          full: "Hi! How's it going? Busy day?",
          fullMeaning: "Americans often make a little small talk before asking for help.",
        }, ["hi", "how's it going", "busy"], { key: "small_talk" }),
      ],
      resolve: (ctx) => {
        const { report, slot } = ctx;
        // "I need a present for my sister" (no item named): Jordan suggests scarves.
        const giftOnly =
          (report.intent === "looking_for" || report.intent === "describe_item") && slot("recipient") && !slot("item") && !slot("color") && !slot("material");
        if (report.intent === "ask_gift_ideas" || giftOnly)
          return advance(
            "details",
            "Say you'd love to help — scarves are a really popular birthday gift right now, and you have lovely ones right here. Ask what color their sister likes.",
            "I'd love to help! Scarves make a great gift. What color does she like?",
            { setSlots: { item: "scarf", recipient: "gift" } },
          );
        // A full description in the first reply jumps straight ahead.
        if (report.intent === "describe_item" || (report.intent === "looking_for" && (slot("color") || slot("material") || slot("recipient"))))
          return describeOutcome(ctx, "greeting");
        if (report.intent === "greet")
          return stay(
            "info",
            "greeting",
            "Answer their small talk briefly and cheerfully (busy Saturday, but you're doing great — thanks for asking!), then ask again if you can help them find anything.",
            "I'm good, thanks — busy Saturday! Can I help you find anything?",
          );
        // "Yes, please!" to "Can I help you find anything?" — they haven't said what yet.
        if (report.intent === "yes" && !slot("item"))
          return stay("info", "greeting", "Say great, you'd be happy to help, and ask what they're looking for today.", "Great! What are you looking for today?", {
            reaction: "positive",
          });
        if (report.intent === "yes") return describeOutcome(ctx, "greeting");
        if (report.intent === "looking_for")
          return advance(
            "details",
            "Say great — you have a lovely selection of scarves right here — and ask what kind they're looking for (a color in mind? for themselves or a gift?).",
            "Great, we have lots of scarves here. What kind do you want? Any color?",
            { setSlots: { item: "scarf" } },
          );
        if (report.intent === "ask_location")
          return advance(
            "details",
            "Say scarves are right here in Accessories — gesture to the shelves behind you — and ask what kind they're looking for.",
            "They're right here! What kind of scarf are you looking for?",
            { setSlots: { item: "scarf" } },
          );
        if (report.intent === "just_browsing")
          return stay(
            "info",
            "greeting",
            "Say no problem at all, take your time, and you'll be right here if they need anything. One short, friendly sentence.",
            "No problem — take your time. I'm here if you need me.",
            { setFlags: { browsing: true }, reaction: "positive" },
          );
        return null;
      },
    },
    {
      id: "details",
      group: "Describe",
      npcGoal: "Ask what kind of scarf they want — color, material, who it's for.",
      meaning: "What kind of scarf do you want? Any color in mind?",
      situation: "Jordan wants to know what kind of scarf you're looking for.",
      extraIntents: ["ask_recommendation", "ask_price", "ask_alternatives"],
      // Naming a color is choosing it, whatever the label ("I'll take navy", "yes, the navy", "do you have navy?").
      aliases: { take_it: "describe_item", yes: "describe_item", accept_offer: "describe_item", ask_check_stock: "describe_item", ask_order: "describe_item" },
      cards: ({ state }) => {
        const cards: IntentCard[] = [
          navyCard,
          card("describe_item", "🔷", "Ask if they have it in navy", {
            intent: "Ask whether they have the scarves in navy blue.",
            vocab: [
              { term: "Do you have them in…?", meaning: "asking for a specific color" },
              { term: "navy (blue)", meaning: "a very dark blue" },
            ],
            starter: "Do you have them in…",
            full: "Do you have them in navy blue?",
            fullMeaning: "“Them” refers to the scarves Jordan just mentioned.",
          }, ["navy", "blue", "do you have"], { key: "navy_q", expect: { color: "navy" }, core: true }),
          card("ask_price", "💲", "Ask how much the scarves are", {
            intent: "Ask about the price of the scarves.",
            vocab: [{ term: "How much are…?", meaning: "asking the price of several things" }],
            starter: "How much are…",
            full: "How much are the scarves?",
            fullMeaning: "Plural: “How much ARE the scarves?” Singular: “How much IS this scarf?”",
          }, ["how much", "price", "cost"], { key: "price" }),
          card("ask_alternatives", "🎨", "Ask what colors they come in", {
            intent: "Ask which colors the scarves come in.",
            vocab: [{ term: "come in", meaning: "are available in (colors, sizes)" }],
            starter: "What colors do they…",
            full: "What colors do they come in?",
            fullMeaning: "“Come in” is how English talks about available colors and sizes.",
          }, ["colors", "colours", "come in"], { key: "colors" }),
        ];
        if (!state.slots.material)
          cards.push(
            card("describe_item", "🧶", "Say you want a warm wool scarf", {
              intent: "Say you'd like something warm, made of wool.",
              vocab: [
                { term: "wool", meaning: "warm material from sheep" },
                { term: "if possible", meaning: "softens a request — “only if you can”" },
              ],
              starter: "Something warm…",
              full: "Something warm — wool, if possible.",
              fullMeaning: "Natural speech often skips “I want”: just name what you're after.",
            }, ["wool", "warm"], { key: "wool", expect: { material: "wool" } }),
          );
        if (!state.slots.recipient)
          cards.push(
            card("describe_item", "🎁", "Explain it's a birthday gift for your sister", {
              intent: "Explain that the scarf is a birthday present for your sister.",
              vocab: [
                { term: "a birthday present", meaning: "a gift for someone's birthday" },
                { term: "for my sister", meaning: "says who will receive it" },
              ],
              starter: "It's a birthday…",
              full: "It's a birthday present for my sister.",
              fullMeaning: "“Present” and “gift” mean the same thing.",
            }, ["present", "gift", "sister", "birthday"], { key: "gift", expect: { recipient: "gift" } }),
          );
        cards.push(
          card("ask_recommendation", "💡", "Ask what they recommend", {
            intent: "Ask Jordan for a recommendation.",
            vocab: [{ term: "What would you recommend?", meaning: "asking for advice on what to choose" }],
            starter: "What would you…",
            full: "What would you recommend?",
            fullMeaning: "“Would” makes the question softer and more polite.",
          }, ["recommend", "suggest"]),
        );
        return cards;
      },
      resolve: (ctx) => {
        const { report, variant } = ctx;
        if (report.intent === "describe_item" || report.intent === "looking_for" || namesNewColor(ctx)) return describeOutcome(ctx, "details");
        if (report.intent === "ask_alternatives")
          return stay(
            "info",
            "details",
            variant.navyOut
              ? "List the colors: charcoal grey, burgundy and camel — and navy blue too, though you're not sure there are any navy ones left on the shelf. All merino wool, $39.99. Ask which color they'd like."
              : "List the colors: navy blue, charcoal grey, burgundy and camel — all merino wool, $39.99. Ask which color they'd like.",
            "We have navy, charcoal, burgundy and camel — $39.99 each. Which color would you like?",
            { setFlags: { askedColors: true } },
          );
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "details",
            "Recommend the merino wool scarves — soft, warm, a great gift — in navy, charcoal, burgundy or camel. Ask which color they'd like.",
            "I recommend our merino wool scarves — soft and warm. Which color would you like?",
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_price")
          return stay("info", "details", "Say the merino wool scarves are $39.99 and cashmere is $120. Ask what color they'd like.", "Merino wool is $39.99, cashmere is $120. Which color?");
        return null;
      },
    },
    {
      id: "availability",
      group: "Find it",
      npcGoal: "Offer alternatives for the sold-out navy scarf: another color, checking the stockroom, or ordering online.",
      meaning: "Sorry, navy is sold out here. I can check the back, or we have other colors.",
      situation: "Navy is sold out on the shop floor. Decide what to do.",
      cards: ({ state }) => [
        state.flags.stockChecked
          ? card("ask_order", "🚚", "Ask if you can order navy online", {
              intent: "Ask if you can order the navy scarf online and have it delivered.",
              vocab: [
                { term: "order it online", meaning: "buy it on the website" },
                { term: "delivered", meaning: "brought to your home" },
              ],
              starter: "Could I order…",
              full: "Could I order a navy one online instead?",
              fullMeaning: "“Instead” means “as the other option”.",
            }, ["order", "online", "deliver"], { core: true })
          : card("ask_check_stock", "📦", "Ask them to check the stockroom", {
              intent: "Ask Jordan to check if there are more in the stockroom.",
              vocab: [
                { term: "in the back", meaning: "in the storage room (very common in stores)" },
                { term: "Could you check…?", meaning: "polite request" },
              ],
              starter: "Could you check if…",
              full: "Could you check if you have any in the back?",
              fullMeaning: "“Any” is used in questions: “do you have any?”",
            }, ["check", "back", "stockroom", "any"], { core: true }),
        state.flags.askedColors
          ? card("describe_item", "🎨", "Take the charcoal one instead", {
              intent: "Choose the charcoal grey scarf instead of navy.",
              vocab: [
                { term: "I'll take…", meaning: "I'll buy…" },
                { term: "then", meaning: "“in that case”" },
              ],
              starter: "I'll take the…",
              full: "I'll take the charcoal one, then.",
              fullMeaning: "“Then” at the end means “since navy isn't available”.",
            }, ["charcoal", "take"], { key: "charcoal", expect: { color: "charcoal" }, core: true })
          : card("ask_alternatives", "🎨", "Ask what other colors they have", {
              intent: "Ask what other colors are available.",
              vocab: [{ term: "What other colors…?", meaning: "asking for the other options" }],
              starter: "What other colors…",
              full: "What other colors do you have?",
              fullMeaning: "Simple and natural.",
            }, ["other", "colors", "colour"]),
        // "Again" only once the colors have actually been listed; before that, the card above asks.
        ...(state.flags.stockChecked
          ? state.flags.askedColors
            ? [
                card("ask_alternatives", "🧣", "Ask to see the other colors again", {
                  intent: "Ask Jordan to remind you of the other colors.",
                  vocab: [{ term: "remind me", meaning: "tell me again" }],
                  starter: "Can you remind me…",
                  full: "Can you remind me what colors you have?",
                  fullMeaning: "“Remind me” = tell me again.",
                }, ["colors", "remind"], { key: "colors_again" }),
              ]
            : []
          : [
              card("ask_order", "🚚", "Ask if you can order it online", {
                intent: "Ask if you can order the navy scarf online.",
                vocab: [{ term: "order it online", meaning: "buy it on the website" }],
                starter: "Can I order…",
                full: "Can I order one online?",
                fullMeaning: "“One” means “a navy scarf”.",
              }, ["order", "online"], { core: true }),
            ]),
        card("ask_restock", "📅", "Ask when they'll get more navy in", {
          intent: "Ask when the store will have navy scarves again.",
          vocab: [
            { term: "get more in", meaning: "receive new stock" },
            { term: "When will you…?", meaning: "asking about a future time" },
          ],
          starter: "When will you get…",
          full: "When will you get more navy ones in?",
          fullMeaning: "“Get more in” = receive new stock (very common in stores).",
        }, ["when", "more", "get", "in"], { key: "restock" }),
        card("describe_item", "💙", "Explain that navy is her favorite color", {
          intent: "Explain that navy really matters: it's your sister's favorite color.",
          vocab: [
            { term: "her favorite color", meaning: "the color she likes most" },
            { term: "really", meaning: "adds emphasis" },
          ],
          starter: "Navy is really her…",
          full: "Navy is really her favorite color.",
          fullMeaning: "American spelling: favorite, color (British: favourite, colour).",
        }, ["favorite", "navy", "color"], { key: "navy_fav", expect: { color: "navy" } }),
        card("ask_order", "⏱️", "Ask how long delivery takes if you order online", {
          intent: "Ask how long it would take to arrive if you ordered the navy one online.",
          vocab: [
            { term: "How long does it take…?", meaning: "asking about time" },
            { term: "to arrive", meaning: "to get to you" },
          ],
          starter: "If I order it online, how long…",
          full: "If I order it online, how long does it take to arrive?",
          fullMeaning: "After “if”, use the present tense: “If I order…”.",
        }, ["order", "online", "how long", "arrive"], { key: "delivery", core: true }),
      ],
      extraIntents: ["ask_price", "ask_restock"],
      aliases: { looking_for: "describe_item", ask_recommendation: "ask_alternatives" },
      resolve: (ctx) => {
        const { slot, state } = ctx;
        // "Do you have it in burgundy?" is a choice, not a request for the color list.
        const report = namesNewColor(ctx) ? { ...ctx.report, intent: "describe_item" } : ctx.report;
        if (report.intent === "ask_restock")
          return stay(
            "info",
            "availability",
            `Say you're not sure — deliveries come in most weeks, but you can't promise navy in time for the birthday. Then briefly repeat the options: ${state.flags.stockChecked ? "another color, or ordering navy online" : "checking the stockroom, another color, or ordering navy online"}.`,
            "I'm not sure when — maybe next week. But there are other options.",
          );
        if (report.intent === "ask_check_stock") {
          if (state.flags.stockChecked)
            return stay("info", "availability", "Remind them you already checked the stockroom — no navy left. Offer another color or ordering online.", "I already checked — no navy in the back, sorry. Another color, or order online?");
          return advance(
            "stock_wait",
            "Say sure, you'll run to the stockroom and check — ask them to give you a minute. One or two short sentences.",
            "Sure! Let me check in the back. Give me a minute.",
            { setFlags: { stockChecked: true }, events: ["time_skip"] },
          );
        }
        if (report.intent === "ask_alternatives")
          return stay(
            "info",
            "availability",
            "List the other colors in stock: charcoal grey, burgundy and camel — same merino wool, same $39.99. Ask which one they'd like.",
            "We have charcoal grey, burgundy and camel — same wool, same price. Which one?",
            { setFlags: { askedColors: true } },
          );
        if (report.intent === "describe_item" || report.intent === "take_it") {
          const color = slot("color") || (state.flags.askedColors ? "charcoal" : "");
          if (!color || color === "navy")
            return stay(
              "branch",
              "availability",
              `Say you understand${color === "navy" ? " — navy is a great choice" : ""}. Gently remind them navy is sold out on the floor, and suggest how they could still get it: ${state.flags.stockChecked ? "ordering it online" : "you could check the stockroom, or order it online"} — or pick another color.`,
              state.flags.stockChecked ? "Navy is sold out here, sorry — but I can order it online for you." : "Navy is sold out here, sorry. I can check the back or order it online.",
            );
          return showItem(color, `Say good choice — the ${colorName(color)} looks great.`, `Good choice! Here's the ${colorName(color)} one. It's $39.99. What do you think?`);
        }
        if (report.intent === "ask_order" || report.intent === "ask_delivery")
          return advance(
            "decide",
            "Say yes — you can order navy online for them right here: delivery in 3–5 business days, free shipping, same $39.99. Ask if they'd like to go ahead.",
            "Yes! I can order it for you — it arrives in 3 to 5 days, free shipping, $39.99. Want to go ahead?",
            { setSlots: { color: "navy", fulfilment: "order" }, note: "You found a way to get the exact item you wanted." },
          );
        if (report.intent === "ask_price")
          return stay("info", "availability", "Say all the merino scarves are $39.99. Repeat the options briefly.", "They're all $39.99.");
        return null;
      },
    },
    {
      id: "stock_wait",
      group: "Find it",
      learnerOpens: "Jordan is back from the stockroom — you speak first.",
      npcGoal: "You're back from the stockroom; tell the customer what you found when they ask.",
      meaning: "",
      situation: "Jordan is back from the stockroom. Find out what happened.",
      cards: () => [
        card("ask_found", "❓", "Ask if they found one", {
          intent: "Ask Jordan whether there was a navy scarf in the stockroom.",
          vocab: [
            { term: "Any luck?", meaning: "casual: “did you succeed?”" },
            { term: "Did you find…?", meaning: "asking about the result" },
          ],
          starter: "Any luck? Did you…",
          full: "Any luck? Did you find one?",
          fullMeaning: "“Any luck?” is a very natural, friendly way to ask.",
        }, ["luck", "find", "found"], { core: true }),
        card("thanks", "🙏", "Thank them for checking", {
          intent: "Thank Jordan for going to check.",
          vocab: [{ term: "Thanks so much for…", meaning: "warm thank-you for an action" }],
          starter: "Thanks so much for…",
          full: "Thanks so much for checking!",
          fullMeaning: "After “for”, use the -ing form: for checking, for helping.",
        }, ["thanks", "thank you", "checking"], { core: true }),
        card("ask_order", "🚚", "Ask if you could order one instead", {
          intent: "Ask if ordering online is possible, just in case.",
          vocab: [{ term: "just in case", meaning: "to be prepared if something goes wrong" }],
          starter: "If not, could I…",
          full: "If not, could I order one online?",
          fullMeaning: "“If not” = if you didn't find one.",
        }, ["order", "online"], { core: true }),
        card("ask_found", "🤞", "Ask if there's good news", {
          intent: "Jordan is back — ask hopefully whether there's good news.",
          vocab: [
            { term: "You're back!", meaning: "friendly greeting when someone returns" },
            { term: "Good news?", meaning: "short, hopeful question" },
          ],
          starter: "You're back! Good…",
          full: "You're back! Good news?",
          fullMeaning: "Short questions like “Good news?” are friendly and natural.",
        }, ["good news", "back"], { key: "good_news", core: true }),
        card("apologize", "😅", "Apologize for all the trouble", {
          intent: "Say sorry for making Jordan go all the way to the stockroom.",
          vocab: [{ term: "Sorry for all the trouble", meaning: "polite apology for making work for someone" }],
          starter: "Sorry for all…",
          full: "Sorry for all the trouble!",
          fullMeaning: "People say this even when it's the employee's job — it's just polite.",
        }, ["sorry", "trouble"], { core: true }),
        card("describe_item", "🩶", "Say you'd take charcoal if there's no navy", {
          intent: "Tell Jordan that if there's no navy, you'll take the charcoal grey one instead.",
          vocab: [
            { term: "If there's no…", meaning: "if it isn't available" },
            { term: "I'll take…", meaning: "I'll buy…" },
          ],
          starter: "If there's no navy, I'll…",
          full: "If there's no navy, I'll take the charcoal one.",
          fullMeaning: "Present tense after “if”, “will” in the result: “If there's…, I'll…”.",
        }, ["charcoal", "if", "take"], { key: "charcoal_backup", expect: { color: "charcoal" }, core: true }),
      ],
      extraIntents: ["apologize", "describe_item"],
      // Anything that asks how it went counts as asking for the news.
      aliases: { yes: "ask_found", looking_for: "ask_found", ask_check_stock: "ask_found", ask_alternatives: "ask_found" },
      resolve: ({ report, slot, variant }) => {
        // React to what they said first, then give the stockroom news.
        const lead = report.intent === "apologize" ? "Say it was no trouble at all. " : report.intent === "thanks" ? "Say you're welcome. " : "";
        if (report.intent === "describe_item" || report.intent === "take_it") {
          if (variant.stockroomHasIt)
            return showItem("navy", "Say there's no need — you found the very last navy one in the stockroom!", "No need — I found the last navy one! It's $39.99. What do you think?", { setSlots: { color: "navy", fulfilment: "in_store" } });
          const color = slot("color") && slot("color") !== "navy" ? slot("color") : "charcoal";
          return showItem(color, `Apologize: no navy in the stockroom either — but say the ${colorName(color)} is a great choice.`, `No navy in the back, sorry — but here's the ${colorName(color)} one. It's $39.99. What do you think?`);
        }
        if (["ask_found", "thanks", "greet", "apologize"].includes(report.intent)) {
          if (variant.stockroomHasIt)
            return showItem("navy", `${lead}Happily say you found the very last navy one in the stockroom!`, "Good news — I found the last navy one! It's $39.99. What do you think?", { setSlots: { color: "navy", fulfilment: "in_store" } });
          return advance(
            "availability",
            `${lead}Apologize: no luck — there were no navy ones in the stockroom either. Offer to order navy online (3–5 days, free shipping) or suggest charcoal, burgundy or camel.`,
            "Sorry, no luck — no navy in the back either. I could order it online, or you could pick another color.",
            { reaction: "neutral" },
          );
        }
        if (report.intent === "ask_order" || report.intent === "ask_delivery") {
          if (variant.stockroomHasIt)
            return showItem("navy", "Say no need to order — you found the very last navy one in the stockroom!", "No need — I found the last navy one! It's $39.99. What do you think?", { setSlots: { color: "navy", fulfilment: "in_store" } });
          return advance(
            "decide",
            "Say you didn't find any navy in the back, but yes — you can order it online right now: 3–5 business days, free shipping, $39.99. Ask if they'd like to go ahead.",
            "No navy in the back, but I can order it online — 3 to 5 days, free shipping. Go ahead?",
            { setSlots: { color: "navy", fulfilment: "order" } },
          );
        }
        return null;
      },
    },
    {
      id: "decide",
      group: "Decide",
      npcGoal: "Present the scarf (or the online order), mention the price ($39.99), and ask if they'd like it.",
      meaning: "It's $39.99. Would you like it?",
      situation: "Jordan showed you the option. Decide — or ask a question first.",
      extraIntents: ["ask_price", "describe_item", "ask_material", "ask_delivery"],
      aliases: { yes: "take_it", accept_offer: "take_it", looking_for: "describe_item" },
      cards: ({ state, variant }) => [
        card("take_it", "✅", state.slots.fulfilment === "order" ? "Say yes, place the order" : "Say you'll take it", {
          intent: state.slots.fulfilment === "order" ? "Say yes, you'd like to place the order." : "Say you want to buy it.",
          vocab: [
            { term: "I'll take it", meaning: "I'll buy it" },
            { term: "Perfect", meaning: "great, exactly right" },
          ],
          starter: "Perfect, I'll…",
          full: state.slots.fulfilment === "order" ? "Yes, let's go ahead and order it." : "Perfect, I'll take it.",
          fullMeaning: "The natural way to say you've decided to buy.",
        }, ["take it", "perfect", "go ahead", "buy"], { core: true }),
        card("ask_discount", "🏷️", "Ask if there are any discounts", {
          intent: "Ask politely whether there's any discount or sale.",
          vocab: [
            { term: "discount", meaning: "a lower price" },
            { term: "on sale", meaning: "sold at a reduced price" },
          ],
          starter: "Is there any…",
          full: "Is there any discount on this?",
          fullMeaning: "“Any” makes the question open and polite.",
        }, ["discount", "sale", "deal"], { core: !!variant.storeCard && !state.flags.cardOffered }),
        state.slots.fulfilment === "order"
          ? card("take_it", "🥰", "Say it sounds perfect, let's order it", {
              intent: "Say it sounds perfect and you'd like to order it.",
              vocab: [
                { term: "sounds perfect", meaning: "is exactly right" },
                { term: "Let's…", meaning: "suggesting doing something now" },
              ],
              starter: "That sounds perfect. Let's…",
              full: "That sounds perfect. Let's order it!",
              fullMeaning: "“Let's” = let us: a friendly way to say you're ready.",
            }, ["perfect", "order", "let's"], { key: "love_it", core: true })
          : card("take_it", "🥰", "Say she'll love it and you'll take it", {
              intent: "Say your sister will love it, and you'll buy it.",
              vocab: [
                { term: "She'll love it", meaning: "she will like it very much" },
                { term: "I'll take it", meaning: "I'll buy it" },
              ],
              starter: "She'll love it! I'll…",
              full: "She'll love it! I'll take it.",
              fullMeaning: "“She'll” = she will: a prediction you're sure about.",
            }, ["love it", "take it"], { key: "love_it", core: true }),
        card("ask_material", "🐑", "Ask what it's made of", {
          intent: "Ask what material the scarf is made of.",
          vocab: [{ term: "made of", meaning: "the material something is made from" }],
          starter: "What's it…",
          full: "What's it made of?",
          fullMeaning: "In casual questions, the preposition goes at the end: “made of?”",
        }, ["made of", "material", "wool"], { key: "material" }),
        state.slots.fulfilment === "order"
          ? card("ask_delivery", "📦", "Ask when it would arrive", {
              intent: "Ask when the online order would arrive.",
              vocab: [{ term: "When would it arrive?", meaning: "asking about the delivery date" }],
              starter: "When would it…",
              full: "When would it arrive?",
              fullMeaning: "“Would” because it's still a possibility: you haven't ordered yet.",
            }, ["when", "arrive", "delivery"], { key: "arrival" })
          : card("ask_material", "🧺", "Ask if you can machine-wash it", {
              intent: "Ask whether the scarf can go in the washing machine.",
              vocab: [{ term: "machine-washable", meaning: "safe to wash in a washing machine" }],
              starter: "Is it machine…",
              full: "Is it machine-washable?",
              fullMeaning: "Wool often isn't, so it's a smart question for a gift!",
            }, ["wash", "machine", "washable"], { key: "wash" }),
        card("ask_returns", "↩️", "Ask if your sister can return it", {
          intent: "Ask whether the gift can be returned or exchanged if your sister doesn't like it.",
          vocab: [
            { term: "return", meaning: "bring it back for your money" },
            { term: "exchange", meaning: "swap it for something else" },
          ],
          starter: "Can she return it if…",
          full: "Can she return it if she doesn't like it?",
          fullMeaning: "“If she doesn't like it” — present tense after “if”.",
        }, ["return", "exchange", "doesn't like"]),
      ],
      resolve: (ctx) => {
        const { report, variant, state } = ctx;
        // Changing their mind: "Actually, could I see the burgundy one?" (however it's labeled).
        const color = ["describe_item", "ask_alternatives", "looking_for", "take_it"].includes(report.intent) ? newColorSaid(ctx) : "";
        if (color) {
          if (color === "navy" && variant.navyOut)
            return stay(
              "branch",
              "decide",
              "Gently remind them navy is sold out on the floor — but you could order it online for them (3–5 business days, free shipping). Ask what they'd like to do.",
              "Navy is sold out here, but I could order it online for you. What would you like?",
            );
          return showItem(color, `Say sure — here's the ${colorName(color)} one instead.`, `Sure! Here's the ${colorName(color)} one. It's $39.99. What do you think?`);
        }
        if (report.intent === "ask_order" && state.slots.fulfilment !== "order")
          return advance(
            "decide",
            "Say yes — you can order navy online for them right here: 3–5 business days, free shipping, same $39.99. Ask if they'd like to go ahead.",
            "Yes! I can order navy online — 3 to 5 days, free shipping, $39.99. Want to go ahead?",
            { setSlots: { color: "navy", fulfilment: "order" } },
          );
        if (report.intent === "take_it") {
          if (variant.storeCard && !state.flags.cardOffered)
            return advance(
              "offer",
              "Say great choice! Then, as a quick follow-up, mention that if they sign up for a Whitmore's store card today, they'd get 20% off this purchase. Ask if they're interested.",
              "Great choice! If you open a store card today, you get 20% off. Interested?",
              { setFlags: { cardOffered: true } },
            );
          return advance("checkout", "Say great choice, you'll ring them up, and ask if they'd like it gift-wrapped (it's free).", "Great! I'll ring you up. Would you like it gift-wrapped? It's free.");
        }
        if (report.intent === "ask_discount") {
          if (variant.storeCard && !state.flags.cardOffered)
            return advance(
              "offer",
              "Say the scarves aren't on sale, but if they sign up for a Whitmore's store card today they'd get 20% off this purchase. Ask if they're interested.",
              "Not on sale, but you get 20% off if you open a store card today. Interested?",
              { setFlags: { cardOffered: true } },
            );
          return stay("info", "decide", "Say sorry, no discounts on scarves right now — but it's great quality for the price. Ask if they'd like it.", "Sorry, no discounts on these right now. Would you like it?");
        }
        if (report.intent === "ask_returns")
          return stay(
            "info",
            "decide",
            "Say yes — returns or exchanges within 30 days with the receipt, and you can include a gift receipt so their sister can exchange it. Ask if they'd like to take it.",
            "Yes — 30 days with a receipt, and I can add a gift receipt. Would you like it?",
            { setFlags: { returnsAsked: true } },
          );
        if (report.intent === "ask_price") return stay("info", "decide", "Say it's $39.99 plus tax. Ask if they'd like it.", "It's $39.99 plus tax. Would you like it?");
        if (report.intent === "ask_material")
          return stay(
            "info",
            "decide",
            "Answer their question about the scarf: it's 100% merino wool — soft, warm and not itchy; hand-wash it in cold water or dry-clean it (not the washing machine). Then ask if they'd like it.",
            "It's 100% merino wool — soft and warm. Hand-wash only. Would you like it?",
          );
        if (report.intent === "ask_delivery" || (report.intent === "ask_order" && state.slots.fulfilment === "order"))
          return stay(
            "info",
            "decide",
            state.slots.fulfilment === "order"
              ? "Say it arrives in 3–5 business days with free shipping. Ask if they'd like to go ahead."
              : "Say they can take it home with them today! Ask if they'd like it.",
            state.slots.fulfilment === "order" ? "3 to 5 business days, with free shipping. Want to go ahead?" : "You can take it home today! Would you like it?",
          );
        return null;
      },
    },
    {
      id: "offer",
      group: "Decide",
      npcGoal: "Offer the store card: 20% off today if they sign up; ask if they're interested.",
      meaning: "If you open a store card today, you get 20% off. Interested?",
      situation: "An unexpected follow-up: Jordan is offering a store card with a discount.",
      cards: () => [
        card("decline", "🙅", "Politely say no thanks", {
          intent: "Say no to the store card, politely.",
          vocab: [
            { term: "No thanks", meaning: "polite refusal" },
            { term: "I'm good / I'm okay", meaning: "casual: I don't need it" },
          ],
          starter: "No thanks, I'm…",
          full: "No thanks, I'm okay.",
          fullMeaning: "Short refusals are normal and polite in stores.",
        }, ["no thanks", "okay", "good"], { core: true }),
        card("accept_offer", "💳", "Say yes, sign you up", {
          intent: "Accept the store card offer.",
          vocab: [
            { term: "Sure, why not?", meaning: "casual yes" },
            { term: "sign me up", meaning: "register me" },
          ],
          starter: "Sure, why not…",
          full: "Sure, why not — sign me up.",
          fullMeaning: "Informal and friendly.",
        }, ["sure", "sign me up", "yes"], { core: true }),
        card("ask_offer_details", "❓", "Ask what a store card is", {
          intent: "Ask Jordan to explain what a store card is.",
          vocab: [{ term: "What's a…?", meaning: "asking for an explanation" }],
          starter: "Sorry, what's…",
          full: "Sorry, what's a store card?",
          fullMeaning: "It's fine to ask when you don't know a word!",
        }, ["what's", "store card", "mean"]),
        card("decline", "🕒", "Say maybe another time", {
          intent: "Politely say not today — maybe another time.",
          vocab: [{ term: "Maybe next time", meaning: "a soft, friendly “no” for now" }],
          starter: "Maybe next…",
          full: "Maybe next time, thanks!",
          fullMeaning: "A polite no that keeps things friendly.",
        }, ["maybe", "next time", "thanks"], { key: "maybe_later", core: true }),
        card("ask_card_fee", "🧐", "Ask if there's a yearly fee", {
          intent: "Ask whether the store card has an annual fee.",
          vocab: [
            { term: "an annual fee", meaning: "money you pay every year to have the card" },
            { term: "Is there…?", meaning: "asking if something exists" },
          ],
          starter: "Is there an annual…",
          full: "Is there an annual fee?",
          fullMeaning: "Always a good question before signing up for a card!",
        }, ["annual fee", "fee", "yearly"]),
        card("ask_savings", "🧮", "Ask how much you'd save", {
          intent: "Ask how much money the discount would save you.",
          vocab: [
            { term: "save", meaning: "spend less money" },
            { term: "How much would I…?", meaning: "asking about a possible result" },
          ],
          starter: "How much would I…",
          full: "How much would I save?",
          fullMeaning: "“Would” because you haven't decided yet.",
        }, ["save", "how much"]),
      ],
      extraIntents: ["take_it", "ask_card_fee", "ask_savings"],
      // "I'll just take the scarf" = no to the card.
      aliases: { yes: "accept_offer", no: "decline", take_it: "decline" },
      resolve: ({ report }) => {
        if (report.intent === "ask_card_fee")
          return stay("info", "offer", "Say no — there's no annual fee, and the 20% applies to today's purchase. Ask if they'd like to sign up.", "No annual fee! And you get 20% off today. Want to sign up?");
        if (report.intent === "ask_savings")
          return stay(
            "info",
            "offer",
            "Say 20% off saves them $8 today — the scarf would be $31.99 instead of $39.99, plus tax. Ask if they'd like to sign up.",
            "You'd save $8 — it would be $31.99 instead of $39.99. Want to sign up?",
          );
        if (report.intent === "decline")
          return advance("checkout", "Say no problem at all, you'll ring them up, and ask if they'd like it gift-wrapped (it's free).", "No problem! Would you like it gift-wrapped? It's free.");
        if (report.intent === "accept_offer")
          return advance(
            "checkout",
            "Say great — it only takes a second, and you've applied the 20% discount. Then ask if they'd like it gift-wrapped (it's free).",
            "Great — done, you get 20% off! Would you like it gift-wrapped?",
            { setSlots: { storeCard: "yes" } },
          );
        if (report.intent === "ask_offer_details")
          return stay(
            "info",
            "offer",
            "Explain simply: it's a credit card just for Whitmore's; signing up today gives 20% off this purchase. Ask if they'd like one.",
            "It's a credit card for our store — you get 20% off today. Would you like one?",
          );
        return null;
      },
    },
    {
      id: "checkout",
      group: "Checkout",
      npcGoal: "Ask if they'd like it gift-wrapped (free).",
      meaning: "Would you like it gift-wrapped?",
      situation: "Jordan is asking if you'd like it gift-wrapped.",
      cards: ({ state }) => [
        card("gift_wrap", "🎁", "Say yes, gift-wrap it", {
          intent: "Say yes, you'd like it wrapped as a present.",
          vocab: [
            { term: "gift-wrap", meaning: "wrap in decorative paper" },
            { term: "That would be great", meaning: "enthusiastic yes" },
          ],
          starter: "Yes, that would…",
          full: "Yes, that would be great, thanks!",
          fullMeaning: "“That would be great” is a warm way to accept an offer.",
        }, ["yes", "great", "wrap"], { core: true }),
        card("decline", "🙅", "Say there's no need", {
          intent: "Say you don't need it wrapped.",
          vocab: [{ term: "That's okay", meaning: "polite no" }],
          starter: "No, that's…",
          full: "No, that's okay, thanks.",
          fullMeaning: "Soft, polite refusal.",
        }, ["no", "okay"], { core: true }),
        card("ask_gift_receipt", "🧾", "Ask for a gift receipt", {
          intent: "Ask for a gift receipt so your sister can exchange it.",
          vocab: [{ term: "a gift receipt", meaning: "a receipt without the price" }],
          starter: "Could I get a…",
          full: "Could I get a gift receipt, too?",
          fullMeaning: "“Could I get…?” is a very common way to ask for something in the US.",
        }, ["gift receipt", "receipt"]),
        card("gift_wrap", "🎀", "Say yes, with a ribbon", {
          intent: "Say yes to gift wrapping, and ask for a ribbon.",
          vocab: [
            { term: "a ribbon", meaning: "a decorative band tied around a present" },
            { term: "if you have one", meaning: "makes a request softer" },
          ],
          starter: "Yes, please — with a…",
          full: "Yes, please — with a ribbon, if you have one!",
          fullMeaning: "“If you have one” keeps the request light and polite.",
        }, ["ribbon", "yes", "please"], { key: "ribbon", core: true }),
        card("decline", "🏠", "Say you'll wrap it yourself", {
          intent: "Say no thanks: you'd like to wrap it yourself at home.",
          vocab: [
            { term: "myself", meaning: "without help" },
            { term: "at home", meaning: "in your own house" },
          ],
          starter: "That's okay, I'll wrap…",
          full: "That's okay, I'll wrap it myself at home.",
          fullMeaning: "“Myself” shows you'll do it on your own.",
        }, ["myself", "home", "okay"], { key: "self_wrap", core: true }),
        // Only for the scarf in hand (an online order arrives without one).
        ...(state.slots.fulfilment === "order"
          ? []
          : [
              card("remove_tag", "🏷️", "Ask them to take the price tag off", {
                intent: "It's a gift, so ask Jordan to remove the price tag.",
                vocab: [
                  { term: "the price tag", meaning: "the label that shows the price" },
                  { term: "take … off", meaning: "remove" },
                ],
                starter: "Could you take the…",
                full: "Could you take the price tag off?",
                fullMeaning: "“Take off” is a phrasal verb meaning “remove”.",
              }, ["price tag", "tag", "take off"]),
            ]),
      ],
      extraIntents: ["remove_tag"],
      aliases: { yes: "gift_wrap", no: "decline", accept_offer: "gift_wrap" },
      resolve: ({ report, state }) => {
        const t = total(state.slots);
        if (report.intent === "remove_tag")
          return stay(
            "info",
            "checkout",
            "Say of course — you'll take the price tag off since it's a gift. Then ask again if they'd like it gift-wrapped (it's free).",
            "Of course, I'll take the tag off. Would you like it gift-wrapped?",
            { setFlags: { tagRemoved: true } },
          );
        if (report.intent === "gift_wrap")
          return advance(
            "pay",
            `Say you'll wrap it with a ribbon — it'll look great. Then say the total comes to ${t} with tax and ask how they'd like to pay.`,
            `I'll wrap it with a ribbon. Your total is ${t} with tax. How would you like to pay?`,
            { events: ["gift_wrapped"], setSlots: { wrap: "yes" } },
          );
        if (report.intent === "decline")
          return advance("pay", `Say no problem. The total comes to ${t} with tax — ask how they'd like to pay.`, `No problem. Your total is ${t}. How would you like to pay?`);
        if (report.intent === "ask_gift_receipt")
          return stay("info", "checkout", "Say of course, you'll include a gift receipt. Then ask again if they'd like it gift-wrapped.", "Of course! And would you like it gift-wrapped?", { setFlags: { giftReceipt: true } });
        return null;
      },
    },
    {
      id: "pay",
      group: "Checkout",
      npcGoal: "Tell them the total with tax and ask how they'd like to pay.",
      meaning: "Your total is… How would you like to pay?",
      situation: "Jordan told you the total. Pay.",
      cards: ({ state }) => [
        card("pay", "💳", "Pay by card", {
          intent: "Say you'll pay by credit card.",
          vocab: [{ term: "by card", meaning: "using a credit or debit card" }],
          starter: "Card…",
          full: "Card, please.",
          fullMeaning: "Very short answers are normal at the register.",
        }, ["card"], { key: "card", expect: { payment_method: "card" }, core: true }),
        state.flags.tapDown
          ? card("pay", "💵", "Say you'll pay cash instead", {
              intent: "Say that's fine, you'll pay in cash.",
              vocab: [{ term: "No worries", meaning: "casual: it's not a problem" }],
              starter: "No worries, I'll…",
              full: "No worries, I'll pay cash.",
              fullMeaning: "“No worries” is relaxed and friendly.",
            }, ["cash", "no worries"], { key: "cash_instead", expect: { payment_method: "cash" }, core: true })
          : card("pay", "📱", "Pay with your phone", {
              intent: "Ask if you can pay by tapping your phone.",
              vocab: [{ term: "pay with my phone", meaning: "Apple Pay / Google Pay" }],
              starter: "Can I pay with…",
              full: "Can I pay with my phone?",
              fullMeaning: "Asking permission with “Can I…?”",
            }, ["phone", "tap", "apple pay"], { key: "mobile", expect: { payment_method: "mobile" }, core: true }),
        card("pay", "💵", "Pay in cash", {
          intent: "Say you'll pay in cash.",
          vocab: [{ term: "in cash", meaning: "with paper money and coins" }],
          starter: "I'll pay…",
          full: "I'll pay in cash.",
          fullMeaning: "“I'll…” = I will (a decision made now).",
        }, ["cash"], { key: "cash", expect: { payment_method: "cash" }, core: true }),
        card("pay", "🏦", "Pay with your debit card", {
          intent: "Say you'll pay with your debit card.",
          vocab: [{ term: "debit card", meaning: "a bank card that takes money straight from your account" }],
          starter: "I'll pay with my…",
          full: "I'll pay with my debit card.",
          fullMeaning: "“Pay with” + the thing you use to pay.",
        }, ["debit", "card"], { key: "debit", expect: { payment_method: "card" }, core: true }),
        card("ask_price", "🧾", "Ask if that includes tax", {
          intent: "Ask whether the total already includes sales tax.",
          vocab: [
            { term: "sales tax", meaning: "tax added at the register in the US" },
            { term: "include", meaning: "have as part of the total" },
          ],
          starter: "Does that include…",
          full: "Does that include tax?",
          fullMeaning: "In the US, price tags usually don't include sales tax!",
        }, ["tax", "include"], { key: "tax" }),
        // Already asked for at the wrapping step? Then it's no longer on offer.
        ...(state.flags.giftReceipt
          ? []
          : [
              card("ask_gift_receipt", "🎁", "Ask for a gift receipt too", {
                intent: "Ask for a gift receipt so your sister can exchange it if she needs to.",
                vocab: [{ term: "a gift receipt", meaning: "a receipt without the price" }],
                starter: "Could I also get…",
                full: "Could I also get a gift receipt?",
                fullMeaning: "“Also” = in addition to the normal receipt.",
              }, ["gift receipt", "receipt"], { key: "gift_receipt" }),
            ]),
      ],
      extraIntents: ["ask_gift_receipt", "ask_price"],
      resolve: ({ report, slot, variant, state }) => {
        const t = total(state.slots);
        if (report.intent === "ask_price")
          return stay("info", "pay", `Say yes — ${t} includes the 8.875% New York sales tax. Ask how they'd like to pay.`, `Yes, ${t} includes tax. How would you like to pay?`);
        // "Yes, card is fine" counts only when it actually names how they'll pay.
        if (report.intent === "pay" || (report.intent === "yes" && slot("payment_method"))) {
          const method = slot("payment_method") || "card";
          if (method === "mobile" && variant.tapDown)
            return stay(
              "branch",
              "pay",
              "Apologize: tap-to-pay isn't working today. They can insert a card or pay cash.",
              "Sorry, phone payments aren't working today. You can insert a card or pay cash.",
              { setFlags: { tapDown: true }, note: "Tap-to-pay was down — you needed another way to pay." },
            );
          return advance(
            "farewell",
            method === "cash"
              ? `Take the cash for the ${t} total, give their change, hand over the bag and receipt${state.flags.giftReceipt ? " (and gift receipt)" : ""}, and say something friendly about the gift.`
              : `Say “go ahead and ${method === "mobile" ? "tap your phone" : "tap or insert your card"}”, then say it went through, hand over the bag and receipt${state.flags.giftReceipt ? " (and gift receipt)" : ""}, and say you hope their sister loves it.`,
            "All done! Here's your bag and receipt. I hope your sister loves it!",
            { objectiveComplete: true, events: ["payment_done"], setSlots: { paid: method } },
          );
        }
        if (report.intent === "ask_gift_receipt")
          return stay("info", "pay", `Say of course, you'll include a gift receipt. The total is ${t} — ask how they'd like to pay.`, `Sure! The total is ${t}. How would you like to pay?`, { setFlags: { giftReceipt: true } });
        return null;
      },
    },
    {
      id: "farewell",
      group: "Checkout",
      npcGoal: "Say goodbye warmly (Have a great day!).",
      meaning: "Have a great day!",
      situation: "You've got your present! Say goodbye.",
      cards: () => [
        card("thanks", "🙏", "Thank them for their help", {
          intent: "Thank Jordan for all the help.",
          vocab: [{ term: "Thanks so much for your help", meaning: "warm, complete thank-you" }],
          starter: "Thanks so much…",
          full: "Thanks so much for your help!",
          fullMeaning: "A perfect way to end a store conversation.",
        }, ["thanks", "help"], { core: true }),
        card("goodbye", "👋", "Wish them a good day", {
          intent: "Say goodbye and wish them a nice day.",
          vocab: [
            { term: "Have a good one!", meaning: "casual American “have a nice day”" },
            { term: "You too!", meaning: "reply when someone wishes you something" },
          ],
          starter: "Have a…",
          full: "Have a good one!",
          fullMeaning: "Very common in the US.",
        }, ["have a good", "great day", "bye"], { core: true }),
        card("compliment", "😊", "Say they were really helpful", {
          intent: "Tell Jordan they were really helpful.",
          vocab: [{ term: "You've been really helpful", meaning: "a compliment about their service" }],
          starter: "You've been…",
          full: "You've been really helpful — thank you!",
          fullMeaning: "Present perfect (“you've been”) for something that just happened.",
        }, ["helpful", "thank you"], { core: true }),
        card("come_again", "🔜", "Say you'll come back again", {
          intent: "Tell Jordan you'll definitely come back to the store.",
          vocab: [
            { term: "come back", meaning: "return" },
            { term: "definitely", meaning: "for sure" },
          ],
          starter: "I'll definitely…",
          full: "I'll definitely come back!",
          fullMeaning: "“Definitely” makes it warmer and more certain.",
        }, ["come back", "definitely"], { core: true }),
        card("thanks", "🥳", "Say your sister is going to love it", {
          intent: "Thank Jordan and say you're sure your sister will love the present.",
          vocab: [{ term: "is going to love it", meaning: "will like it very much (a confident prediction)" }],
          starter: "Thanks! My sister is going to…",
          full: "Thanks! My sister is going to love it.",
          fullMeaning: "“Going to” for a prediction you feel sure about.",
        }, ["sister", "love", "thanks"], { key: "sister_love", core: true }),
        card("ask_location", "🚪", "Ask which way the exit is", {
          intent: "Ask Jordan how to get to the exit.",
          vocab: [
            { term: "Which way is…?", meaning: "asking for directions" },
            { term: "the exit", meaning: "the way out" },
          ],
          starter: "Which way is…",
          full: "Which way is the exit?",
          fullMeaning: "“Which way” asks for a direction.",
        }, ["exit", "which way", "way out"], { key: "exit", core: true }),
      ],
      extraIntents: ["come_again", "ask_location"],
      resolve: ({ report }) => {
        if (report.intent === "ask_location")
          return complete(
            "farewell",
            "Point them to the exit — down the escalator and straight ahead through the main doors — then wish them a great day.",
            "Down the escalator and straight ahead. Have a great day!",
          );
        if (["thanks", "goodbye", "compliment", "greet", "come_again", "yes", "no"].includes(report.intent))
          return complete("farewell", "Say a warm, short goodbye (e.g. “You're so welcome — have a great day!”).", "You're welcome — have a great day!");
        return null;
      },
    },
  ],
};

