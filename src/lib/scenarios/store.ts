import { advance, complete, stay } from "@/lib/engine/engine";
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
  const base = 45 * (slots.storeCard === "yes" ? 0.8 : 1);
  return `$${(Math.round(base * 1.08875 * 100) / 100).toFixed(2)}`;
}

/** The scarf is picked out and presented — the learner decides next. */
function showItem(color: string, extra: string, meaning: string, more: Partial<Outcome> = {}): Outcome {
  return advance(
    "decide",
    `${extra} Present the ${colorName(color)} merino wool scarf: say it's really soft and warm, it's $45, and ask what they think.`,
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
  return showItem(color, "Say “great choice”.", `Here it is — a ${colorName(color)} merino wool scarf. It's $45. What do you think?`, {
    setSlots: { ...set, color, fulfilment: "in_store" },
  });
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
}, ["navy", "blue", "I'd like"], { key: "navy", expect: { color: "navy" } });

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
  requiredSlots: ["color", "paid"],
  intents: {
    looking_for: "Says what they are looking for (fill `item`)",
    just_browsing: "Says they're just browsing / looking around",
    ask_location: "Asks where something is in the store",
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
      `SCARVES: merino wool scarves $45 in navy blue${v.navyOut ? " (SOLD OUT on the shop floor today)" : ""}, charcoal grey, burgundy and camel. Cashmere scarves $120 in grey and cream.`,
      `STOCKROOM: ${v.stockroomHasIt ? "has exactly one navy merino scarf left" : "has no navy merino scarves"} — you only find out if you go and check.`,
      "Online orders: delivery in 3–5 business days, free shipping, same price. Returns: 30 days with a receipt; gift receipts available. Gift wrapping is free.",
      "Sales tax is 8.875%.",
      v.storeCard ? "Store card: signing up today gives 20% off this purchase — only bring it up when the engine tells you to." : "No discounts on scarves right now.",
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
        }, ["looking for", "scarf", "please"], { expect: { item: "scarf" } }),
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
        }, ["where", "find", "scarves"]),
      ],
      resolve: (ctx) => {
        const { report, slot } = ctx;
        // A full description in the first reply jumps straight ahead.
        if (report.intent === "describe_item" || (report.intent === "looking_for" && (slot("color") || slot("material") || slot("recipient"))))
          return describeOutcome(ctx, "greeting");
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
      extraIntents: ["ask_recommendation", "ask_price"],
      cards: ({ state }) => {
        const cards: IntentCard[] = [navyCard];
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
        return cards.slice(0, 3);
      },
      resolve: (ctx) => {
        const { report } = ctx;
        if (report.intent === "describe_item" || report.intent === "looking_for") return describeOutcome(ctx, "details");
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "details",
            "Recommend the merino wool scarves — soft, warm, a great gift — in navy, charcoal, burgundy or camel. Ask which color they'd like.",
            "I recommend our merino wool scarves — soft and warm. Which color would you like?",
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_price")
          return stay("info", "details", "Say the merino wool scarves are $45 and cashmere is $120. Ask what color they'd like.", "Merino wool is $45, cashmere is $120. Which color?");
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
            }, ["order", "online", "deliver"])
          : card("ask_check_stock", "📦", "Ask them to check the stockroom", {
              intent: "Ask Jordan to check if there are more in the stockroom.",
              vocab: [
                { term: "in the back", meaning: "in the storage room (very common in stores)" },
                { term: "Could you check…?", meaning: "polite request" },
              ],
              starter: "Could you check if…",
              full: "Could you check if you have any in the back?",
              fullMeaning: "“Any” is used in questions: “do you have any?”",
            }, ["check", "back", "stockroom", "any"]),
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
            }, ["charcoal", "take"], { key: "charcoal", expect: { color: "charcoal" } })
          : card("ask_alternatives", "🎨", "Ask what other colors they have", {
              intent: "Ask what other colors are available.",
              vocab: [{ term: "What other colors…?", meaning: "asking for the other options" }],
              starter: "What other colors…",
              full: "What other colors do you have?",
              fullMeaning: "Simple and natural.",
            }, ["other", "colors", "colour"]),
        state.flags.stockChecked
          ? card("ask_alternatives", "🧣", "Ask to see the other colors again", {
              intent: "Ask Jordan to remind you of the other colors.",
              vocab: [{ term: "remind me", meaning: "tell me again" }],
              starter: "Can you remind me…",
              full: "Can you remind me what colors you have?",
              fullMeaning: "“Remind me” = tell me again.",
            }, ["colors", "remind"])
          : card("ask_order", "🚚", "Ask if you can order it online", {
              intent: "Ask if you can order the navy scarf online.",
              vocab: [{ term: "order it online", meaning: "buy it on the website" }],
              starter: "Can I order…",
              full: "Can I order one online?",
              fullMeaning: "“One” means “a navy scarf”.",
            }, ["order", "online"]),
      ],
      extraIntents: ["ask_price"],
      resolve: ({ report, slot, state }) => {
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
            "List the other colors in stock: charcoal grey, burgundy and camel — same merino wool, same $45. Ask which one they'd like.",
            "We have charcoal grey, burgundy and camel — same wool, same price. Which one?",
            { setFlags: { askedColors: true } },
          );
        if (report.intent === "describe_item" || report.intent === "take_it") {
          const color = slot("color") || (state.flags.askedColors ? "charcoal" : "");
          if (!color || color === "navy")
            return stay("branch", "availability", "Gently remind them navy is sold out on the floor, and repeat the options briefly.", "Navy is sold out here, sorry. Another color, the stockroom, or online?");
          return showItem(color, `Say good choice — the ${colorName(color)} looks great.`, `Good choice! Here's the ${colorName(color)} one. It's $45. What do you think?`);
        }
        if (report.intent === "ask_order")
          return advance(
            "decide",
            "Say yes — you can order navy online for them right here: delivery in 3–5 business days, free shipping, same $45. Ask if they'd like to go ahead.",
            "Yes! I can order it for you — it arrives in 3 to 5 days, free shipping, $45. Want to go ahead?",
            { setSlots: { color: "navy", fulfilment: "order" }, note: "You found a way to get the exact item you wanted." },
          );
        if (report.intent === "ask_price")
          return stay("info", "availability", "Say all the merino scarves are $45. Repeat the options briefly.", "They're all $45.");
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
        }, ["luck", "find", "found"]),
        card("thanks", "🙏", "Thank them for checking", {
          intent: "Thank Jordan for going to check.",
          vocab: [{ term: "Thanks so much for…", meaning: "warm thank-you for an action" }],
          starter: "Thanks so much for…",
          full: "Thanks so much for checking!",
          fullMeaning: "After “for”, use the -ing form: for checking, for helping.",
        }, ["thanks", "thank you", "checking"]),
        card("ask_order", "🚚", "Ask if you could order one instead", {
          intent: "Ask if ordering online is possible, just in case.",
          vocab: [{ term: "just in case", meaning: "to be prepared if something goes wrong" }],
          starter: "If not, could I…",
          full: "If not, could I order one online?",
          fullMeaning: "“If not” = if you didn't find one.",
        }, ["order", "online"]),
      ],
      resolve: ({ report, variant }) => {
        if (report.intent === "ask_found" || report.intent === "thanks" || report.intent === "greet") {
          if (variant.stockroomHasIt)
            return showItem("navy", "Happily say you found the very last navy one in the stockroom!", "Good news — I found the last navy one! It's $45. What do you think?", { setSlots: { color: "navy", fulfilment: "in_store" } });
          return advance(
            "availability",
            "Apologize: no luck — there were no navy ones in the stockroom either. Offer to order navy online (3–5 days, free shipping) or suggest charcoal, burgundy or camel.",
            "Sorry, no luck — no navy in the back either. I could order it online, or you could pick another color.",
            { reaction: "neutral" },
          );
        }
        if (report.intent === "ask_order")
          return advance(
            "decide",
            "Say you didn't find any navy in the back, but yes — you can order it online right now: 3–5 business days, free shipping, $45. Ask if they'd like to go ahead.",
            "No navy in the back, but I can order it online — 3 to 5 days, free shipping. Go ahead?",
            { setSlots: { color: "navy", fulfilment: "order" } },
          );
        return null;
      },
    },
    {
      id: "decide",
      group: "Decide",
      npcGoal: "Present the scarf (or the online order), mention the price ($45), and ask if they'd like it.",
      meaning: "It's $45. Would you like it?",
      situation: "Jordan showed you the option. Decide — or ask a question first.",
      extraIntents: ["ask_price", "describe_item"],
      cards: ({ state }) => [
        card("take_it", "✅", state.slots.fulfilment === "order" ? "Say yes, place the order" : "Say you'll take it", {
          intent: state.slots.fulfilment === "order" ? "Say yes, you'd like to place the order." : "Say you want to buy it.",
          vocab: [
            { term: "I'll take it", meaning: "I'll buy it" },
            { term: "Perfect", meaning: "great, exactly right" },
          ],
          starter: "Perfect, I'll…",
          full: state.slots.fulfilment === "order" ? "Yes, let's go ahead and order it." : "Perfect, I'll take it.",
          fullMeaning: "The natural way to say you've decided to buy.",
        }, ["take it", "perfect", "go ahead", "buy"]),
        card("ask_discount", "🏷️", "Ask if there are any discounts", {
          intent: "Ask politely whether there's any discount or sale.",
          vocab: [
            { term: "discount", meaning: "a lower price" },
            { term: "on sale", meaning: "sold at a reduced price" },
          ],
          starter: "Is there any…",
          full: "Is there any discount on this?",
          fullMeaning: "“Any” makes the question open and polite.",
        }, ["discount", "sale", "deal"]),
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
      resolve: ({ report, variant, state }) => {
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
        if (report.intent === "ask_price") return stay("info", "decide", "Say it's $45 plus tax. Ask if they'd like it.", "It's $45 plus tax. Would you like it?");
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
        }, ["no thanks", "okay", "good"]),
        card("accept_offer", "💳", "Say yes, sign you up", {
          intent: "Accept the store card offer.",
          vocab: [
            { term: "Sure, why not?", meaning: "casual yes" },
            { term: "sign me up", meaning: "register me" },
          ],
          starter: "Sure, why not…",
          full: "Sure, why not — sign me up.",
          fullMeaning: "Informal and friendly.",
        }, ["sure", "sign me up", "yes"]),
        card("ask_offer_details", "❓", "Ask what a store card is", {
          intent: "Ask Jordan to explain what a store card is.",
          vocab: [{ term: "What's a…?", meaning: "asking for an explanation" }],
          starter: "Sorry, what's…",
          full: "Sorry, what's a store card?",
          fullMeaning: "It's fine to ask when you don't know a word!",
        }, ["what's", "store card", "mean"]),
      ],
      extraIntents: ["take_it"],
      resolve: ({ report }) => {
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
      cards: () => [
        card("gift_wrap", "🎁", "Say yes, gift-wrap it", {
          intent: "Say yes, you'd like it wrapped as a present.",
          vocab: [
            { term: "gift-wrap", meaning: "wrap in decorative paper" },
            { term: "That would be great", meaning: "enthusiastic yes" },
          ],
          starter: "Yes, that would…",
          full: "Yes, that would be great, thanks!",
          fullMeaning: "“That would be great” is a warm way to accept an offer.",
        }, ["yes", "great", "wrap"]),
        card("decline", "🙅", "Say there's no need", {
          intent: "Say you don't need it wrapped.",
          vocab: [{ term: "That's okay", meaning: "polite no" }],
          starter: "No, that's…",
          full: "No, that's okay, thanks.",
          fullMeaning: "Soft, polite refusal.",
        }, ["no", "okay"]),
        card("ask_gift_receipt", "🧾", "Ask for a gift receipt", {
          intent: "Ask for a gift receipt so your sister can exchange it.",
          vocab: [{ term: "a gift receipt", meaning: "a receipt without the price" }],
          starter: "Could I get a…",
          full: "Could I get a gift receipt, too?",
          fullMeaning: "“Could I get…?” is a very common way to ask for something in the US.",
        }, ["gift receipt", "receipt"]),
      ],
      resolve: ({ report, state }) => {
        const t = total(state.slots);
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
        }, ["card"], { key: "card", expect: { payment_method: "card" } }),
        state.flags.tapDown
          ? card("pay", "💵", "Say you'll pay cash instead", {
              intent: "Say that's fine, you'll pay in cash.",
              vocab: [{ term: "No worries", meaning: "casual: it's not a problem" }],
              starter: "No worries, I'll…",
              full: "No worries, I'll pay cash.",
              fullMeaning: "“No worries” is relaxed and friendly.",
            }, ["cash", "no worries"], { key: "cash_instead", expect: { payment_method: "cash" } })
          : card("pay", "📱", "Pay with your phone", {
              intent: "Ask if you can pay by tapping your phone.",
              vocab: [{ term: "pay with my phone", meaning: "Apple Pay / Google Pay" }],
              starter: "Can I pay with…",
              full: "Can I pay with my phone?",
              fullMeaning: "Asking permission with “Can I…?”",
            }, ["phone", "tap", "apple pay"], { key: "mobile", expect: { payment_method: "mobile" } }),
        card("pay", "💵", "Pay in cash", {
          intent: "Say you'll pay in cash.",
          vocab: [{ term: "in cash", meaning: "with paper money and coins" }],
          starter: "I'll pay…",
          full: "I'll pay in cash.",
          fullMeaning: "“I'll…” = I will (a decision made now).",
        }, ["cash"], { key: "cash", expect: { payment_method: "cash" } }),
      ],
      extraIntents: ["ask_gift_receipt"],
      resolve: ({ report, slot, variant, state }) => {
        const t = total(state.slots);
        if (report.intent === "pay") {
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
        }, ["thanks", "help"]),
        card("goodbye", "👋", "Wish them a good day", {
          intent: "Say goodbye and wish them a nice day.",
          vocab: [
            { term: "Have a good one!", meaning: "casual American “have a nice day”" },
            { term: "You too!", meaning: "reply when someone wishes you something" },
          ],
          starter: "Have a…",
          full: "Have a good one!",
          fullMeaning: "Very common in the US.",
        }, ["have a good", "great day", "bye"]),
        card("compliment", "😊", "Say they were really helpful", {
          intent: "Tell Jordan they were really helpful.",
          vocab: [{ term: "You've been really helpful", meaning: "a compliment about their service" }],
          starter: "You've been…",
          full: "You've been really helpful — thank you!",
          fullMeaning: "Present perfect (“you've been”) for something that just happened.",
        }, ["helpful", "thank you"]),
      ],
      resolve: ({ report }) => {
        if (["thanks", "goodbye", "compliment", "greet"].includes(report.intent))
          return complete("farewell", "Say a warm, short goodbye (e.g. “You're so welcome — have a great day!”).", "You're welcome — have a great day!");
        return null;
      },
    },
  ],
};

