import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { card } from "./helpers";
import type { IntentCard, Outcome, ScenarioDef } from "./types";

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

/** Found it: the surname was misspelled in the system (the "not found" problem, solved). */
function found(intent: string) {
  return {
    directive: `${
      intent === "spell_name"
        ? "Type just the first letters (M-O-R-G) and find a booking under « Morgen »: that's it, the surname was misspelled in the system."
        : "Found it now! The surname was misspelled in the system."
    } Apologize (disculpe las molestias). Confirm: double room, two nights, breakfast included. Then ask for their passport.`,
    meaning: "Found it! Sorry, your name was misspelled. Double room, two nights, breakfast included. May I have your passport?",
  };
}

/** Once the guest has said who they are (name, number, phone…): she looks the booking up. */
function lookUp(intent: string, issue: Issue, guest: string): Outcome {
  const setSlots = { guest: guest || "given" };
  if (issue === "not_found") {
    // The number (or the email showing it) finds the booking straight away, even misspelled.
    if (intent === "give_confirmation" || intent === "show_email")
      return advance(
        "details",
        "Type the number in, then smile: found it, the surname was misspelled in the system. Confirm: double room, two nights, breakfast included. Then ask for their passport (¿Me permite su pasaporte?).",
        "Found it! Your name was misspelled. Double room, two nights, breakfast included. May I have your passport?",
        { events: ["issue_found", "issue_resolved"], setSlots: { ...setSlots, resolved: "yes" } },
      );
    // They already spelled it: she typed it exactly, and it still isn't there.
    if (intent === "spell_name")
      return advance(
        "issue",
        "Type the surname in letter by letter as they spelled it, then frown slightly: still no reservation under that name. Ask for the confirmation number or the confirmation email.",
        "I typed it exactly… still nothing under that name. Do you have the confirmation number or the email?",
        { events: ["issue_found"], setSlots, setFlags: { spelled: true } },
      );
  } else if (intent === "show_email") {
    // Their booking is right there on the phone: she sees the mismatch herself.
    const single = issue === "room_type";
    return advance(
      "resolution",
      `Look at the booking on their phone, then at your screen: your system shows ${single ? "a SINGLE room" : "only ONE night"}, but their booking says ${single ? "a double" : "two nights"}. Apologize, it's the hotel's mistake, and ${single ? "offer a double room with a balcony (con balcón) at no extra charge. Ask if that's OK." : "say you've extended it to two nights at the same price. Ask if everything is OK now."}`,
      single
        ? "Your booking says a double, but I have a single… our mistake, sorry! A double with a balcony, no extra charge. Is that OK?"
        : "Your booking says two nights, but I have one… our mistake, sorry! I've extended it to two nights, same price. Is that OK?",
      { events: ["issue_found"], setSlots, note: "Showing your booking straight away sorted the problem out." },
    );
  }
  const d = ISSUE_DIRECTIVES[issue];
  return advance("issue", d.directive, d.meaning, { events: ["issue_found"], setSlots });
}

const giveConfirmation: IntentCard = card("give_confirmation", "🔢", "Give your confirmation number", {
  intent: "Read out your confirmation number: 4827.",
  vocab: [
    { term: "el número de confirmación", meaning: "the confirmation number" },
    { term: "cuatro, ocho, dos, siete", meaning: "four, eight, two, seven" },
  ],
  starter: "El número de confirmación es…",
  full: "El número de confirmación es cuatro, ocho, dos, siete.",
  fullMeaning: "The confirmation number is 4-8-2-7.",
}, ["número", "confirmación", "cuatro", "ocho", "dos", "siete"], { core: true });

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
}, ["correo", "confirmación", "email", "tengo"], { core: true });

const spellName: IntentCard = card("spell_name", "🔤", "Spell your surname", {
  intent: "Spell your surname letter by letter.",
  vocab: [
    { term: "se escribe", meaning: "it's spelled" },
    { term: "eme, o, erre, ge, a, ene", meaning: "M, O, R, G, A, N (Spanish letter names)" },
  ],
  starter: "Se escribe…",
  full: "Se escribe eme, o, erre, ge, a, ene.",
  fullMeaning: "It's spelled M-O-R-G-A-N.",
}, ["se escribe", "eme", "erre", "ene"], { core: true });

const checkAgain: IntentCard = card("ask_check_again", "🔎", "Ask her to check again", {
  intent: "Politely ask her to look again.",
  vocab: [
    { term: "mirarlo", meaning: "to look at it" },
    { term: "otra vez", meaning: "again" },
  ],
  starter: "¿Puede mirarlo…",
  full: "¿Puede mirarlo otra vez, por favor?",
  fullMeaning: "Could you look again, please?",
}, ["otra vez", "mirar", "mirarlo"]);

function issueCards(issue: Issue, flags: Record<string, boolean>): IntentCard[] {
  if (issue === "not_found")
    return [
      giveConfirmation,
      // Already spelled out at the name step: not offered twice.
      ...(flags.spelled ? [] : [spellName]),
      showEmail,
      card("give_name", "🪪", "Suggest it might be under your first name", {
        intent: "Suggest she try your first name: the booking may be under « Alex ».",
        vocab: [
          { term: "puede que esté", meaning: "it may be" },
          { term: "a nombre de", meaning: "under the name of" },
        ],
        starter: "Puede que esté a nombre…",
        full: "Puede que esté a nombre de Alex.",
        fullMeaning: "It may be under Alex.",
      }, ["a nombre de", "alex", "puede que"], { key: "first_name", core: true }),
      card("explain_booking", "🛏️", "Describe your booking: a double, Friday to Sunday", {
        intent: "Help her search by what you booked: a double room, from Friday to Sunday.",
        vocab: [
          { term: "una habitación doble", meaning: "a double room" },
          { term: "del viernes al domingo", meaning: "from Friday to Sunday" },
        ],
        starter: "Es una habitación doble…",
        full: "Es una habitación doble, del viernes al domingo.",
        fullMeaning: "It's a double room, from Friday to Sunday.",
      }, ["doble", "viernes", "domingo"], { key: "describe", expect: { room_type: "double" }, core: true }),
      checkAgain,
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
        starter: "Perdone, pero…",
        full: "Perdone, pero reservé una habitación doble.",
        fullMeaning: "Excuse me, but I booked a double room.",
      }, ["reservé", "doble", "habitación"], { expect: { room_type: "double" }, core: true }),
      card("explain_booking", "⚠️", "Say there's a mistake: you booked a double", {
        intent: "Tell her you think there's a mistake, because you booked a double.",
        vocab: [
          { term: "creo que", meaning: "I think (that)" },
          { term: "hay un error", meaning: "there's a mistake" },
          { term: "una doble", meaning: "a double (room)" },
        ],
        starter: "Creo que hay un error…",
        full: "Creo que hay un error: reservé una doble.",
        fullMeaning: "I think there's a mistake: I booked a double.",
      }, ["error", "doble", "reservé"], { key: "mistake", expect: { room_type: "double" }, core: true }),
      showEmail,
      giveConfirmation,
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
      card("ask_availability", "❓", "Ask if there's a double room free", {
        intent: "Ask whether there's a double room available.",
        vocab: [
          { term: "¿hay alguna…?", meaning: "is there any…?" },
          { term: "libre", meaning: "free / available" },
        ],
        starter: "¿Hay alguna habitación…",
        full: "¿Hay alguna habitación doble libre?",
        fullMeaning: "Is there a double room free?",
      }, ["libre", "hay", "disponible"]),
      checkAgain,
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
    }, ["dos noches", "domingo", "reservé"], { expect: { nights: "2" }, core: true }),
    card("explain_booking", "🧳", "Say you're leaving on Sunday", {
      intent: "Tell her you're leaving on Sunday: it's two nights.",
      vocab: [
        { term: "me voy", meaning: "I'm leaving" },
        { term: "el domingo", meaning: "on Sunday" },
        { term: "son dos noches", meaning: "it's two nights" },
      ],
      starter: "Me voy el domingo…",
      full: "Me voy el domingo, son dos noches.",
      fullMeaning: "I'm leaving on Sunday, it's two nights.",
    }, ["domingo", "me voy", "dos noches"], { key: "sunday", expect: { nights: "2" }, core: true }),
    showEmail,
    giveConfirmation,
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
    card("ask_price", "💶", "Ask how much another night would cost", {
      intent: "Ask what a second night would cost.",
      vocab: [
        { term: "¿cuánto costaría…?", meaning: "how much would… cost?" },
        { term: "otra noche", meaning: "another night" },
      ],
      starter: "¿Cuánto costaría…",
      full: "¿Cuánto costaría otra noche?",
      fullMeaning: "How much would another night cost?",
    }, ["cuánto", "costaría", "noche"], { key: "extra_night" }),
    checkAgain,
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
  randomizeCards: true,
  requiredSlots: ["guest", "resolved", "passport"],
  intents: {
    has_reservation: "Says they have a reservation / want to check in (fill `guest_name` if they say whose name it's under)",
    give_name: "Gives the name the reservation is under (fill `guest_name`)",
    give_confirmation: "Gives a confirmation number (fill `confirmation_number`)",
    spell_name: "Spells their name letter by letter (fill `guest_name`)",
    show_email: "Offers to show the confirmation email / booking on their phone",
    ask_check_again: "Asks you to check / look again",
    explain_booking: "Explains what they actually booked (fill `room_type` and/or `nights`)",
    ask_price: "Asks about price / extra charges / whether they have to pay now",
    ask_availability: "Asks if a room / night is available",
    accept: "Accepts the proposed solution (OK, perfect, thanks)",
    ask_room_details: "Asks about the room itself (balcony, view, quiet, floor)",
    ask_checkout_time: "Asks what time check-out is",
    give_passport: "Hands over passport/ID (aquí tiene)",
    offer_other_id: "Offers another document instead of a passport (e.g. a driver's licence)",
    ask_why: "Asks why something is needed",
    ask_luggage: "Asks about their luggage (leave bags, help carrying them)",
    ask_breakfast: "Asks about breakfast (time / place / included)",
    ask_elevator: "Asks where the elevator/room is",
    ask_wifi: "Asks for the wifi password",
    ask_recommendation: "Asks for a recommendation (tapas, a restaurant, what to see)",
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
      "THE GUEST'S REAL BOOKING (what they actually paid for): double room, 2 nights (Friday to Sunday), breakfast included, confirmation number 4827, under the surname Morgan (accept any name the guest gives as theirs). The stay was paid online in advance: nothing to pay at check-in.",
      `THE PROBLEM IN YOUR SYSTEM TODAY: ${
        v.issue === "not_found"
          ? "the booking was typed in under a misspelled surname (\"Morgen\"), so searching by name finds nothing until they give the confirmation number, spell the name, try their first name, describe the booking, or show the email."
          : v.issue === "room_type"
            ? "the booking shows a SINGLE room by mistake. The hotel's fault; the fix is a double room with a small balcony over the patio, at no extra charge."
            : "the booking shows only ONE night by mistake. The hotel's fault; the fix is extending it to two nights at the same price."
      }`,
      `Room assigned once resolved: ${v.room} (floor ${String(v.room)[0]}), quiet, overlooking the inner patio. Breakfast: 7:00–10:30 in the patio restaurant. Check-out: Sunday by 12:00. Elevator: to the right, past the plants. Wi-Fi password: azahar2024.`,
      "Normal prices: a double costs 30 € more per night than a single; an extra night is 110 €.",
      "A passport or national ID card is required to complete check-in (legally required guest registration); a driver's licence isn't valid for it.",
      "Luggage: Mateo, the bellhop, can take the bags up to the room or keep them at the desk. Nearby: Bodega Santa Cruz, a lively tapas bar two minutes' walk away.",
    ].join("\n"),
  asrKeywords: [
    "reserva", "check-in", "Morgan", "número de confirmación", "habitación doble", "dos noches", "pasaporte", "desayuno",
    "ascensor", "wifi", "maletas", "salida", "balcón", "carné de conducir", "tapas",
  ],
  vocabulary: [
    { term: "¿En qué puedo ayudarle?", meaning: "How can I help you?", stages: ["greeting"] },
    { term: "Tengo una reserva", meaning: "I have a reservation", stages: ["greeting"] },
    { term: "las maletas", meaning: "the suitcases / luggage", stages: ["greeting", "details"] },
    { term: "¿A nombre de quién?", meaning: "Under what name?", stages: ["name"] },
    { term: "el número de confirmación", meaning: "the confirmation number", stages: ["name", "issue"] },
    { term: "No encuentro…", meaning: "I can't find…", stages: ["issue"] },
    { term: "otra vez", meaning: "again", stages: ["issue"] },
    { term: "una habitación doble / individual", meaning: "a double / single room", stages: ["issue", "resolution"] },
    { term: "dos noches", meaning: "two nights", stages: ["issue", "resolution"] },
    { term: "Creo que hay un error", meaning: "I think there's a mistake", stages: ["issue"] },
    { term: "Disculpe las molestias", meaning: "Sorry for the inconvenience", stages: ["resolution", "details"] },
    { term: "sin coste adicional", meaning: "at no extra charge", stages: ["resolution"] },
    { term: "el balcón", meaning: "the balcony", stages: ["resolution"] },
    { term: "la salida", meaning: "check-out (lit. the departure)", stages: ["resolution", "key"] },
    { term: "¿Me permite su pasaporte?", meaning: "May I have your passport?", stages: ["details"] },
    { term: "Aquí tiene", meaning: "Here you are", stages: ["details"] },
    { term: "el carné de conducir", meaning: "driver's licence", stages: ["details"] },
    { term: "la llave / la tarjeta", meaning: "the key / the key card", stages: ["key"] },
    { term: "el desayuno", meaning: "breakfast", stages: ["details", "key"] },
    { term: "el ascensor", meaning: "the elevator", stages: ["key"] },
    { term: "¿Me recomienda…?", meaning: "Can you recommend…?", stages: ["key"] },
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
        }, ["reserva", "tengo"], { core: true }),
        card("has_reservation", "🧳", "Say you'd like to check in", {
          intent: "Say you'd like to check in.",
          vocab: [
            { term: "quisiera", meaning: "I would like" },
            { term: "hacer el check-in", meaning: "to check in" },
          ],
          starter: "Quisiera hacer…",
          full: "Quisiera hacer el check-in, por favor.",
          fullMeaning: "I'd like to check in, please.",
        }, ["quisiera", "check-in", "registrarme"], { key: "check_in", core: true }),
        card("has_reservation", "🪪", "Say you have a reservation under your name", {
          intent: "Tell her you have a reservation, and give the name it's under.",
          vocab: [
            { term: "una reserva", meaning: "a reservation" },
            { term: "a nombre de", meaning: "under the name of" },
          ],
          starter: "Tengo una reserva a nombre…",
          full: "Tengo una reserva a nombre de Alex Morgan.",
          fullMeaning: "I have a reservation under the name Alex Morgan.",
        }, ["reserva", "a nombre de"], { key: "with_name", core: true }),
        card("has_reservation", "💻", "Say you booked a room online", {
          intent: "Tell her you booked a room online.",
          vocab: [
            { term: "reservé", meaning: "I booked" },
            { term: "por internet", meaning: "online" },
          ],
          starter: "Hola, reservé…",
          full: "Hola, reservé una habitación por internet.",
          fullMeaning: "Hi, I booked a room online.",
        }, ["reservé", "internet", "habitación"], { key: "online", core: true }),
        card("greet", "👋", "Greet her back", {
          intent: "Return her greeting politely.",
          vocab: [{ term: "buenas tardes", meaning: "good afternoon" }],
          starter: "Buenas…",
          full: "¡Buenas tardes!",
          fullMeaning: "Good afternoon!",
        }, ["buenas tardes", "hola"]),
        card("greet", "😊", "Greet her and ask how she is", {
          intent: "Say good afternoon and ask how she's doing.",
          vocab: [
            { term: "buenas tardes", meaning: "good afternoon" },
            { term: "¿qué tal?", meaning: "how are you?" },
          ],
          starter: "Buenas tardes, ¿qué…",
          full: "Buenas tardes, ¿qué tal?",
          fullMeaning: "Good afternoon, how are you?",
        }, ["qué tal", "buenas tardes"], { key: "que_tal" }),
        card("ask_luggage", "🧳", "Ask if you can leave your bags here", {
          intent: "Ask if you can leave your suitcases at the desk for a moment.",
          vocab: [
            { term: "dejar", meaning: "to leave" },
            { term: "las maletas", meaning: "the suitcases" },
          ],
          starter: "¿Puedo dejar…",
          full: "¿Puedo dejar las maletas aquí un momento?",
          fullMeaning: "Can I leave my bags here for a moment?",
        }, ["maletas", "dejar"]),
      ],
      // « Sí » to « ¿Tiene reserva con nosotros? ».
      aliases: { yes: "has_reservation" },
      resolve: ({ report, variant, slot }) => {
        if (report.intent === "has_reservation") {
          // They already said whose name it's under: she looks it up straight away.
          if (slot("guest_name")) return lookUp("give_name", variant.issue as Issue, slot("guest_name"));
          return advance("name", "Say « perfecto » and ask under what name the reservation is (¿A nombre de quién está la reserva?).", "Perfect. What name is the reservation under?");
        }
        if (report.intent === "ask_luggage")
          return stay(
            "info",
            "greeting",
            "Say of course, Mateo (the bellhop) will look after the bags, then ask how you can help: do they have a reservation?",
            "Of course, Mateo will take care of them. Do you have a reservation?",
          );
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
        }, ["a nombre de", "nombre", "me llamo"], { core: true }),
        card("give_name", "🙋", "Introduce yourself", {
          intent: "Tell her your name.",
          vocab: [{ term: "me llamo", meaning: "my name is" }],
          starter: "Me llamo…",
          full: "Me llamo Alex Morgan.",
          fullMeaning: "My name is Alex Morgan.",
        }, ["me llamo", "morgan"], { key: "me_llamo", core: true }),
        giveConfirmation,
        card("spell_name", "🔤", "Give your surname and spell it", {
          intent: "Say your surname, then spell it letter by letter.",
          vocab: [
            { term: "se escribe", meaning: "it's spelled" },
            { term: "eme, o, erre, ge, a, ene", meaning: "M, O, R, G, A, N" },
          ],
          starter: "Morgan. Se escribe…",
          full: "Morgan. Se escribe eme, o, erre, ge, a, ene.",
          fullMeaning: "Morgan. It's spelled M-O-R-G-A-N.",
        }, ["se escribe", "morgan", "eme"], { key: "spell_surname", core: true }),
        card("show_email", "📱", "Show her the booking on your phone", {
          intent: "Show her the booking confirmation on your phone.",
          vocab: [
            { term: "aquí tiene", meaning: "here you are" },
            { term: "en el móvil", meaning: "on my phone" },
          ],
          starter: "Aquí tiene la reserva…",
          full: "Aquí tiene la reserva en el móvil.",
          fullMeaning: "Here's the booking on my phone.",
        }, ["móvil", "reserva", "aquí tiene"], { key: "phone", core: true }),
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
        card("ask_meaning", "💬", "Ask what « a nombre de » means", {
          intent: "You didn't understand part of her question. Ask what « a nombre de » means.",
          vocab: [
            { term: "¿Qué significa…?", meaning: "What does… mean?" },
            { term: "a nombre de", meaning: "(the words you didn't get)" },
          ],
          starter: "¿Qué significa…",
          full: "¿Qué significa « a nombre de »?",
          fullMeaning: "What does « a nombre de » mean?",
        }, ["significa", "a nombre de"]),
      ],
      resolve: ({ report, variant, slot }) => {
        if (["give_name", "give_confirmation", "spell_name", "show_email"].includes(report.intent))
          return lookUp(report.intent, variant.issue as Issue, slot("guest_name") || slot("confirmation_number"));
        return null;
      },
    },
    {
      id: "issue",
      group: "Problem",
      npcGoal: "Explain the problem you see in the system and ask the guest about it.",
      meaning: "There seems to be a problem with the reservation…",
      situation: "There's a problem with your reservation in the hotel's system. Listen to what Lucía says and sort it out.",
      cards: ({ variant, state }) => issueCards(variant.issue as Issue, state.flags),
      resolve: ({ report, variant, state }) => {
        const issue = variant.issue as Issue;
        if (report.intent === "ask_check_again") {
          // They've already spelled it for her: don't ask for that again.
          const ask = state.flags.spelled ? "the confirmation number or the confirmation email" : "the confirmation number, or for them to spell the surname";
          return stay(
            "info",
            "issue",
            issue === "not_found"
              ? `Type the name again, then shake your head kindly: still nothing under that name. Ask for ${ask}.`
              : `Check the screen again: it still shows ${issue === "room_type" ? "a single room" : "only one night"}. Ask what exactly they booked.`,
            issue === "not_found"
              ? state.flags.spelled
                ? "Still nothing, sorry. Do you have the confirmation number or the email?"
                : "Still nothing, sorry. Do you have the confirmation number, or can you spell the surname?"
              : `It still shows ${issue === "room_type" ? "a single room" : "just one night"}. What exactly did you book?`,
          );
        }
        if (issue === "not_found") {
          if (["give_confirmation", "spell_name", "show_email", "give_name", "explain_booking"].includes(report.intent)) {
            const f = found(report.intent);
            return advance("details", f.directive, f.meaning, {
              events: ["issue_resolved"],
              setSlots: { resolved: "yes" },
              note: "You helped the receptionist find a 'missing' reservation.",
            });
          }
          return null;
        }
        if (["explain_booking", "show_email", "give_confirmation"].includes(report.intent))
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
          return issue === "dates"
            ? stay("info", "issue", "Say an extra night is normally 110 euros, but first you'd like to check what they booked. Ask what their booking says.", "Normally 110 euros a night, but what does your booking say?")
            : stay("info", "issue", "Say normally a double costs 30 euros more per night, but first you'd like to check what they booked. Ask what their booking says.", "Normally it's 30 euros more per night, but what does your booking say?");
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
      cards: ({ variant }) => [
        card("accept", "✅", "Accept the solution", {
          intent: "Say that's perfect and thank her.",
          vocab: [
            { term: "perfecto", meaning: "perfect" },
            { term: "muchas gracias", meaning: "thank you very much" },
          ],
          starter: "Perfecto…",
          full: "Perfecto, muchas gracias.",
          fullMeaning: "Perfect, thank you very much.",
        }, ["perfecto", "gracias", "vale", "de acuerdo"], { core: true }),
        card("accept", "🙌", "Thank her for sorting it out", {
          intent: "Say that's great, and thank her for fixing it.",
          vocab: [
            { term: "genial", meaning: "great" },
            { term: "solucionarlo", meaning: "to sort it out" },
          ],
          starter: "Genial, gracias por…",
          full: "Genial, gracias por solucionarlo.",
          fullMeaning: "Great, thanks for sorting it out.",
        }, ["genial", "solucionarlo", "gracias"], { key: "genial", core: true }),
        card("accept", "👌", "Say that's fine", {
          intent: "Accept, simply: that works for you.",
          vocab: [
            { term: "vale", meaning: "OK (very common in Spain)" },
            { term: "de acuerdo", meaning: "agreed / all right" },
          ],
          starter: "Vale…",
          full: "Vale, de acuerdo.",
          fullMeaning: "OK, fine.",
        }, ["vale", "de acuerdo"], { key: "vale", core: true }),
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
        variant.issue === "room_type"
          ? card("ask_room_details", "🌿", "Ask if the room has a balcony", {
              intent: "Ask whether the new room has a balcony.",
              vocab: [
                { term: "la habitación", meaning: "the room" },
                { term: "el balcón", meaning: "the balcony" },
              ],
              starter: "¿La habitación tiene…",
              full: "¿La habitación tiene balcón?",
              fullMeaning: "Does the room have a balcony?",
            }, ["balcón", "habitación"])
          : card("ask_room_details", "🤫", "Ask if the room is quiet", {
              intent: "Ask whether the room is quiet.",
              vocab: [
                { term: "tranquila", meaning: "quiet / calm" },
                { term: "una habitación", meaning: "a room" },
              ],
              starter: "¿Es una habitación…",
              full: "¿Es una habitación tranquila?",
              fullMeaning: "Is it a quiet room?",
            }, ["tranquila", "habitación"]),
        card("ask_checkout_time", "🕛", "Ask what time check-out is", {
          intent: "Ask what time you have to check out.",
          vocab: [
            { term: "¿a qué hora…?", meaning: "at what time…?" },
            { term: "la salida", meaning: "check-out (lit. the departure)" },
          ],
          starter: "¿A qué hora es…",
          full: "¿A qué hora es la salida?",
          fullMeaning: "What time is check-out?",
        }, ["salida", "a qué hora", "check-out"]),
      ],
      // « Sí » to « ¿Le parece bien? ».
      aliases: { yes: "accept" },
      resolve: ({ report, variant }) => {
        if (report.intent === "accept" || report.intent === "thanks")
          return advance("details", "Say « estupendo » and ask for their passport or ID to complete the check-in (¿Me permite su pasaporte?).", "Great. May I have your passport, please?", {
            events: ["issue_resolved"],
            setSlots: { resolved: "yes" },
          });
        if (report.intent === "ask_breakfast")
          return stay("info", "resolution", "Confirm breakfast is included, 7:00 to 10:30 in the patio. Ask if the solution is OK.", "Yes, breakfast is included, 7 to 10:30. Is that all OK?");
        if (report.intent === "ask_price")
          return stay("info", "resolution", "Confirm there's no extra cost at all (sin coste adicional). Ask if it's OK.", "No extra cost at all. Is that OK?");
        if (report.intent === "ask_room_details")
          return variant.issue === "room_type"
            ? stay("info", "resolution", "Say yes, it has a small balcony over the patio, very pretty with the orange trees. Ask if the solution is OK.", "Yes, a little balcony over the patio. Is that OK for you?")
            : stay("info", "resolution", "Say yes, very quiet: it looks onto the inner patio, away from the street. Ask if everything is OK now.", "Yes, very quiet, it's on the inner patio. Is everything OK now?");
        if (report.intent === "ask_checkout_time")
          return stay("info", "resolution", "Say check-out is on Sunday, before 12 noon. Ask if the solution is OK.", "Check-out is Sunday, before noon. Is that all OK?");
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
          starter: "Sí, claro…",
          full: "Sí, claro. Aquí tiene.",
          fullMeaning: "Yes, of course. Here you are.",
        }, ["aquí tiene", "claro", "pasaporte"], { core: true }),
        card("give_passport", "📘", "Say here's your passport", {
          intent: "Hand it over and say it's your passport.",
          vocab: [
            { term: "aquí tiene", meaning: "here you are" },
            { term: "mi pasaporte", meaning: "my passport" },
          ],
          starter: "Aquí tiene mi…",
          full: "Aquí tiene mi pasaporte.",
          fullMeaning: "Here's my passport.",
        }, ["pasaporte", "aquí tiene"], { key: "my_passport", core: true }),
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
        card("offer_other_id", "🚗", "Ask if your driver's licence will do", {
          intent: "Your passport is deep in your suitcase. Ask if your driver's licence would do instead.",
          vocab: [
            { term: "¿le vale…?", meaning: "will… do for you?" },
            { term: "el carné de conducir", meaning: "driver's licence" },
          ],
          starter: "¿Le vale el carné…",
          full: "¿Le vale el carné de conducir?",
          fullMeaning: "Will my driver's licence do?",
        }, ["carné", "conducir"]),
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
        card("ask_luggage", "🧳", "Ask if someone can help with your bags", {
          intent: "Ask if someone can help you with your suitcases.",
          vocab: [
            { term: "¿me pueden ayudar…?", meaning: "can you help me…?" },
            { term: "las maletas", meaning: "the suitcases" },
          ],
          starter: "¿Me pueden ayudar…",
          full: "¿Me pueden ayudar con las maletas?",
          fullMeaning: "Could someone help me with my bags?",
        }, ["maletas", "ayudar"]),
        card("ask_price", "💳", "Ask if you need to pay anything now", {
          intent: "Ask whether you have to pay anything now.",
          vocab: [
            { term: "¿tengo que…?", meaning: "do I have to…?" },
            { term: "pagar algo", meaning: "pay something" },
          ],
          starter: "¿Tengo que pagar…",
          full: "¿Tengo que pagar algo ahora?",
          fullMeaning: "Do I need to pay anything now?",
        }, ["pagar", "ahora"], { key: "pay_now" }),
      ],
      // « Sí » to « ¿Me permite su pasaporte? » comes with the passport.
      aliases: { yes: "give_passport" },
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
        if (report.intent === "offer_other_id")
          return stay(
            "info",
            "details",
            "Apologize kindly: for the legal registration you need a passport or a national ID card, a driver's licence isn't valid. Ask if they have their passport.",
            "Sorry, I need a passport or national ID card, a driver's licence won't do. Do you have your passport?",
          );
        if (report.intent === "ask_breakfast")
          return stay("info", "details", "Say breakfast is 7:00–10:30 in the patio, then ask again for the passport.", "Breakfast is 7 to 10:30 in the patio. And your passport, please?");
        if (report.intent === "ask_luggage")
          return stay("info", "details", "Say of course, Mateo will take the bags up to the room, then ask again for the passport.", "Of course, Mateo will take them up. And your passport, please?");
        if (report.intent === "ask_price")
          return stay("info", "details", "Say no, everything was paid online, there's nothing to pay. You just need their passport.", "No, it's all paid. I just need your passport.");
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
        }, ["gracias", "amable"], { core: true }),
        card("thanks", "💐", "Thank her for everything", {
          intent: "Thank her for all her help.",
          vocab: [{ term: "gracias por todo", meaning: "thanks for everything" }],
          starter: "¡Gracias por…",
          full: "¡Gracias por todo!",
          fullMeaning: "Thanks for everything!",
        }, ["gracias", "todo"], { key: "for_everything", core: true }),
        card("goodbye", "👋", "Say see you later", {
          intent: "Say goodbye as you head to your room.",
          vocab: [{ term: "hasta luego", meaning: "see you later" }],
          starter: "Hasta…",
          full: "Hasta luego, ¡gracias!",
          fullMeaning: "See you later, thanks!",
        }, ["hasta luego", "gracias"], { core: true }),
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
        card("ask_recommendation", "🍤", "Ask her to recommend a tapas bar", {
          intent: "Ask Lucía to recommend a tapas bar nearby.",
          vocab: [
            { term: "¿me recomienda…?", meaning: "can you recommend…?" },
            { term: "un bar de tapas", meaning: "a tapas bar" },
            { term: "por aquí", meaning: "around here" },
          ],
          starter: "¿Me recomienda algún…",
          full: "¿Me recomienda algún bar de tapas por aquí?",
          fullMeaning: "Can you recommend a tapas bar around here?",
        }, ["recomienda", "tapas"]),
        card("ask_checkout_time", "🕛", "Ask what time check-out is on Sunday", {
          intent: "Ask what time you have to leave the room on Sunday.",
          vocab: [
            { term: "¿a qué hora…?", meaning: "at what time…?" },
            { term: "la salida", meaning: "check-out" },
          ],
          starter: "¿A qué hora es la salida…",
          full: "¿A qué hora es la salida el domingo?",
          fullMeaning: "What time is check-out on Sunday?",
        }, ["salida", "domingo", "a qué hora"]),
        card("ask_breakfast", "🍊", "Ask where breakfast is served", {
          intent: "Ask where breakfast is served.",
          vocab: [
            { term: "¿dónde se sirve…?", meaning: "where is… served?" },
            { term: "el desayuno", meaning: "breakfast" },
          ],
          starter: "¿Dónde se sirve…",
          full: "¿Dónde se sirve el desayuno?",
          fullMeaning: "Where is breakfast served?",
        }, ["desayuno", "dónde"], { key: "breakfast_where" }),
      ],
      // « Sí, gracias » / « No, gracias » to a last « ¿Algo más? »: that's it.
      aliases: { yes: "thanks", no: "thanks" },
      resolve: ({ report }) => {
        if (["thanks", "goodbye", "accept", "greet"].includes(report.intent))
          return complete("key", "Say a warm final goodbye in one short sentence (e.g. « ¡A usted! Que disfrute de Sevilla. »).", "You're welcome! Enjoy Sevilla!");
        if (report.intent === "ask_elevator")
          return stay("info", "key", "Say the elevator is to the right, past the plants.", "The elevator is to the right, past the plants.");
        if (report.intent === "ask_wifi")
          return stay("info", "key", "Say the Wi-Fi password is « azahar2024 », it's also on the key card holder.", "The password is azahar2024. It's on your key card holder too.");
        if (report.intent === "ask_recommendation")
          return stay(
            "info",
            "key",
            "Recommend Bodega Santa Cruz, a lively tapas bar two minutes' walk away, famous for its montaditos. One or two sentences.",
            "Try Bodega Santa Cruz, two minutes away. Their montaditos are great!",
          );
        if (report.intent === "ask_checkout_time")
          return stay("info", "key", "Say check-out is on Sunday, before 12 noon.", "Check-out is Sunday, before noon.");
        if (report.intent === "ask_breakfast")
          return stay("info", "key", "Say breakfast is served in the patio restaurant, from 7:00 to 10:30.", "In the patio restaurant, from 7 to 10:30.");
        return null;
      },
    },
  ],
};
