import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { card } from "./helpers";
import type { Difficulty, Outcome, ScenarioDef, ScenarioState, Variant } from "./types";

const ITEMS: Record<string, { fr: string; en: string; price: number; milk: boolean }> = {
  cafe: { fr: "un café", en: "an espresso", price: 2.5, milk: false },
  cafe_creme: { fr: "un café crème", en: "a café crème", price: 4, milk: true },
  cappuccino: { fr: "un cappuccino", en: "a cappuccino", price: 4.5, milk: true },
  chocolat: { fr: "un chocolat chaud", en: "a hot chocolate", price: 4.5, milk: true },
  the: { fr: "un thé", en: "a tea", price: 3.5, milk: false },
  jus: { fr: "un jus d'orange pressé", en: "a fresh orange juice", price: 5, milk: false },
};
const FOOD: Record<string, { fr: string; en: string; price: number }> = {
  croissant: { fr: "un croissant", en: "a croissant", price: 1.8 },
  pain_au_chocolat: { fr: "un pain au chocolat", en: "a pain au chocolat", price: 2 },
  tartine: { fr: "une tartine beurre-confiture", en: "bread with butter and jam", price: 3.5 },
};

const euros = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

function total(slots: Record<string, string>) {
  return (ITEMS[slots.item]?.price ?? 0) + (FOOD[slots.food]?.price ?? 0) + (FOOD[slots.food2]?.price ?? 0);
}

function orderText(slots: Record<string, string>) {
  const fr = [ITEMS[slots.item]?.fr, FOOD[slots.food]?.fr, FOOD[slots.food2]?.fr].filter(Boolean).join(" et ");
  const en = [ITEMS[slots.item]?.en, FOOD[slots.food]?.en, FOOD[slots.food2]?.en].filter(Boolean).join(" and ");
  return { fr: fr || "leur commande", en: en || "your order" };
}

function clarifyKind(slots: Record<string, string>, variant: Variant) {
  return variant.clarify === "milk" && ITEMS[slots.item]?.milk ? "milk" : "place";
}

function toClarification(state: ScenarioState, variant: Variant, slots: Record<string, string>, greetFirst = false): Outcome {
  const merged = { ...state.slots, ...slots };
  const kind = clarifyKind(merged, variant);
  const o = orderText(merged);
  const q =
    kind === "milk"
      ? "ask which milk they'd like: regular (du lait entier) or oat milk (du lait d'avoine)"
      : "ask if it's to have here or to take away (sur place ou à emporter ?)";
  return advance(
    "clarify",
    `${greetFirst ? "Say « Bonjour ! » back with a satisfied smile. " : ""}Acknowledge the order (${o.fr}) in a few words, then ${q}.`,
    kind === "milk" ? `${o.en}, noted. Regular milk or oat milk?` : `${o.en}, noted. For here or to go?`,
    { setSlots: { ...slots, clarify: kind } },
  );
}

const orderCard = (key: string, icon: string, label: string, fr: string, en: string, expect: Record<string, string>, vocab: { term: string; meaning: string }[], starter: string) =>
  card("order_item", icon, label, {
    intent: `Order ${en} politely.`,
    vocab: [...vocab, { term: "s'il vous plaît", meaning: "please (polite)" }],
    starter,
    full: fr,
    fullMeaning: en.charAt(0).toUpperCase() + en.slice(1) + ", please.",
  }, [...vocab.map((v) => v.term), "s'il vous plaît", "je voudrais"], { key, expect });

export const cafe: ScenarioDef = {
  id: "cafe",
  language: "fr",
  languageName: "Français",
  languageEnglish: "French",
  flag: "🇫🇷",
  city: "Paris",
  locationLabel: "PARIS — LE MARAIS",
  title: "Parisian Café",
  venueName: "Café des Lilas",
  objective: "Order, respond to the server's clarification, and ask for the bill.",
  demoRole: "generalization",
  blurb: "A corner café in the Marais with a zinc bar and a view of the street. Camille is serving this morning.",
  npc: {
    name: "Camille",
    role: "Server",
    voiceKey: "camille",
    look: {
      skin: "#f3d2bd",
      skinShade: "#dfb299",
      hair: "#5a3624",
      hairStyle: "bob",
      outfit: "#1e1e24",
      outfitShade: "#141418",
      apron: "#f5f0e8",
      accent: "#c8413b",
      accessory: "scarf",
      eyes: "#3b2a20",
    },
  },
  backgroundVoices: { barista: { voiceKey: "julien", name: "Julien (barista)" } },
  art: "cafe",
  ambienceAsset: "cafe-ambience",
  sfx: { enter: "cafe-bell", served: "cafe-cup", order_placed: "cafe-espresso", payment_done: "register" },
  briefing: {
    title: "Your notes",
    lines: ["€20 note and a bank card", "It's 9am — you want coffee and something to eat", "Parisians expect a « Bonjour » first!"],
  },
  initialStage: "greeting",
  requiredSlots: ["item", "clarify_answer", "bill"],
  intents: {
    ask_table: "Asks for a table / where to sit",
    order_item: "Orders a drink and/or food (fill `item` and/or `food`)",
    ask_recommendation: "Asks what you recommend",
    answer_clarification: "Answers your clarification question (fill `place` or `milk`)",
    ask_options: "Asks what the options are",
    thats_all: "Says that's all / nothing else",
    ask_water: "Asks for water (une carafe d'eau)",
    ask_bill: "Asks for the bill (l'addition)",
    compliment: "Says the food/drink was good",
    ask_toilet: "Asks where the toilets are",
    pay: "Pays / says how they will pay (fill `payment_method`)",
    ask_service: "Asks if service/tip is included",
    ask_price: "Asks how much something costs",
    come_again: "Says see you soon / will come back",
  },
  slots: {
    item: { description: "Drink ordered", values: Object.keys(ITEMS) },
    food: { description: "Pastry/food ordered", values: Object.keys(FOOD) },
    place: { description: "For here or to go", values: ["sur_place", "a_emporter"] },
    milk: { description: "Milk choice", values: ["entier", "avoine"] },
    payment_method: { description: "How they pay", values: ["card", "cash"] },
    said_bonjour: { description: "Did THIS utterance include a greeting like « bonjour »?", values: ["yes", "no"] },
  },
  greetings: {
    beginner: [
      { text: "Bonjour ! Bienvenue au Café des Lilas.", meaning: "Hello! Welcome to Café des Lilas." },
      { text: "Bonjour ! Installez-vous, je vous en prie.", meaning: "Hello! Please, have a seat." },
    ],
    intermediate: [
      { text: "Bonjour ! Installez-vous, je suis à vous tout de suite.", meaning: "Hello! Have a seat, I'll be right with you." },
      { text: "Bonjour bonjour ! Vous vous installez où vous voulez.", meaning: "Hello! Sit wherever you like." },
    ],
    immersion: [
      { text: "B'jour ! Installez-vous où vous voulez, hein, j'arrive !", meaning: "Hi! Sit wherever you like — I'm coming!" },
      { text: "Bonjour ! Alors, qu'est-ce qui vous ferait plaisir ce matin ?", meaning: "Hello! So, what would you like this morning?" },
    ],
  },
  makeVariant: (difficulty: Difficulty, rand) => ({
    croissantOut: rand() < (difficulty === "beginner" ? 0.25 : 0.5),
    clarify: difficulty === "beginner" ? "place" : pick(["place", "milk"], rand),
    terminalDown: rand() < (difficulty === "beginner" ? 0.2 : 0.45),
    strictBonjour: difficulty !== "beginner",
  }),
  persona:
    "You are Camille, 29, a server at Café des Lilas, a corner café in the Marais, Paris. It's a busy weekday morning. You're friendly but brisk, with a dry Parisian sense of humour, and you care about good manners — customers should say « Bonjour » before ordering. Julien, the barista, works the espresso machine behind the zinc bar.",
  facts: (v) =>
    [
      "MENU: " + Object.values(ITEMS).map((i) => `${i.fr} ${euros(i.price)}`).join(" / "),
      "PASTRIES: " + Object.entries(FOOD).map(([k, f]) => `${f.fr} ${euros(f.price)}${k === "croissant" && v.croissantOut ? " — SOLD OUT this morning (plus de croissants)" : ""}`).join(" / "),
      "Milk options: lait entier (regular) or lait d'avoine (oat). Water (carafe d'eau) is free. Service is included (service compris); tipping is optional.",
      v.terminalDown ? "PAYMENT: the card terminal is BROKEN today (le terminal ne marche pas) — cash only." : "Payment: card or cash.",
    ].join("\n"),
  asrKeywords: ["café crème", "croissant", "pain au chocolat", "cappuccino", "l'addition", "sur place", "à emporter", "lait d'avoine", "carafe d'eau", "par carte", "en espèces"],
  vocabulary: [
    { term: "Bonjour", meaning: "Hello (always say it first!)", stages: ["greeting"] },
    { term: "Qu'est-ce que je vous sers ?", meaning: "What can I get you?", stages: ["order"] },
    { term: "Je voudrais…", meaning: "I would like…", stages: ["order"] },
    { term: "un café crème", meaning: "coffee with steamed milk", stages: ["order"] },
    { term: "Il n'y a plus de…", meaning: "There's no more…", stages: ["order"] },
    { term: "sur place / à emporter", meaning: "for here / to go", stages: ["clarify"] },
    { term: "lait d'avoine", meaning: "oat milk", stages: ["clarify"] },
    { term: "Et avec ceci ?", meaning: "Anything else?", stages: ["anything_else"] },
    { term: "C'est tout, merci", meaning: "That's all, thanks", stages: ["anything_else"] },
    { term: "une carafe d'eau", meaning: "a jug of (free) tap water", stages: ["anything_else", "bill"] },
    { term: "L'addition, s'il vous plaît", meaning: "The bill, please", stages: ["bill"] },
    { term: "Ça fait…", meaning: "That comes to…", stages: ["pay"] },
    { term: "par carte / en espèces", meaning: "by card / in cash", stages: ["pay"] },
    { term: "le service est compris", meaning: "service is included", stages: ["pay"] },
    { term: "Bonne journée !", meaning: "Have a nice day!", stages: ["farewell"] },
  ],
  eventLines: {
    order_placed: (s) => ({
      voice: "barista",
      text: `${ITEMS[s.slots.item]?.fr.replace(/^un |^une /, "Un ") ?? "Un café"} pour la quatre !`,
      meaning: `${ITEMS[s.slots.item]?.en ?? "A coffee"} for table four!`,
    }),
  },
  timeSkipText: "A little later… the cup is empty and the Marais is waking up outside.",
  successTitle: "Bonne journée !",
  stages: [
    {
      id: "greeting",
      group: "Bonjour",
      npcGoal: "Greet the customer and invite them to sit; wait for them to greet you back.",
      meaning: "Hello! Welcome — have a seat.",
      situation: "Camille greeted you as you walked in.",
      cards: () => [
        card("greet", "👋", "Say hello back", {
          intent: "Greet her back politely — this matters a lot in France.",
          vocab: [
            { term: "Bonjour", meaning: "hello / good morning" },
            { term: "madame", meaning: "ma'am (polite)" },
          ],
          starter: "Bon…",
          full: "Bonjour madame !",
          fullMeaning: "Hello, ma'am!",
        }, ["bonjour", "madame"]),
        card("ask_table", "☀️", "Ask for a table on the terrace", {
          intent: "Say hello and ask if you can sit outside on the terrace.",
          vocab: [
            { term: "une table", meaning: "a table" },
            { term: "en terrasse", meaning: "on the terrace (outside)" },
          ],
          starter: "Bonjour, une table…",
          full: "Bonjour, une table en terrasse, s'il vous plaît ?",
          fullMeaning: "Hello, a table on the terrace, please?",
        }, ["table", "terrasse", "bonjour"]),
        orderCard("order_now", "☕", "Order a café crème right away", "Un café crème, s'il vous plaît.", "a café crème", { item: "cafe_creme" }, [{ term: "un café crème", meaning: "a coffee with steamed milk" }], "Un café…"),
      ],
      resolve: ({ report, slot, state, variant, difficulty }) => {
        if (report.intent === "greet" || report.intent === "ask_table") {
          if (state.flags.bonjourLesson && state.slots.item) return toClarification(state, variant, {}, true);
          return advance(
            "order",
            "Greet them back warmly, show them to a small table by the window, and ask what you can get them (Qu'est-ce que je vous sers ?).",
            "Hello! Have a seat. What can I get you?",
            { setFlags: { greeted: true } },
          );
        }
        if (report.intent === "order_item") {
          const slots: Record<string, string> = {};
          if (slot("item")) slots.item = slot("item");
          if (slot("food")) slots.food = slot("food");
          if (variant.strictBonjour && slot("said_bonjour") !== "yes" && difficulty !== "beginner")
            return stay(
              "branch",
              "greeting",
              "They ordered without saying « Bonjour ». Playfully remind them, with a smile, that in Paris you say « Bonjour » first (« Bonjour d'abord ! »). Then wait for them.",
              "Hello first! (In Paris, you say « Bonjour » before anything else.)",
              { reaction: "confused", setSlots: slots, setFlags: { bonjourLesson: true }, note: "In France, always start with « Bonjour » — skipping it feels rude to Parisians." },
            );
          return toClarification(state, variant, slots);
        }
        return null;
      },
    },
    {
      id: "order",
      group: "Order",
      npcGoal: "Ask what they'd like (Qu'est-ce que je vous sers ?).",
      meaning: "What can I get you?",
      situation: "Camille is asking what you'd like to order. The chalkboard menu is behind the bar.",
      extraIntents: ["ask_price"],
      cards: ({ state }) => [
        orderCard("creme", "☕", "Order a café crème", "Je voudrais un café crème, s'il vous plaît.", "a café crème", { item: "cafe_creme" }, [{ term: "je voudrais", meaning: "I would like" }, { term: "un café crème", meaning: "a coffee with steamed milk" }], "Je voudrais…"),
        state.flags.croissantOut
          ? orderCard("pac", "🍫", "Take a pain au chocolat instead", "Alors, un pain au chocolat, s'il vous plaît.", "a pain au chocolat", { food: "pain_au_chocolat" }, [{ term: "alors", meaning: "so / then" }, { term: "un pain au chocolat", meaning: "chocolate pastry" }], "Alors, un pain…")
          : orderCard("cafe_croissant", "🥐", "Order a coffee and a croissant", "Un café et un croissant, s'il vous plaît.", "an espresso and a croissant", { item: "cafe", food: "croissant" }, [{ term: "un café", meaning: "an espresso" }, { term: "un croissant", meaning: "a croissant" }, { term: "et", meaning: "and" }], "Un café et…"),
        card("ask_recommendation", "❓", "Ask what she recommends", {
          intent: "Ask Camille what she would recommend.",
          vocab: [
            { term: "conseiller", meaning: "to recommend / advise" },
            { term: "qu'est-ce que", meaning: "what (question)" },
          ],
          starter: "Qu'est-ce que vous…",
          full: "Qu'est-ce que vous me conseillez ?",
          fullMeaning: "What do you recommend?",
        }, ["conseillez", "recommandez", "qu'est-ce que"]),
      ],
      resolve: ({ report, slot, state, variant }) => {
        if (report.intent === "order_item") {
          const slots: Record<string, string> = {};
          if (slot("item")) slots.item = slot("item");
          if (slot("food")) slots.food = slot("food");
          if (!slots.item && !slots.food && !state.slots.item)
            return { ...stay("info", "order", "Ask what exactly they'd like.", "What would you like exactly?"), kind: "clarify", success: false, reaction: "confused" };
          if (slots.food === "croissant" && variant.croissantOut)
            return stay(
              "branch",
              "order",
              `Apologize: there are no more croissants this morning (il n'y a plus de croissants). Suggest a pain au chocolat instead${slots.item ? `, and note the ${ITEMS[slots.item].fr}` : ""}.`,
              "Sorry, there are no more croissants. How about a pain au chocolat?",
              { setSlots: slots.item ? { item: slots.item } : {}, setFlags: { croissantOut: true }, note: "Croissants were sold out — you had to adapt your order." },
            );
          if (!slots.item && !state.slots.item)
            return stay("info", "order", `Note the ${FOOD[slots.food]?.fr}, then ask what they'd like to drink.`, "And to drink?", { setSlots: slots });
          return toClarification(state, variant, slots);
        }
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "order",
            `Recommend a café crème with a ${variant.croissantOut ? "pain au chocolat" : "croissant"} — the classic Parisian breakfast — then ask what they'd like.`,
            `I'd recommend a café crème with a ${variant.croissantOut ? "pain au chocolat" : "croissant"}. What would you like?`,
            { setFlags: { recommended: true } },
          );
        if (report.intent === "ask_price")
          return stay("info", "order", "Tell them the price they asked about from the menu, then ask what they'd like.", "Here's the price… What would you like?");
        return null;
      },
    },
    {
      id: "clarify",
      group: "Clarification",
      npcGoal: "Ask the clarification question about their order (for here or to go / which milk).",
      meaning: "For here or to go?",
      situation: "Camille needs one more detail about your order — listen for what she's asking.",
      cards: ({ state }) =>
        state.slots.clarify === "milk"
          ? [
              card("answer_clarification", "🥛", "Say regular milk is fine", {
                intent: "Tell her regular milk is fine.",
                vocab: [{ term: "du lait entier", meaning: "whole milk" }, { term: "normal", meaning: "regular" }],
                starter: "Du lait…",
                full: "Du lait normal, s'il vous plaît.",
                fullMeaning: "Regular milk, please.",
              }, ["lait", "normal", "entier"], { key: "milk_regular", expect: { milk: "entier" } }),
              card("answer_clarification", "🌾", "Ask for oat milk", {
                intent: "Ask for oat milk.",
                vocab: [{ term: "du lait d'avoine", meaning: "oat milk" }, { term: "avec", meaning: "with" }],
                starter: "Avec du lait…",
                full: "Avec du lait d'avoine, s'il vous plaît.",
                fullMeaning: "With oat milk, please.",
              }, ["avoine", "lait"], { key: "milk_oat", expect: { milk: "avoine" } }),
              card("ask_options", "🤔", "Ask what milk they have", {
                intent: "Ask which kinds of milk are available.",
                vocab: [{ term: "comme lait", meaning: "in the way of milk" }, { term: "vous avez", meaning: "you have" }],
                starter: "Qu'est-ce que vous avez…",
                full: "Qu'est-ce que vous avez comme lait ?",
                fullMeaning: "What kinds of milk do you have?",
              }, ["qu'est-ce que", "avez", "lait"]),
            ]
          : [
              card("answer_clarification", "🪑", "Say you'll have it here", {
                intent: "Tell her you'll drink it here, at the café.",
                vocab: [{ term: "sur place", meaning: "for here (on site)" }, { term: "ici", meaning: "here" }],
                starter: "Sur…",
                full: "Sur place, s'il vous plaît.",
                fullMeaning: "For here, please.",
              }, ["sur place", "ici"], { key: "here", expect: { place: "sur_place" } }),
              card("answer_clarification", "🥡", "Say it's to take away", {
                intent: "Tell her it's to go.",
                vocab: [{ term: "à emporter", meaning: "to take away / to go" }],
                starter: "À em…",
                full: "À emporter, s'il vous plaît.",
                fullMeaning: "To go, please.",
              }, ["emporter"], { key: "togo", expect: { place: "a_emporter" } }),
              card("ask_repeat", "🔁", "Ask her to say it again", {
                intent: "Politely ask her to repeat the question.",
                vocab: [{ term: "Pardon ?", meaning: "Sorry? / Pardon?" }, { term: "répéter", meaning: "to repeat" }],
                starter: "Pardon, vous pouvez…",
                full: "Pardon, vous pouvez répéter, s'il vous plaît ?",
                fullMeaning: "Sorry, could you repeat that, please?",
              }, ["pardon", "répéter"]),
            ],
      extraIntents: ["ask_options"],
      resolve: ({ report, slot, state }) => {
        if (report.intent === "answer_clarification") {
          const value = state.slots.clarify === "milk" ? slot("milk") : slot("place");
          if (!value) return null;
          return advance(
            "anything_else",
            "Acknowledge in two or three words, then ask if they'd like anything else (Et avec ceci ?).",
            "Perfect. Anything else?",
            { setSlots: { [state.slots.clarify === "milk" ? "milk" : "place"]: value, clarify_answer: value } },
          );
        }
        if (report.intent === "ask_options")
          return stay("info", "clarify", "Explain the options simply (lait entier ou lait d'avoine), then ask again.", "We have regular or oat milk. Which would you like?");
        return null;
      },
    },
    {
      id: "anything_else",
      group: "Clarification",
      npcGoal: "Ask if they'd like anything else (Et avec ceci ?).",
      meaning: "Anything else?",
      situation: "Camille is asking if you'd like anything else.",
      cards: () => [
        card("thats_all", "🙅", "Say that's all", {
          intent: "Tell her that's everything, thanks.",
          vocab: [{ term: "c'est tout", meaning: "that's all" }, { term: "merci", meaning: "thank you" }],
          starter: "C'est…",
          full: "C'est tout, merci.",
          fullMeaning: "That's all, thank you.",
        }, ["c'est tout", "merci", "ça sera tout"]),
        card("ask_water", "💧", "Ask for a jug of water", {
          intent: "Ask for a jug of free tap water.",
          vocab: [{ term: "une carafe d'eau", meaning: "a jug of tap water" }],
          starter: "Une carafe…",
          full: "Une carafe d'eau, s'il vous plaît.",
          fullMeaning: "A jug of water, please.",
        }, ["carafe", "eau"]),
        orderCard("add_pastry", "🥐", "Add a pain au chocolat", "Et un pain au chocolat, s'il vous plaît.", "a pain au chocolat too", { food: "pain_au_chocolat" }, [{ term: "et", meaning: "and" }, { term: "un pain au chocolat", meaning: "chocolate pastry" }], "Et un pain…"),
      ],
      resolve: ({ report, slot, state, variant }) => {
        if (report.intent === "thats_all")
          return advance(
            "bill",
            "Say « Très bien, je vous apporte ça tout de suite » (I'll bring it right away) in your own words — just one short sentence.",
            "Very good, I'll bring that right away.",
            { events: ["order_placed", "time_skip", "served"] },
          );
        if (report.intent === "ask_water")
          return stay("info", "anything_else", "Say of course, you'll bring a carafe of water, then ask if that's all.", "Of course, I'll bring some water. Is that all?", { setFlags: { water: true } });
        if (report.intent === "order_item") {
          const food = slot("food");
          if (food === "croissant" && variant.croissantOut)
            return stay("branch", "anything_else", "Apologize: no more croissants. Suggest a pain au chocolat, then ask if that's all.", "Sorry, no more croissants — a pain au chocolat instead?", { setFlags: { croissantOut: true } });
          const key = state.slots.food ? "food2" : "food";
          return stay("info", "anything_else", "Note it, then ask if that's everything.", "Noted. Is that everything?", { setSlots: food ? { [key]: food } : {} });
        }
        return null;
      },
    },
    {
      id: "bill",
      group: "Bill",
      learnerOpens: "Your cup is empty. Catch Camille's eye — you speak first.",
      npcGoal: "Pass by the table; respond to what the customer asks.",
      meaning: "",
      situation: "You've finished. In France the server won't bring the bill until you ask for it.",
      cards: ({ state }) => [
        card("ask_bill", "🧾", "Ask for the bill", {
          intent: "Ask her for the bill.",
          vocab: [{ term: "l'addition", meaning: "the bill" }, { term: "s'il vous plaît", meaning: "please" }],
          starter: "L'addi…",
          full: "L'addition, s'il vous plaît !",
          fullMeaning: "The bill, please!",
        }, ["addition", "s'il vous plaît"]),
        card("compliment", "😋", "Tell her it was delicious", {
          intent: "Tell her everything was delicious.",
          vocab: [{ term: "c'était", meaning: "it was" }, { term: "délicieux", meaning: "delicious" }],
          starter: "C'était…",
          full: "C'était délicieux, merci !",
          fullMeaning: "It was delicious, thank you!",
        }, ["délicieux", "c'était", "très bon"]),
        state.flags.water
          ? card("ask_toilet", "🚻", "Ask where the restroom is", {
              intent: "Ask where the toilets are.",
              vocab: [{ term: "les toilettes", meaning: "the restroom" }, { term: "où", meaning: "where" }],
              starter: "Où sont…",
              full: "Où sont les toilettes, s'il vous plaît ?",
              fullMeaning: "Where is the restroom, please?",
            }, ["toilettes", "où"])
          : card("ask_water", "💧", "Ask for some water", {
              intent: "Ask for a jug of tap water.",
              vocab: [{ term: "une carafe d'eau", meaning: "a jug of tap water" }],
              starter: "Une carafe…",
              full: "Je pourrais avoir une carafe d'eau ?",
              fullMeaning: "Could I have a jug of water?",
            }, ["carafe", "eau"]),
      ],
      extraIntents: ["pay"],
      resolve: ({ report, state }) => {
        const t = euros(total(state.slots));
        if (report.intent === "ask_bill" || report.intent === "pay")
          return advance("pay", `Say « Bien sûr » and tell them the total: ${t}.`, `Of course. That comes to ${t}.`, { events: ["bill_shown"], setSlots: { bill: "asked" } });
        if (report.intent === "compliment")
          return stay("info", "bill", "Thank them warmly (Merci, ça me fait plaisir !), then ask if they'd like anything else.", "Thank you, glad you liked it! Anything else?");
        if (report.intent === "ask_water")
          return stay("info", "bill", "Say of course and bring a carafe of water.", "Of course, here's some water.", { setFlags: { water: true } });
        if (report.intent === "ask_toilet")
          return stay("info", "bill", "Tell them the toilets are downstairs, at the back on the left.", "Downstairs, at the back on the left.");
        return null;
      },
    },
    {
      id: "pay",
      group: "Bill",
      npcGoal: "Tell them the total and take the payment.",
      meaning: "That comes to …",
      situation: "Camille brought the bill. Pay.",
      cards: ({ state }) => [
        state.flags.terminalRefused
          ? card("pay", "💶", "Say you'll pay cash then", {
              intent: "Say that's fine, you'll pay in cash.",
              vocab: [{ term: "pas de souci", meaning: "no problem" }, { term: "en espèces", meaning: "in cash" }],
              starter: "Pas de souci, je…",
              full: "Pas de souci, je paie en espèces.",
              fullMeaning: "No problem, I'll pay in cash.",
            }, ["espèces", "liquide", "souci"], { key: "cash_then", expect: { payment_method: "cash" } })
          : card("pay", "💳", "Pay by card", {
              intent: "Ask to pay by card.",
              vocab: [{ term: "par carte", meaning: "by card" }, { term: "je peux", meaning: "can I" }],
              starter: "Je peux payer…",
              full: "Je peux payer par carte ?",
              fullMeaning: "Can I pay by card?",
            }, ["carte", "payer"], { key: "card", expect: { payment_method: "card" } }),
        card("pay", "💶", "Pay in cash", {
          intent: "Say you'll pay in cash and hand over your note.",
          vocab: [{ term: "en espèces", meaning: "in cash" }, { term: "voilà", meaning: "here you go" }],
          starter: "En espèces…",
          full: "En espèces. Voilà vingt euros.",
          fullMeaning: "In cash. Here's twenty euros.",
        }, ["espèces", "liquide", "voilà"], { key: "cash", expect: { payment_method: "cash" } }),
        card("ask_service", "🧾", "Ask if service is included", {
          intent: "Ask whether the service charge is included.",
          vocab: [{ term: "le service", meaning: "the service charge" }, { term: "compris", meaning: "included" }],
          starter: "Le service…",
          full: "Le service est compris ?",
          fullMeaning: "Is service included?",
        }, ["service", "compris"]),
      ],
      resolve: ({ report, slot, state, variant }) => {
        const t = euros(total(state.slots));
        if (report.intent === "pay") {
          const method = slot("payment_method") || "cash";
          if (method === "card" && variant.terminalDown)
            return stay(
              "branch",
              "pay",
              "Apologize: the card terminal isn't working today (le terminal ne marche pas). Ask if they could pay in cash.",
              "Sorry, the card machine isn't working today. Could you pay in cash?",
              { setFlags: { terminalRefused: true }, note: "The card machine was down — you needed a plan B." },
            );
          return advance(
            "farewell",
            method === "card"
              ? "Bring the card terminal, say it went through (c'est bon !), and thank them."
              : `Take the cash, give the change for a ${t} total, and thank them.`,
            method === "card" ? "All good, thank you!" : "Here's your change — thank you!",
            { objectiveComplete: true, events: ["payment_done"], setSlots: { paid: method } },
          );
        }
        if (report.intent === "ask_service")
          return stay("info", "pay", "Explain briefly that service is included (le service est compris) — tipping is optional. Remind them of the total.", `Yes, service is included. It's ${t}.`);
        return null;
      },
    },
    {
      id: "farewell",
      group: "Bill",
      npcGoal: "Thank them and say goodbye (Bonne journée !).",
      meaning: "Thank you, have a nice day!",
      situation: "All paid. Say goodbye like a Parisian.",
      cards: () => [
        card("thanks", "🙏", "Thank her and wish her a good day", {
          intent: "Thank her and wish her a nice day.",
          vocab: [{ term: "bonne journée", meaning: "have a nice day" }],
          starter: "Merci, bonne…",
          full: "Merci, bonne journée !",
          fullMeaning: "Thanks, have a nice day!",
        }, ["merci", "bonne journée"]),
        card("goodbye", "👋", "Say goodbye", {
          intent: "Say goodbye politely.",
          vocab: [{ term: "au revoir", meaning: "goodbye" }],
          starter: "Au…",
          full: "Au revoir, madame !",
          fullMeaning: "Goodbye, ma'am!",
        }, ["au revoir"]),
        card("come_again", "🌟", "Say see you soon", {
          intent: "Tell her you'll be back soon.",
          vocab: [{ term: "à bientôt", meaning: "see you soon" }],
          starter: "À bien…",
          full: "À bientôt !",
          fullMeaning: "See you soon!",
        }, ["à bientôt", "bientôt"]),
      ],
      resolve: ({ report }) => {
        if (["thanks", "goodbye", "come_again", "compliment", "greet"].includes(report.intent))
          return complete("farewell", "Say a warm, short goodbye (e.g. « Merci à vous, bonne journée ! »).", "Thank you, have a great day!");
        return null;
      },
    },
  ],
};

