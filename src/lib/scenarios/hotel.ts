import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { card } from "./helpers";
import type { IntentCard, ScenarioDef } from "./types";

type Issue = "not_found" | "room_type" | "dates";

const ISSUE_DIRECTIVES: Record<Issue, { directive: string; meaning: string }> = {
  not_found: {
    directive:
      "Type on the computer, frown slightly, and say you can't find any reservation under that name. Ask for the confirmation number or for them to spell the surname.",
    meaning: "Hmm… I can't find a reservation under that name. Do you have the confirmation number?",
  },
  room_type: {
    directive:
      "Find the reservation, but say it shows a SINGLE room (habitación individual) for two nights. Ask if that's correct.",
    meaning: "I have it: a single room for two nights. Is that right?",
  },
  dates: {
    directive: "Find the reservation, but say it shows only ONE night, tonight. Ask if that's correct.",
    meaning: "I have it: one night, just tonight. Is that right?",
  },
};

const giveConfirmation: IntentCard = card("give_confirmation", "🔢", "Give your confirmation number", {
  intent: "Read out your confirmation number: 4827.",
  vocab: [
    { term: "el número de confirmación", meaning: "the confirmation number" },
    { term: "cuatro, ocho, dos, siete", meaning: "four, eight, two, seven" },
  ],
  starter: "El número de confirmación es…",
  full: "El número de confirmación es cuatro, ocho, dos, siete.",
  fullMeaning: "The confirmation number is 4-8-2-7.",
}, ["número", "confirmación", "cuatro", "ocho", "dos", "siete"]);

const showEmail: IntentCard = card("show_email", "📧", "Offer to show the confirmation email", {
  intent: "Offer to show her the confirmation email on your phone.",
  vocab: [
    { term: "el correo de confirmación", meaning: "the confirmation email" },
    { term: "¿quiere verlo?", meaning: "would you like to see it?" },
    { term: "tengo", meaning: "I have" },
  ],
  starter: "Tengo el correo…",
  full: "Tengo el correo de confirmación, ¿quiere verlo?",
  fullMeaning: "I have the confirmation email. Would you like to see it?",
}, ["correo", "confirmación", "email", "tengo"]);

function issueCards(issue: Issue): IntentCard[] {
  if (issue === "not_found")
    return [
      giveConfirmation,
      card("spell_name", "🔤", "Spell your surname", {
        intent: "Spell your surname letter by letter.",
        vocab: [
          { term: "se escribe", meaning: "it's spelled" },
          { term: "eme, o, erre, ge, a, ene", meaning: "M, O, R, G, A, N (Spanish letter names)" },
        ],
        starter: "Se escribe…",
        full: "Se escribe eme, o, erre, ge, a, ene.",
        fullMeaning: "It's spelled M-O-R-G-A-N.",
      }, ["se escribe", "eme", "erre", "ene"]),
      showEmail,
    ];
  if (issue === "room_type")
    return [
      card("explain_booking", "🛏️", "Explain you booked a double room", {
        intent: "Tell her politely that you booked a double room, not a single.",
        vocab: [
          { term: "reservé", meaning: "I booked" },
          { term: "una habitación doble", meaning: "a double room" },
          { term: "no individual", meaning: "not a single" },
        ],
        starter: "Perdone, reservé…",
        full: "Perdone, pero reservé una habitación doble.",
        fullMeaning: "Excuse me, but I booked a double room.",
      }, ["reservé", "doble", "habitación"], { expect: { room_type: "double" } }),
      card("ask_price", "💶", "Ask if changing costs extra", {
        intent: "Ask whether there's an extra charge to change the room.",
        vocab: [
          { term: "¿hay que pagar…?", meaning: "do I have to pay…?" },
          { term: "algo más", meaning: "something extra" },
        ],
        starter: "¿Hay que pagar…",
        full: "¿Hay que pagar algo más para cambiarla?",
        fullMeaning: "Is there an extra charge to change it?",
      }, ["pagar", "más", "cuesta"]),
      showEmail,
    ];
  return [
    card("explain_booking", "📅", "Explain you booked two nights", {
      intent: "Tell her you booked two nights, until Sunday.",
      vocab: [
        { term: "dos noches", meaning: "two nights" },
        { term: "hasta el domingo", meaning: "until Sunday" },
        { term: "reservé", meaning: "I booked" },
      ],
      starter: "Reservé dos…",
      full: "Reservé dos noches, hasta el domingo.",
      fullMeaning: "I booked two nights, until Sunday.",
    }, ["dos noches", "domingo", "reservé"], { expect: { nights: "2" } }),
    showEmail,
    card("ask_availability", "❓", "Ask if there's a room for two nights", {
      intent: "Ask whether there's availability for a second night.",
      vocab: [
        { term: "¿hay…?", meaning: "is there…?" },
        { term: "disponible", meaning: "available" },
        { term: "otra noche", meaning: "another night" },
      ],
      starter: "¿Hay una habitación…",
      full: "¿Hay una habitación disponible para dos noches?",
      fullMeaning: "Is there a room available for two nights?",
    }, ["disponible", "hay", "noches"]),
  ];
}

export const hotel: ScenarioDef = {
  id: "hotel",
  language: "es",
  languageName: "Español",
  languageEnglish: "Spanish",
  flag: "🇪🇸",
  city: "Sevilla",
  locationLabel: "SEVILLA · SANTA CRUZ",
  title: "Hotel Check-in",
  venueName: "Hotel Azahar",
  objective: "Check in and resolve a problem with your reservation.",
  goal: "Check in and fix your reservation",
  demoRole: "generalization",
  blurb: "A small boutique hotel in the old quarter, all tiles and orange-blossom scent. Lucía is at the front desk.",
  npc: {
    name: "Lucía",
    role: "Receptionist",
    voiceKey: "lucia",
    look: {
      skin: "#e2b48f",
      skinShade: "#c9966f",
      hair: "#2b1d16",
      hairStyle: "bun",
      outfit: "#233a5c",
      outfitShade: "#182a44",
      accent: "#d9a441",
      accessory: "badge",
      eyes: "#2d1f17",
    },
  },
  backgroundVoices: { bellhop: { voiceKey: "mateo", name: "Mateo (bellhop)" } },
  art: "hotel",
  ambienceAsset: "hotel-ambience",
  sfx: { enter: "hotel-door", key_handed: "hotel-elevator", issue_found: "hotel-typing", payment_done: "hotel-bell" },
  briefing: {
    title: "Your booking",
    lines: ["Name: Alex Morgan (or use your own)", "Double room · 2 nights (Fri → Sun)", "Confirmation #4827 · breakfast included"],
  },
  initialStage: "greeting",
  requiredSlots: ["guest", "resolved", "passport"],
  intents: {
    has_reservation: "Says they have a reservation / want to check in",
    give_name: "Gives the name the reservation is under (fill `guest_name`)",
    give_confirmation: "Gives a confirmation number (fill `confirmation_number`)",
    spell_name: "Spells their name letter by letter (fill `guest_name`)",
    show_email: "Offers to show the confirmation email / booking on their phone",
    explain_booking: "Explains what they actually booked (fill `room_type` and/or `nights`)",
    ask_price: "Asks about price / extra charges",
    ask_availability: "Asks if a room / night is available",
    accept: "Accepts the proposed solution (OK, perfect, thanks)",
    give_passport: "Hands over passport/ID (aquí tiene)",
    ask_why: "Asks why something is needed",
    ask_breakfast: "Asks about breakfast (time / included)",
    ask_elevator: "Asks where the elevator/room is",
    ask_wifi: "Asks for the wifi password",
  },
  slots: {
    guest_name: { description: "Name the customer gives" },
    confirmation_number: { description: "Confirmation number the customer gives (digits)" },
    room_type: { description: "Room type the customer says they booked", values: ["single", "double"] },
    nights: { description: "Number of nights the customer says they booked", values: ["1", "2", "3"] },
  },
  greetings: {
    beginner: [
      {
        text: "¡Buenas tardes! Bienvenido al Hotel Azahar. ¿En qué puedo ayudarle?",
        meaning: "Good afternoon! Welcome to Hotel Azahar. How can I help you?",
        forms: {
          feminine: "¡Buenas tardes! Bienvenida al Hotel Azahar. ¿En qué puedo ayudarle?",
          neutral: "¡Buenas tardes! Le damos la bienvenida al Hotel Azahar. ¿En qué puedo ayudarle?",
        },
      },
      { text: "¡Hola, buenas tardes! ¿En qué puedo ayudarle?", meaning: "Hello, good afternoon! How can I help you?" },
    ],
    intermediate: [
      {
        text: "¡Buenas tardes! Bienvenido. ¿Viene a hacer el check-in?",
        meaning: "Good afternoon! Welcome. Are you here to check in?",
        forms: {
          feminine: "¡Buenas tardes! Bienvenida. ¿Viene a hacer el check-in?",
          neutral: "¡Buenas tardes! Qué gusto recibirle. ¿Viene a hacer el check-in?",
        },
      },
      {
        text: "Hola, buenas tardes, bienvenido al Azahar. Dígame, ¿en qué le puedo ayudar?",
        meaning: "Hello, good afternoon, welcome to the Azahar. Tell me, how can I help?",
        forms: {
          feminine: "Hola, buenas tardes, bienvenida al Azahar. Dígame, ¿en qué le puedo ayudar?",
          neutral: "Hola, buenas tardes, le damos la bienvenida al Azahar. Dígame, ¿en qué le puedo ayudar?",
        },
      },
    ],
    immersion: [
      {
        text: "¡Buenas! Bienvenido, bienvenido. ¿Qué tal el viaje? ¿Tiene reserva con nosotros?",
        meaning: "Hi! Welcome! How was the trip? Do you have a reservation with us?",
        forms: {
          feminine: "¡Buenas! Bienvenida, bienvenida. ¿Qué tal el viaje? ¿Tiene reserva con nosotros?",
          neutral: "¡Buenas! Qué gusto recibirle. ¿Qué tal el viaje? ¿Tiene reserva con nosotros?",
        },
      },
      { text: "Buenas tardes, ¿qué tal? Dígame, ¿en qué le puedo ayudar?", meaning: "Good afternoon, how are you? Tell me, how can I help you?" },
    ],
  },
  makeVariant: (difficulty, rand) => ({
    issue: difficulty === "beginner" ? pick<Issue>(["not_found", "room_type"], rand) : pick<Issue>(["not_found", "room_type", "dates"], rand),
    room: pick(["214", "305", "412"], rand),
  }),
  persona:
    "You are Lucía, 34, the receptionist at Hotel Azahar, a small boutique hotel in the Santa Cruz quarter of Sevilla. You are professional, warm and patient, speak natural Castilian Spanish with an Andalusian warmth, and address guests with « usted ». Mateo, the bellhop, is nearby.",
  facts: (v) =>
    [
      "THE GUEST'S REAL BOOKING (what they actually paid for): double room, 2 nights (Friday to Sunday), breakfast included, confirmation number 4827, under the surname Morgan (accept any name the guest gives as theirs).",
      `THE PROBLEM IN YOUR SYSTEM TODAY: ${
        v.issue === "not_found"
          ? "the booking was typed in under a misspelled surname (\"Morgen\"), so searching by name finds nothing until they give the confirmation number, spell the name, or show the email."
          : v.issue === "room_type"
            ? "the booking shows a SINGLE room by mistake. The hotel's fault; the fix is a double room with a balcony at no extra charge."
            : "the booking shows only ONE night by mistake. The hotel's fault; the fix is extending it to two nights at the same price."
      }`,
      `Room assigned once resolved: ${v.room} (floor ${String(v.room)[0]}). Breakfast: 7:00–10:30 in the patio restaurant. Elevator: to the right, past the plants. Wi-Fi password: azahar2024.`,
      "A passport or ID is required to complete check-in (legally required guest registration).",
    ].join("\n"),
  asrKeywords: ["reserva", "check-in", "Morgan", "número de confirmación", "habitación doble", "dos noches", "pasaporte", "desayuno", "ascensor", "wifi"],
  vocabulary: [
    { term: "¿En qué puedo ayudarle?", meaning: "How can I help you?", stages: ["greeting"] },
    { term: "Tengo una reserva", meaning: "I have a reservation", stages: ["greeting"] },
    { term: "¿A nombre de quién?", meaning: "Under what name?", stages: ["name"] },
    { term: "el número de confirmación", meaning: "the confirmation number", stages: ["name", "issue"] },
    { term: "No encuentro…", meaning: "I can't find…", stages: ["issue"] },
    { term: "una habitación doble / individual", meaning: "a double / single room", stages: ["issue", "resolution"] },
    { term: "dos noches", meaning: "two nights", stages: ["issue", "resolution"] },
    { term: "Disculpe las molestias", meaning: "Sorry for the inconvenience", stages: ["resolution", "details"] },
    { term: "sin coste adicional", meaning: "at no extra charge", stages: ["resolution"] },
    { term: "¿Me permite su pasaporte?", meaning: "May I have your passport?", stages: ["details"] },
    { term: "Aquí tiene", meaning: "Here you are", stages: ["details"] },
    { term: "la llave / la tarjeta", meaning: "the key / the key card", stages: ["key"] },
    { term: "el desayuno", meaning: "breakfast", stages: ["details", "key"] },
    { term: "el ascensor", meaning: "the elevator", stages: ["key"] },
    { term: "¡Que disfrute de su estancia!", meaning: "Enjoy your stay!", stages: ["key"] },
  ],
  eventLines: {
    key_handed: () => ({ voice: "bellhop", text: "¡Yo le subo las maletas, no se preocupe!", meaning: "I'll take your bags up, don't worry!" }),
  },
  timeSkipText: "",
  successTitle: "¡Bienvenido a Sevilla!",
  successTitleForms: { feminine: "¡Bienvenida a Sevilla!", neutral: "¡Que disfrute de Sevilla!" },
  stages: [
    {
      id: "greeting",
      group: "Welcome",
      npcGoal: "Welcome the guest and ask how you can help.",
      meaning: "Good afternoon! How can I help you?",
      situation: "Lucía welcomed you to the hotel and asked how she can help.",
      cards: () => [
        card("has_reservation", "🛎️", "Say you have a reservation", {
          intent: "Tell her you have a reservation.",
          vocab: [
            { term: "tengo", meaning: "I have" },
            { term: "una reserva", meaning: "a reservation" },
          ],
          starter: "Buenas tardes, tengo…",
          full: "Buenas tardes, tengo una reserva.",
          fullMeaning: "Good afternoon, I have a reservation.",
        }, ["reserva", "tengo"]),
        card("greet", "👋", "Greet her back", {
          intent: "Return her greeting politely.",
          vocab: [{ term: "buenas tardes", meaning: "good afternoon" }],
          starter: "Buenas…",
          full: "¡Buenas tardes!",
          fullMeaning: "Good afternoon!",
        }, ["buenas tardes", "hola"]),
        card("has_reservation", "🧳", "Say you'd like to check in", {
          intent: "Say you'd like to check in.",
          vocab: [
            { term: "quisiera", meaning: "I would like" },
            { term: "hacer el check-in", meaning: "to check in" },
          ],
          starter: "Quisiera hacer…",
          full: "Quisiera hacer el check-in, por favor.",
          fullMeaning: "I'd like to check in, please.",
        }, ["quisiera", "check-in", "registrarme"], { key: "check_in" }),
      ],
      resolve: ({ report }) => {
        if (report.intent === "has_reservation")
          return advance("name", "Say « perfecto » and ask under what name the reservation is (¿A nombre de quién está la reserva?).", "Perfect. What name is the reservation under?");
        return null;
      },
    },
    {
      id: "name",
      group: "Reservation",
      npcGoal: "Ask under what name the reservation is.",
      meaning: "What name is the reservation under?",
      situation: "Lucía is asking what name the booking is under.",
      cards: () => [
        card("give_name", "🪪", "Give your name", {
          intent: "Tell her the name on the booking.",
          vocab: [
            { term: "a nombre de", meaning: "under the name of" },
            { term: "Alex Morgan", meaning: "(your name)" },
          ],
          starter: "A nombre de…",
          full: "A nombre de Alex Morgan.",
          fullMeaning: "Under the name Alex Morgan.",
        }, ["a nombre de", "nombre", "me llamo"]),
        giveConfirmation,
        card("ask_repeat", "🔁", "Ask her to repeat", {
          intent: "Politely ask her to say that again.",
          vocab: [
            { term: "¿Perdón?", meaning: "Sorry?" },
            { term: "¿puede repetir?", meaning: "can you repeat?" },
          ],
          starter: "Perdón, ¿puede…",
          full: "Perdón, ¿puede repetir, por favor?",
          fullMeaning: "Sorry, could you repeat that, please?",
        }, ["perdón", "repetir"]),
      ],
      resolve: ({ report, variant, slot }) => {
        const issue = variant.issue as Issue;
        if (report.intent === "give_name" || report.intent === "give_confirmation" || report.intent === "spell_name") {
          if (issue === "not_found" && report.intent === "give_confirmation")
            return advance(
              "details",
              "Type the number in, then smile: found it, the surname was misspelled in the system. Confirm: double room, two nights, breakfast included. Then ask for their passport (¿Me permite su pasaporte?).",
              "Found it! Your name was misspelled. Double room, two nights, breakfast included. May I have your passport?",
              { events: ["issue_found", "issue_resolved"], setSlots: { guest: slot("guest_name") || "given", resolved: "yes" } },
            );
          const d = ISSUE_DIRECTIVES[issue];
          return advance("issue", d.directive, d.meaning, {
            events: ["issue_found"],
            setSlots: { guest: slot("guest_name") || slot("confirmation_number") || "given" },
          });
        }
        return null;
      },
    },
    {
      id: "issue",
      group: "Problem",
      npcGoal: "Explain the problem you see in the system and ask the guest about it.",
      meaning: "There seems to be a problem with the reservation…",
      situation: "There's a problem with your reservation in the hotel's system. Listen to what Lucía says and sort it out.",
      cards: ({ variant }) => issueCards(variant.issue as Issue),
      resolve: ({ report, variant }) => {
        const issue = variant.issue as Issue;
        if (issue === "not_found") {
          if (["give_confirmation", "spell_name", "show_email", "give_name"].includes(report.intent))
            return advance(
              "details",
              "Found it now! Apologize, the surname was misspelled in the system (disculpe las molestias). Confirm: double room, two nights, breakfast included. Then ask for their passport.",
              "Found it! Sorry, your name was misspelled. Double room, two nights, breakfast included. May I have your passport?",
              { events: ["issue_resolved"], setSlots: { resolved: "yes" }, note: "You helped the receptionist find a 'missing' reservation." },
            );
          return null;
        }
        if (["explain_booking", "show_email"].includes(report.intent))
          return advance(
            "resolution",
            issue === "room_type"
              ? "Check again and apologize, it's the hotel's mistake. Offer a solution: a double room with a balcony (con balcón) at no extra charge. Ask if that's OK."
              : "Check again and apologize, it's the hotel's mistake. Say you've extended it to two nights at the same price. Ask if everything is OK now.",
            issue === "room_type"
              ? "You're right, our mistake, sorry! I can give you a double room with a balcony, no extra charge. Is that OK?"
              : "You're right, our mistake, sorry! I've extended it to two nights, same price. Is everything OK now?",
            { note: "You explained the problem clearly and got it fixed." },
          );
        if (report.intent === "ask_price")
          return stay("info", "issue", "Say normally a double costs 30 euros more per night, but first you'd like to check what they booked. Ask what their booking says.", "Normally it's 30 euros more per night, but what does your booking say?");
        if (report.intent === "ask_availability")
          return stay("info", "issue", "Say yes, there is availability, but ask what exactly they booked.", "Yes, there's availability, but what exactly did you book?");
        return null;
      },
    },
    {
      id: "resolution",
      group: "Problem",
      npcGoal: "Offer the fix for the reservation problem and ask if it's OK.",
      meaning: "Is that solution OK for you?",
      situation: "Lucía offered a fix. Accept it, or ask a question first.",
      cards: () => [
        card("accept", "✅", "Accept the solution", {
          intent: "Say that's perfect and thank her.",
          vocab: [
            { term: "perfecto", meaning: "perfect" },
            { term: "muchas gracias", meaning: "thank you very much" },
          ],
          starter: "Perfecto…",
          full: "Perfecto, muchas gracias.",
          fullMeaning: "Perfect, thank you very much.",
        }, ["perfecto", "gracias", "vale", "de acuerdo"]),
        card("ask_breakfast", "☕", "Ask if breakfast is still included", {
          intent: "Check that breakfast is still included.",
          vocab: [
            { term: "el desayuno", meaning: "breakfast" },
            { term: "incluido", meaning: "included" },
          ],
          starter: "¿El desayuno…",
          full: "¿El desayuno sigue incluido?",
          fullMeaning: "Is breakfast still included?",
        }, ["desayuno", "incluido"]),
        card("ask_price", "💶", "Check there's no extra cost", {
          intent: "Double-check there's no extra cost.",
          vocab: [
            { term: "coste adicional", meaning: "extra cost" },
            { term: "¿tiene…?", meaning: "does it have…?" },
          ],
          starter: "¿Tiene algún…",
          full: "¿Tiene algún coste adicional?",
          fullMeaning: "Is there any extra cost?",
        }, ["coste", "adicional", "pagar"]),
      ],
      resolve: ({ report }) => {
        if (report.intent === "accept" || report.intent === "thanks")
          return advance("details", "Say « estupendo » and ask for their passport or ID to complete the check-in (¿Me permite su pasaporte?).", "Great. May I have your passport, please?", {
            events: ["issue_resolved"],
            setSlots: { resolved: "yes" },
          });
        if (report.intent === "ask_breakfast")
          return stay("info", "resolution", "Confirm breakfast is included, 7:00 to 10:30 in the patio. Ask if the solution is OK.", "Yes, breakfast is included, 7 to 10:30. Is that all OK?");
        if (report.intent === "ask_price")
          return stay("info", "resolution", "Confirm there's no extra cost at all (sin coste adicional). Ask if it's OK.", "No extra cost at all. Is that OK?");
        return null;
      },
    },
    {
      id: "details",
      group: "Check-in",
      npcGoal: "Ask for their passport or ID to complete the check-in.",
      meaning: "May I have your passport, please?",
      situation: "Lucía needs your passport to finish the check-in.",
      cards: () => [
        card("give_passport", "🛂", "Hand over your passport", {
          intent: "Give her your passport and say 'here you are'.",
          vocab: [
            { term: "aquí tiene", meaning: "here you are" },
            { term: "el pasaporte", meaning: "the passport" },
          ],
          starter: "Sí, aquí…",
          full: "Sí, claro. Aquí tiene.",
          fullMeaning: "Yes, of course. Here you are.",
        }, ["aquí tiene", "claro", "pasaporte"]),
        card("ask_why", "❓", "Ask why she needs it", {
          intent: "Politely ask why she needs your passport.",
          vocab: [
            { term: "¿para qué…?", meaning: "what for…?" },
            { term: "lo necesita", meaning: "you need it" },
          ],
          starter: "¿Para qué…",
          full: "¿Para qué lo necesita?",
          fullMeaning: "What do you need it for?",
        }, ["para qué", "necesita"]),
        card("ask_breakfast", "⏰", "Ask what time breakfast is", {
          intent: "Ask what time breakfast is served.",
          vocab: [
            { term: "¿a qué hora…?", meaning: "at what time…?" },
            { term: "el desayuno", meaning: "breakfast" },
          ],
          starter: "¿A qué hora…",
          full: "¿A qué hora es el desayuno?",
          fullMeaning: "What time is breakfast?",
        }, ["a qué hora", "desayuno"]),
      ],
      resolve: ({ report, variant }) => {
        if (report.intent === "give_passport")
          return advance(
            "key",
            `Thank them, hand the passport back with the key card: room ${variant.room}, floor ${String(variant.room)[0]}. Mention breakfast is 7:00–10:30 in the patio. Wish them a pleasant stay.`,
            `Thank you. Here's your key, room ${variant.room}. Breakfast is 7 to 10:30. Enjoy your stay!`,
            { events: ["passport_given", "key_handed"], objectiveComplete: true, setSlots: { passport: "yes" } },
          );
        if (report.intent === "ask_why")
          return stay("info", "details", "Explain briefly that it's required by law to register guests, then ask again for the passport.", "It's required by law to register guests. May I have it?");
        if (report.intent === "ask_breakfast")
          return stay("info", "details", "Say breakfast is 7:00–10:30 in the patio, then ask again for the passport.", "Breakfast is 7 to 10:30 in the patio. And your passport, please?");
        return null;
      },
    },
    {
      id: "key",
      group: "Check-in",
      npcGoal: "Answer any last questions and wish them a pleasant stay.",
      meaning: "Here's your key. Enjoy your stay!",
      situation: "You've got your key! Ask a last question, or thank Lucía.",
      cards: () => [
        card("thanks", "🙏", "Thank her", {
          intent: "Thank her warmly.",
          vocab: [{ term: "muchas gracias", meaning: "thank you very much" }, { term: "muy amable", meaning: "very kind" }],
          starter: "Muchas…",
          full: "¡Muchas gracias, muy amable!",
          fullMeaning: "Thank you very much, that's very kind!",
        }, ["gracias", "amable"]),
        card("ask_elevator", "🛗", "Ask where the elevator is", {
          intent: "Ask where the elevator is.",
          vocab: [{ term: "¿dónde está…?", meaning: "where is…?" }, { term: "el ascensor", meaning: "the elevator" }],
          starter: "¿Dónde está…",
          full: "¿Dónde está el ascensor?",
          fullMeaning: "Where is the elevator?",
        }, ["dónde", "ascensor"]),
        card("ask_wifi", "📶", "Ask for the Wi-Fi password", {
          intent: "Ask what the Wi-Fi password is.",
          vocab: [{ term: "la contraseña", meaning: "the password" }, { term: "del wifi", meaning: "of the Wi-Fi" }],
          starter: "¿Cuál es la…",
          full: "¿Cuál es la contraseña del wifi?",
          fullMeaning: "What's the Wi-Fi password?",
        }, ["contraseña", "wifi"]),
      ],
      resolve: ({ report }) => {
        if (["thanks", "goodbye", "accept", "greet"].includes(report.intent))
          return complete("key", "Say a warm final goodbye in one short sentence (e.g. « ¡A usted! Que disfrute de Sevilla. »).", "You're welcome! Enjoy Sevilla!");
        if (report.intent === "ask_elevator")
          return stay("info", "key", "Say the elevator is to the right, past the plants.", "The elevator is to the right, past the plants.");
        if (report.intent === "ask_wifi")
          return stay("info", "key", "Say the Wi-Fi password is « azahar2024 », it's also on the key card holder.", "The password is azahar2024. It's on your key card holder too.");
        return null;
      },
    },
  ],
};
