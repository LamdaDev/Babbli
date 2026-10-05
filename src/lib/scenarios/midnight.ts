import { advance, complete, pick, stay } from "@/lib/engine/engine";
import { containsTerm } from "@/lib/evaluation/text";
import { card } from "./helpers";
import type { Difficulty, IntentCard, Outcome, ResolveContext, ScenarioDef, ScenarioState, TurnReport, Variant } from "./types";

/** 달빛24 (Dalbit 24), a convenience store in Sinchon, Seoul: the prices, shared by the scene and its art. */
export const PRICES = {
  ramen: 1200, // 봉지라면 (매운맛), for the ramen machine
  bowl: 300, // 라면 전용 용기, the machine's paper bowl
  kimbap: 1500, // 삼각김밥
  milk: 1700, // 바나나우유
  patches: 4500, // 여드름 패치, 24 dots
  mask: 2000, // 마스크팩
  beer: 3000, // 맥주: ID check
  bag: 100, // 봉투
  umbrella: 5000, // 투명 우산
} as const;

/** What the basket comes to (a 1+1 extra is free): the beer unless it came off, and a bag if they took one. */
export function basketTotal(slots: Record<string, string>, variant: Variant) {
  const beer = variant.beer && slots.noBeer !== "yes" ? PRICES.beer : 0;
  const bag = slots.bag === "yes" || slots.bag === "paper" ? PRICES.bag : 0;
  return PRICES.ramen + PRICES.bowl + PRICES.kimbap + PRICES.milk + PRICES.patches + beer + bag;
}

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];

/** Sino-Korean words for 1–9999 (no 일 before 천, 백, 십: 천이백, not 일천이백). */
function sino(n: number) {
  const parts: string[] = [];
  for (const [unit, word] of [
    [1000, "천"],
    [100, "백"],
    [10, "십"],
    [1, ""],
  ] as const) {
    const d = Math.floor(n / unit) % 10;
    if (d) parts.push((d === 1 && word ? "" : DIGITS[d]) + word);
  }
  return parts.join("");
}

/** An amount of won the way it's said and written in words: 구천이백 원, 만 이천이백 원, 이만 원. */
export function wonKo(n: number) {
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  const head = man ? (man === 1 ? "만" : `${sino(man)}만`) : "";
  return `${[head, rest ? sino(rest) : ""].filter(Boolean).join(" ")} 원`;
}

const won = (n: number) => `${n.toLocaleString("en-US")} won`;

/** Whether a word ends in a final consonant (받침): 이에요 / 이요 after one, 예요 / 요 after a vowel. */
const hasBatchim = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 !== 0;
};

/** The learner's phone number (one per run): few, so every "my number is…" card can be voiced ahead of time. */
const PHONES = ["010-4827-1593", "010-2394-7051", "010-9158-3402", "010-8732-4415"];
const DIGIT_KO = ["공", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const DIGIT_RR = ["gong", "il", "i", "sam", "sa", "o", "yuk", "chil", "pal", "gu"];
/** A phone number read digit by digit, 0 as 공: 010-4827-1593 → 공일공 사팔이칠 일오구삼. */
export const phoneKo = (phone: string) => phone.split("-").map((g) => [...g].map((d) => DIGIT_KO[Number(d)]).join("")).join(" ");
const phoneRr = (phone: string) => phone.split("-").map((g) => [...g].map((d) => DIGIT_RR[Number(d)]).join("")).join(" ");

const DIGIT_WORDS: Record<string, string> = { 공: "0", 영: "0", 일: "1", 이: "2", 삼: "3", 사: "4", 오: "5", 육: "6", 륙: "6", 칠: "7", 팔: "8", 구: "9" };
/** The digits in what they said (공일공… or 010…), everything else dropped: the number only has to appear in it. */
const digitsOf = (text: string) => [...text].map((c) => (/\d/.test(c) ? c : (DIGIT_WORDS[c] ?? ""))).join("");
const saidPhone = (ctx: ResolveContext, phone: string) => digitsOf(`${ctx.slot("phone")} ${ctx.report.heard}`).includes(phone.replace(/-/g, ""));

/** The 1+1 item of the run, and the other flavor or kind the learner may take as the free one. */
const DEALS = {
  kimbap: {
    ko: "삼각김밥",
    en: "triangle kimbap",
    kind: { ko: "다른 맛으로", rr: "Dareun maseuro", en: "flavor", term: "맛", termRr: "mat" },
    other: { value: "bibim", ko: "전주비빔으로", rr: "jeonjubibimeuro", en: "the bibimbap one", term: "전주비빔", termRr: "jeonjubibim", keywords: ["전주비빔", "비빔"] },
  },
  milk: {
    ko: "바나나우유",
    en: "banana milk",
    kind: { ko: "다른 맛으로", rr: "Dareun maseuro", en: "flavor", term: "맛", termRr: "mat" },
    other: { value: "strawberry", ko: "딸기우유로", rr: "ttalgiuyuro", en: "a strawberry milk", term: "딸기우유", termRr: "ttalgiuyu", keywords: ["딸기"] },
  },
  patches: {
    ko: "여드름 패치",
    en: "pimple patches",
    kind: { ko: "다른 종류로", rr: "Dareun jongnyuro", en: "kind", term: "종류", termRr: "jongnyu" },
    other: { value: "thin", ko: "얇은 걸로", rr: "yalbeun geollo", en: "the thin ones", term: "얇은 거", termRr: "yalbeun geo", keywords: ["얇은"] },
  },
} as const;
type Deal = keyof typeof DEALS;
const dealOf = (variant: Variant) => DEALS[variant.deal as Deal] ?? DEALS.kimbap;

/**
 * A bare 괜찮아요 / 됐어요 to an offer is a polite "no, thanks", even when the agent hears "it's fine" (yes).
 * The words decide, like boba's choosesRecommendation.
 */
const NO_THANKS = /^(아니요|아뇨|아니에요)?[,.\s]*(괜찮아요|괜찮습니다|됐어요|됐습니다)[.!~\s]*$/;
const declines = (report: TurnReport) => report.intent === "no" || report.intent === "decline" || NO_THANKS.test(report.heard.trim());

/** The goodbye for the one who STAYS: said while leaving, it's the classic slip. */
const SAYS_GASEYO = /안녕히\s*가세요/;
const SLIP_NOTE = "Leaving? Say 안녕히 계세요 (stay well). 안녕히 가세요 (go well) is for the one who stays.";

const has = (report: TurnReport, ...terms: string[]) => terms.some((t) => containsTerm(report.heard, t, "ko"));

/** What they're looking for: the slot, or the words. */
const itemOf = (report: TurnReport, slot: ResolveContext["slot"]) =>
  slot("item") || (has(report, "여드름", "패치") ? "patches" : has(report, "화장품") ? "skincare" : has(report, "마스크팩") ? "masks" : "");

/**
 * Any "X 있어요?" can come back as ask_location ("does the store have it"), often with no slot filled:
 * the words decide what they're really asking for at this step.
 */
const asksAbout = (report: TurnReport, ...terms: string[]) => report.intent === "ask_location" && has(report, ...terms);

/* ---------- moving on ---------- */

function aisleWhere(variant: Variant): { directive: string; meaning: string } {
  if (variant.aisle === "counter")
    return {
      directive: "Smile and point: the pimple patches are right in front of them, on the counter display (아, 그거 바로 앞에 있어요! 계산대 앞에요).",
      meaning: "Oh, they're right in front of you! On the counter.",
    };
  if (variant.aisle === "aisle2")
    return {
      directive: "Point: aisle two, at the end, next to the lip balms (두 번째 줄 끝에 있어요. 립밤 옆이요).",
      meaning: "At the end of aisle two, next to the lip balms.",
    };
  return {
    directive: "Point: the cosmetics corner, aisle three over there, right next to the sheet masks (화장품 코너는 저쪽 세 번째 줄이에요. 여드름 패치는 마스크팩 바로 옆에 있어요).",
    meaning: "The cosmetics corner is aisle three over there. The pimple patches are right next to the sheet masks.",
  };
}

/** Where the patches are, for his facts. */
const PATCHES_AT: Record<string, string> = {
  aisle3: "The pimple patches are in the cosmetics corner (화장품 코너), aisle 3, right next to the sheet masks.",
  aisle2: "The pimple patches are at the end of aisle 2, next to the lip balms.",
  counter: "The pimple patches are on the counter display (계산대 앞), right in front of the customer, who hasn't noticed them.",
};

/** Directions to the patches: they fetch them (the patches land on the counter), then the checkout. */
function toScan(variant: Variant): Outcome {
  const { directive, meaning } = aisleWhere(variant);
  return advance("scan", directive, meaning, { events: ["item_shown"], setSlots: { patches: "got" } });
}

function dealLine(variant: Variant) {
  if (variant.deal === "milk")
    return {
      directive: "Scan the items (삑, 삑…), then spot the deal: the banana milk is one plus one, so they can grab another free (아, 손님! 바나나우유 원 플러스 원이에요. 하나 더 가져오세요!).",
      meaning: "Oh! The banana milk is buy one, get one free. Grab another!",
    };
  if (variant.deal === "patches")
    return {
      directive: "Scan the items (삑, 삑…), then smile: the pimple patches are one plus one today (오, 운 좋으시네요. 패치 원 플러스 원이에요. 하나 더 고르세요!).",
      meaning: "Oh, lucky you. The patches are buy one, get one free. Pick another!",
    };
  return {
    directive: "Scan the items (삑, 삑…), then spot the deal: this triangle kimbap is one plus one, so they can grab another free (아, 손님! 이 삼각김밥 원 플러스 원이에요. 하나 더 가져오세요!).",
    meaning: "Oh! This triangle kimbap is buy one, get one free. Grab another!",
  };
}

const ASK_HEAT = "ask if they'd like the triangle kimbap heated (삼각김밥 데워 드릴까요?).";

/** After the 1+1: the patch chat (Intermediate and Immersion), or straight to heating the kimbap. */
function afterDeal(variant: Variant, difficulty: Difficulty, ack: string, extra: Partial<Outcome>): Outcome {
  if (difficulty === "beginner") return advance("heat", `${ack} Then ${ASK_HEAT}`, "Shall I heat the kimbap?", extra);
  const two = variant.deal === "patches" && extra.setSlots?.deal === "taken";
  return advance(
    "chat",
    `${ack} Then scan the patches and ask, gently, if tomorrow is a big day (${two ? "패치를 두 개나…" : "여드름 패치네요…"} 혹시 내일 중요한 날이에요?).`,
    `${two ? "Two packs of patches…" : "Pimple patches…"} is tomorrow a big day?`,
    extra,
  );
}

function toBag(difficulty: Difficulty, ack: string, extra: Partial<Outcome>): Outcome {
  if (difficulty === "immersion")
    return advance("bag", `${ack} Then, in one quick breath, ask about a bag and points (봉투 필요하세요? 포인트는요?).`, "Need a bag? Points?", extra);
  return advance("bag", `${ack} Then ask if they need a bag: it's 100 won (봉투 필요하세요? 백 원이에요).`, "Do you need a bag? It's 100 won.", extra);
}

function toPoints(difficulty: Difficulty, ack: string, extra: Partial<Outcome>): Outcome {
  return advance(
    "points",
    `${ack} Then ask if they collect points (포인트 적립하시겠어요?)${difficulty === "immersion" ? " and whether they have a carrier discount (통신사 할인은요?)" : ""}.`,
    difficulty === "immersion" ? "Collecting points? Any carrier discount?" : "Would you like to collect points?",
    extra,
  );
}

const needsId = (state: ScenarioState, variant: Variant) => !!variant.beer && !state.flags.idChecked && state.slots.noBeer !== "yes";

/** On to paying: the total, or first the ID check when there's beer. */
function toPay(state: ScenarioState, variant: Variant, ack: string, extra: Partial<Outcome> = {}): Outcome {
  const t = basketTotal({ ...state.slots, ...(extra.setSlots ?? {}) }, variant);
  if (needsId(state, variant))
    return advance(
      "pay",
      `${ack} Then, before the total: there's beer, so ask politely to see their ID (아, 맥주가 있어서요, 신분증 좀 보여 주시겠어요?).`,
      "Oh, since there's beer, could I see your ID?",
      extra,
    );
  return advance("pay", `${ack} Then tell them the total, ${wonKo(t)} (다 해서 ${wonKo(t)}입니다).`, `That's ${won(t)} altogether.`, extra);
}

/** Their ₩20,000 in cash, less any transit card top-up (top-ups are cash only). */
const cashLeft = (state: ScenarioState) => 20000 - (state.slots.toppedUp === "ten" ? 10000 : state.slots.toppedUp === "five" ? 5000 : 0);
/** The notes they hand over: a 만 원 note when it covers the total, otherwise all they have left. */
const cashGiven = (state: ScenarioState, total: number) => (total <= 10000 ? 10000 : cashLeft(state));
const CASH_RR: Record<number, string> = { 10000: "man won", 15000: "man ocheon won", 20000: "iman won" };

/** Paid: Beginner goes straight to the ramen machine and the time skip; the others get the receipt question first. */
function paid(state: ScenarioState, variant: Variant, difficulty: Difficulty, method: string): Outcome {
  const t = basketTotal(state.slots, variant);
  const given = cashGiven(state, t);
  const how =
    method === "cash"
      ? `Take their ${wonKo(given)} (${wonKo(given)} 받았습니다) and give the change, ${wonKo(given - t)} (거스름돈 ${wonKo(given - t)}이요).`
      : method === "phone"
        ? "Have them hold the phone to the reader (여기 대 주세요), then say it went through (결제됐습니다)."
        : "Ask them to insert the card chip-first (칩 쪽으로 꽂아 주세요~), then say it went through (결제됐습니다).";
  const meaning = method === "cash" ? `Out of ${won(given)}… here's your change, ${won(given - t)}.` : "There we go, all paid.";
  if (difficulty === "beginner")
    return advance(
      "leave",
      `${how} Then tell them the ramen machine is by the window: they just press button one (라면 기계는 창가에 있어요. 일 번 버튼만 누르시면 돼요!).`,
      `${meaning} The ramen machine is by the window: just press button one!`,
      { objectiveComplete: true, events: ["payment_done", "order_placed", "time_skip"], setSlots: { paid: method } },
    );
  return advance("receipt", `${how} Then ask if they'd like the receipt (영수증 드릴까요?).`, `${meaning} Would you like the receipt?`, {
    objectiveComplete: true,
    events: ["payment_done"],
    setSlots: { paid: method },
  });
}

/* ---------- cards ---------- */

const NO_THANKS_HINTS = {
  vocab: [
    { term: "아니요", reading: "aniyo", meaning: "no" },
    { term: "괜찮아요", reading: "gwaenchanayo", meaning: "no thanks (lit. it's fine)" },
  ],
  starter: "아니요, …",
  full: "아니요, 괜찮아요.",
  fullReading: "Aniyo, gwaenchanayo.",
  fullMeaning: "No, thank you.",
};

function dealCards(state: ScenarioState, variant: Variant): IntentCard[] {
  const d = dealOf(variant);
  const cards = [
    card("take_deal", "🎉", "Say you'll grab another", {
      intent: `Say great, you'll go and grab another ${d.en}.`,
      vocab: [
        { term: "진짜요?", reading: "jinjjayo?", meaning: "really?" },
        { term: "하나 더", reading: "hana deo", meaning: "one more" },
        { term: "가져올게요", reading: "gajyeoolgeyo", meaning: "I'll bring (it)" },
      ],
      starter: "아, 진짜요? 하나…",
      full: "아, 진짜요? 하나 더 가져올게요!",
      fullReading: "A, jinjjayo? Hana deo gajyeoolgeyo!",
      fullMeaning: "Oh, really? I'll grab another one!",
    }, ["하나 더", "가져올게요"], { key: "grab", core: true }),
    card("ask_fetch", "🙇", "Ask him to grab one for you", {
      intent: "Ask, politely, if he could get the free one for you.",
      vocab: [
        { term: "갖다주다", reading: "gatdajuda", meaning: "to fetch (for someone)" },
        { term: "-실 수 있어요?", reading: "-sil su isseoyo?", meaning: "could you…? (polite)" },
      ],
      starter: "혹시 하나…",
      full: "혹시 하나 갖다주실 수 있어요?",
      fullReading: "Hoksi hana gatdajusil su isseoyo?",
      fullMeaning: "Could you grab one for me?",
    }, ["갖다"], { core: true }),
    card("decline_deal", "🙅", "Say one is enough", {
      intent: "Thank him, but say one is enough.",
      vocab: [
        { term: "괜찮아요", reading: "gwaenchanayo", meaning: "it's OK (no thanks)" },
        { term: "하나만", reading: "hanaman", meaning: "just one" },
        { term: "살게요", reading: "salgeyo", meaning: "I'll buy" },
      ],
      starter: "괜찮아요, 하나만…",
      full: "괜찮아요, 하나만 살게요.",
      fullReading: "Gwaenchanayo, hanaman salgeyo.",
      fullMeaning: "That's OK, I'll just get one.",
    }, ["하나만"], { core: true }),
    card("ask_meaning", "❓", "Ask what 1+1 means", {
      intent: "Ask what \"one plus one\" (1+1) means.",
      vocab: [
        { term: "원 플러스 원", reading: "won peulleoseu won", meaning: "1+1: buy one, get one free" },
        { term: "뭐예요?", reading: "mwoyeyo?", meaning: "what is it?" },
      ],
      starter: "원 플러스 원이…",
      full: "원 플러스 원이 뭐예요?",
      fullReading: "Won peulleoseu woni mwoyeyo?",
      fullMeaning: "What does one plus one mean?",
    }, ["플러스"], { key: "what_deal" }),
  ];
  if (!state.flags.flavorTold)
    cards.push(
      card("ask_flavor", "🔄", `Ask if another ${d.kind.en} works`, {
        intent: `Ask if the free one can be a different ${d.kind.en}.`,
        vocab: [
          { term: "다른", reading: "dareun", meaning: "different, other" },
          { term: d.kind.term, reading: d.kind.termRr, meaning: d.kind.en },
          { term: "-아도 돼요?", reading: "-ado dwaeyo?", meaning: "is it OK if…?" },
        ],
        starter: `${d.kind.ko}…`,
        full: `${d.kind.ko} 가져와도 돼요?`,
        fullReading: `${d.kind.rr} gajyeowado dwaeyo?`,
        fullMeaning: `Can I bring a different ${d.kind.en}?`,
      }, ["다른"], { key: "flavor" }),
    );
  else
    cards.push(
      card("take_deal", "✨", `Grab ${d.other.en}`, {
        intent: `Say you'll take ${d.other.en} as the free one.`,
        vocab: [
          { term: "그럼", reading: "geureom", meaning: "then, in that case" },
          { term: d.other.term, reading: d.other.termRr, meaning: d.other.en },
        ],
        starter: "그럼…",
        full: `그럼 ${d.other.ko} 가져올게요.`,
        fullReading: `Geureom ${d.other.rr} gajyeoolgeyo.`,
        fullMeaning: `Then I'll grab ${d.other.en}.`,
      }, [...d.other.keywords], { key: "grab_other", expect: { flavor: d.other.value }, core: true }),
    );
  return cards;
}

function paymentCards(state: ScenarioState, variant: Variant, difficulty: Difficulty): IntentCard[] {
  const t = basketTotal(state.slots, variant);
  const repeat = card("ask_price", "🔁", "Ask him to repeat the total", {
    intent: "You missed the total. Ask him to say it again.",
    vocab: [
      { term: "죄송한데", reading: "joesonghande", meaning: "sorry, but… (polite opener)" },
      { term: "얼마라고 하셨어요?", reading: "eolmarago hasyeosseoyo?", meaning: "how much did you say?" },
    ],
    starter: "죄송한데, …",
    full: "죄송한데, 얼마라고 하셨어요?",
    fullReading: "Joesonghande, eolmarago hasyeosseoyo?",
    fullMeaning: "Sorry, how much did you say?",
  }, ["얼마"], { key: "repeat_total" });
  const covers = cashLeft(state) >= t;
  const given = cashGiven(state, t);

  // The ID check comes first when there's beer (Immersion).
  if (needsId(state, variant))
    return [
      card("show_id", "🪪", "Show your ID", {
        intent: "Hand over your ID card.",
        vocab: [
          { term: "여기요", reading: "yeogiyo", meaning: "here you go" },
          { term: "신분증", reading: "sinbunjeung", meaning: "ID card" },
        ],
        starter: "네, …",
        full: "네, 여기요.",
        fullReading: "Ne, yeogiyo.",
        fullMeaning: "Sure, here you go.",
      }, ["여기요"], { key: "id", expect: { id_type: "id" }, core: true }),
      state.flags.idAsked
        ? card("show_id", "📘", "Show your passport", {
            intent: "Show your passport instead.",
            vocab: [{ term: "여권", reading: "yeogwon", meaning: "passport" }],
            starter: "여기 여권…",
            full: "여기 여권이요.",
            fullReading: "Yeogi yeogwoniyo.",
            fullMeaning: "Here's my passport.",
          }, ["여권"], { key: "passport", expect: { id_type: "passport" }, core: true })
        : card("ask_id", "🛂", "Ask if a passport works", {
            intent: "Ask if a passport is OK as ID.",
            vocab: [
              { term: "여권", reading: "yeogwon", meaning: "passport" },
              { term: "-도 돼요?", reading: "-do dwaeyo?", meaning: "is … OK too?" },
            ],
            starter: "여권도…",
            full: "여권도 돼요?",
            fullReading: "Yeogwondo dwaeyo?",
            fullMeaning: "Is a passport OK?",
          }, ["여권"], { key: "ask_passport" }),
      card("ask_id", "🪪", "Ask if a residence card works", {
        intent: "Ask if your residence card (for foreigners) is OK.",
        vocab: [{ term: "외국인등록증", reading: "oegugindeungnokjeung", meaning: "residence card for foreigners" }],
        starter: "외국인등록증도…",
        full: "외국인등록증도 돼요?",
        fullReading: "Oegugindeungnokjeungdo dwaeyo?",
        fullMeaning: "Is a residence card OK?",
      }, ["등록증"], { key: "ask_residence" }),
      card("no_id", "😅", "Say you left it at home", {
        intent: "Admit you left your ID at home.",
        vocab: [
          { term: "집에", reading: "jibe", meaning: "at home" },
          { term: "두고 왔어요", reading: "dugo wasseoyo", meaning: "I left it (behind)" },
        ],
        starter: "아, 집에…",
        full: "아, 집에 두고 왔어요.",
        fullReading: "A, jibe dugo wasseoyo.",
        fullMeaning: "Oh, I left it at home.",
      }, ["두고"], { core: true }),
    ];

  // Topping up the transit card (cash only), while he waits for the amount.
  if (state.flags.topupOpen)
    return [
      card("topup", "💵", "Ten thousand won, please", {
        intent: "Top up 10,000 won.",
        vocab: [
          { term: "만 원", reading: "man won", meaning: "10,000 won" },
          { term: "충전하다", reading: "chungjeonhada", meaning: "to top up, to charge" },
        ],
        starter: "만 원…",
        full: "만 원 충전해 주세요.",
        fullReading: "Man won chungjeonhae juseyo.",
        fullMeaning: "Ten thousand won, please.",
      }, ["만 원", "충전"], { key: "ten", expect: { amount: "ten" }, core: true }),
      card("topup", "💴", "Just five thousand won", {
        intent: "Top up just 5,000 won.",
        vocab: [
          { term: "오천 원", reading: "ocheon won", meaning: "5,000 won" },
          { term: "-만", reading: "-man", meaning: "just, only" },
        ],
        starter: "오천 원만…",
        full: "오천 원만 해 주세요.",
        fullReading: "Ocheon wonman hae juseyo.",
        fullMeaning: "Just five thousand won, please.",
      }, ["오천"], { key: "five", expect: { amount: "five" }, core: true }),
      card("decline", "↩️", "Never mind", {
        intent: "Change your mind: you'll top it up another time.",
        vocab: [{ term: "다음에", reading: "daeume", meaning: "next time" }],
        starter: "아, 그럼…",
        full: "아, 그럼 다음에 할게요.",
        fullReading: "A, geureom daeume halgeyo.",
        fullMeaning: "Oh, I'll do it next time then.",
      }, ["다음에"], { key: "topup_no", core: true }),
    ];

  // The card didn't go through: try again, another card, or cash.
  if (state.flags.cardFailed)
    return [
      card("pay", "🔁", "Try again", {
        intent: "Say you'll insert the card again.",
        vocab: [
          { term: "다시", reading: "dasi", meaning: "again" },
          { term: "해 볼게요", reading: "hae bolgeyo", meaning: "I'll try" },
        ],
        starter: "네, 다시…",
        full: "네, 다시 해 볼게요.",
        fullReading: "Ne, dasi hae bolgeyo.",
        fullMeaning: "Sure, I'll try again.",
      }, ["다시"], { key: "retry", expect: { payment_method: "card" }, core: true }),
      card("pay", "💳", "Use another card", {
        intent: "Say you'll use a different card.",
        vocab: [
          { term: "다른", reading: "dareun", meaning: "another, different" },
          { term: "카드", reading: "kadeu", meaning: "card" },
        ],
        starter: "다른 카드로…",
        full: "다른 카드로 할게요.",
        fullReading: "Dareun kadeuro halgeyo.",
        fullMeaning: "I'll use another card.",
      }, ["다른 카드"], { key: "other_card", expect: { payment_method: "card" }, core: true }),
      ...(covers
        ? [
            card("pay", "💵", "Pay cash instead", {
              intent: "Say you'll pay cash instead.",
              vocab: [{ term: "현금", reading: "hyeongeum", meaning: "cash" }],
              starter: "그럼 현금…",
              full: "그럼 현금으로 할게요.",
              fullReading: "Geureom hyeongeumeuro halgeyo.",
              fullMeaning: "Then I'll pay cash.",
            }, ["현금"], { key: "cash_instead", expect: { payment_method: "cash" }, core: true }),
          ]
        : []),
      repeat,
    ];

  const cards: IntentCard[] = [
    card("pay", "💳", "Pay by card", {
      intent: "Say you'll pay by card.",
      vocab: [
        { term: "카드", reading: "kadeu", meaning: "card" },
        { term: "-로 할게요", reading: "-ro halgeyo", meaning: "I'll go with…" },
      ],
      starter: "카드로…",
      full: "카드로 할게요.",
      fullReading: "Kadeuro halgeyo.",
      fullMeaning: "I'll pay by card.",
    }, ["카드로"], { key: "card", expect: { payment_method: "card" }, core: true }),
  ];
  if (covers)
    cards.push(
      card("pay", "💵", "Pay in cash", {
        intent: `Pay cash: hand over ${won(given)}.`,
        vocab: [
          { term: "현금", reading: "hyeongeum", meaning: "cash" },
          { term: wonKo(given), reading: CASH_RR[given], meaning: won(given) },
        ],
        starter: "현금으로…",
        full: `현금으로 할게요. 여기 ${wonKo(given)}이요.`,
        fullReading: `Hyeongeumeuro halgeyo. Yeogi ${CASH_RR[given]}iyo.`,
        fullMeaning: `I'll pay cash. Here's ${won(given)}.`,
      }, ["현금"], { key: "cash", expect: { payment_method: "cash" }, core: true }),
    );
  cards.push(
    state.flags.phoneOk
      ? card("pay", "📲", "Pay by phone", {
          intent: "Phones work: say you'll pay with yours.",
          vocab: [{ term: "휴대폰", reading: "hyudaepon", meaning: "mobile phone" }],
          starter: "그럼 휴대폰…",
          full: "그럼 휴대폰으로 할게요.",
          fullReading: "Geureom hyudaeponeuro halgeyo.",
          fullMeaning: "Then I'll pay with my phone.",
        }, ["휴대폰"], { key: "phone", expect: { payment_method: "phone" }, core: true })
      : card("ask_payment", "📱", "Ask if phone payment works", {
          intent: "Ask if you can pay with your phone.",
          vocab: [
            { term: "휴대폰", reading: "hyudaepon", meaning: "mobile phone" },
            { term: "결제", reading: "gyeolje", meaning: "payment" },
          ],
          starter: "휴대폰으로…",
          full: "휴대폰으로 결제돼요?",
          fullReading: "Hyudaeponeuro gyeoljedwaeyo?",
          fullMeaning: "Can I pay with my phone?",
        }, ["휴대폰"], { key: "ask_phone", expect: { payment_method: "phone" } }),
    card("ask_payment", "📶", "Ask if you can tap your card", {
      intent: "Ask if you can just tap your card on the reader.",
      vocab: [{ term: "대다", reading: "daeda", meaning: "to touch, to tap" }],
      starter: "카드 대도…",
      full: "카드 대도 돼요?",
      fullReading: "Kadeu daedo dwaeyo?",
      fullMeaning: "Can I tap my card?",
    }, ["대도"], { key: "ask_tap", expect: { payment_method: "card" } }),
    repeat,
  );
  if (difficulty !== "beginner" && !state.slots.toppedUp)
    cards.push(
      card("ask_topup", "🚇", "Ask to top up your transit card", {
        intent: "Your transit card is nearly empty: ask if you can top it up here.",
        vocab: [
          { term: "교통카드", reading: "gyotongkadeu", meaning: "transit card" },
          { term: "충전", reading: "chungjeon", meaning: "top-up" },
        ],
        starter: "교통카드…",
        full: "교통카드 충전도 돼요?",
        fullReading: "Gyotongkadeu chungjeondo dwaeyo?",
        fullMeaning: "Can I top up my transit card too?",
      }, ["교통카드", "충전"], { key: "topup" }),
    );
  return cards;
}

/* ---------- the scene ---------- */

export const midnight: ScenarioDef = {
  id: "midnight",
  language: "ko",
  languageName: "한국어",
  languageEnglish: "Korean",
  flag: "🇰🇷",
  city: "Seoul",
  locationLabel: "SEOUL · SINCHON",
  title: "Seoul Midnight Convenience Store",
  venueName: "달빛24 · Dalbit 24",
  objective: "Find the pimple patches, check out your midnight snacks (grab any 1+1 deal), pay, cook your ramen at the machine, and head back out into the rain.",
  goal: "Buy your midnight snacks and cook your ramen",
  demoRole: "generalization",
  isNew: true,
  blurb: "A glowing convenience store on a rainy side street in Sinchon, 11:40 pm. Doyun is on the night shift, the ramen machine is warm, and something is always 1+1.",
  npc: {
    name: "Doyun",
    role: "Night-shift clerk",
    voiceKey: "doyun",
    look: {
      skin: "#f5dccb",
      skinShade: "#e6c2ac",
      hair: "#5b4a43",
      hairStyle: "comma",
      outfit: "#f3f3f1",
      outfitShade: "#dadad7",
      apron: "#1f6f78",
      accent: "#ffe9a8",
      accessory: "vest",
      eyes: "#2a1f1c",
      build: "slender",
      makeup: { lips: "#b5706a", blush: "#f1b9a6" },
      apronMark: "24",
      badgeText: "도윤",
      earring: "#c9ccd1",
    },
  },
  backgroundVoices: {
    machine: { voiceKey: "machine_ko", name: "Ramen machine" },
    radio: { voiceKey: "radio_ko", name: "Late-night radio" },
  },
  art: "midnight",
  ambienceAsset: "midnight-ambience",
  musicAsset: "midnight-radio",
  sfx: {
    enter: "midnight-door",
    item_shown: "midnight-shelf",
    item_added: "midnight-deal",
    bill_shown: "midnight-scan",
    heated: "midnight-microwave",
    payment_done: "midnight-pay",
    order_placed: "midnight-ramen",
    time_skip: "midnight-slurp",
  },
  briefing: {
    title: "Your notes",
    lines: [
      "Your shopping list: 라면, 삼각김밥, 여드름 패치 (pimple patches)",
      "₩20,000 in cash, a bank card and a nearly empty transit card",
      "It's pouring and you have no umbrella. Look for 1+1 tags: buy one, get one free",
    ],
  },
  initialStage: "greeting",
  randomizeCards: true,
  requiredSlots: ["patches", "paid"],
  intents: {
    ask_location:
      "Asks WHERE something is, or whether the store has it (여드름 패치 어디 있어요?, 혹시 여드름 패치 있어요?, 화장품 코너가 어디예요?, 마스크팩도 팔아요?, …찾고 있어요): fill `item`",
    ask_machine: "Asks about the ramen machine: whether there is one, or how it works (라면 기계 있어요?, 어떻게 써요?, 처음인데 어떻게 해요?)",
    browsing: "Says they're just looking around (그냥 구경하고 있어요)",
    ask_recommendation: "Asks a QUESTION about what's good or what goes well, without choosing anything (요즘 뭐가 맛있어요?, 데우면 더 맛있어요?, 같이 먹으면 맛있는 거 있어요?)",
    ask_checkout: "Asks to pay or to have the items rung up, or for the total (이거 계산해 주세요, 계산할게요, 계산 부탁드려요, 다 해서 얼마예요?)",
    ask_deal: "Asks if anything is on sale or discounted (혹시 할인하는 거 있어요?)",
    take_deal: "Takes the 1+1 deal: they'll grab the free one (하나 더 가져올게요). Fill `flavor` if they name another flavor or kind",
    ask_fetch: "Asks you to fetch the free item for them (하나 갖다주실 수 있어요?)",
    ask_flavor: "Asks if the free one can be another flavor or kind (다른 맛으로 가져와도 돼요?, 다른 종류로…)",
    decline_deal: "Turns the 1+1 down: one is enough (괜찮아요, 하나만 살게요). A bare 괜찮아요 here means NO thanks",
    share_reason: "Says why they're buying pimple patches, or that there's no special reason (내일 면접이 있어요, 소개팅, 콘서트, 발표, 아니요 그냥요): fill `reason`",
    ask_patches: "Asks about the patches themselves: how you guessed, or whether they work (어떻게 아셨어요?, 효과 좋아요?)",
    heat: "Answers whether to heat the triangle kimbap (데워 주세요, 두 개 다 데워 주세요, 제가 할게요, 전자레인지 써도 돼요?): fill `heat`. A bare 괜찮아요 / 됐어요 means NO",
    ask_wait_time: "Asks how long something takes (얼마나 걸려요?, 몇 분 걸려요?)",
    bag: "Answers whether they want a bag (하나 주세요, 종이봉투 있어요?, 들고 갈게요, 가방 있어요): fill `bag`. A bare 괜찮아요 / 됐어요 means NO. If they also answer about points, fill `points` too",
    points: "Answers about points or a carrier discount (their phone number 공일공…, 회원 아니에요, 통신사 할인은 없어요): fill `points`, and `phone` with the digits. A bare 괜찮아요 / 됐어요 means NO",
    ask_signup: "Asks how to sign up for the membership (가입은 어떻게 해요?)",
    ask_price: "Asks a price, or asks you to repeat the total (봉투 얼마예요?, 얼마라고 하셨어요?)",
    pay: "Pays, or says how (카드로 할게요, 현금으로 할게요, 휴대폰으로 할게요, 다시 해 볼게요, 다른 카드로 할게요): fill `payment_method`",
    ask_payment: "Asks whether a way of paying works (휴대폰으로 결제돼요?, 카드 대도 돼요?): fill `payment_method`",
    ask_topup: "Asks to top up their transit card (교통카드 충전도 돼요?)",
    topup: "Says how much to top up their transit card (만 원 충전해 주세요, 오천 원만 해 주세요): fill `amount`",
    show_id: "Shows their ID when asked (네, 여기요, 여기 여권이요): fill `id_type`",
    ask_id: "Asks which ID works (여권도 돼요?, 외국인등록증도 돼요?)",
    no_id: "Says they don't have their ID on them (집에 두고 왔어요)",
    receipt: "Answers whether they want the receipt (네 주세요, 혹시 모르니까 주세요, 버려 주세요, 영수증은 됐어요): fill `receipt`. 버려 주세요 (throw it away) and a bare 괜찮아요 / 됐어요 mean NO",
    ask_refund: "Asks if the receipt is needed for a refund or exchange (환불할 때 필요해요?)",
    understood: "Says they understand and will do it, or have done it before (알겠어요, 해 볼게요, 해 봤어요)",
    ask_seat: "Asks where they can sit or eat (어디서 먹으면 돼요?)",
    ask_umbrella: "Asks if you have or sell an umbrella (혹시 우산 있어요?)",
    buy_umbrella: "Says they'll buy the umbrella (그럼 하나 살게요)",
    come_again: "Says they'll come again (또 올게요!)",
    compliment: "Compliments you, the store or your voice (목소리 진짜 좋으세요!)",
    decline: "Politely drops something they had asked for (아, 그럼 다음에 할게요)",
  },
  slots: {
    item: { description: "What they're looking for: patches = 여드름 패치, skincare = the cosmetics aisle (화장품 코너), masks = 마스크팩, other = anything else", values: ["patches", "skincare", "masks", "other"] },
    flavor: { description: "Another flavor or kind for the free 1+1 item: bibim = 전주비빔 kimbap, strawberry = 딸기우유, thin = the thin patches (얇은 거)", values: ["bibim", "strawberry", "thin"] },
    reason: { description: "Why they need pimple patches: interview = 면접, date = 소개팅, concert = 콘서트, presentation = 발표, nothing = no special reason (그냥요)", values: ["interview", "date", "concert", "presentation", "nothing"] },
    heat: { description: "Heating the kimbap: yes = 데워 주세요, both = 두 개 다, self = they'll use the microwave themselves, no = 괜찮아요", values: ["yes", "both", "self", "no"] },
    bag: { description: "A bag (100 won): yes = 하나 주세요, paper = a paper bag (종이봉투), no = 괜찮아요 / 들고 갈게요 / 가방 있어요", values: ["yes", "paper", "no"] },
    points: { description: "Points: number = they gave a phone number, no = 괜찮아요 / 회원 아니에요 / no carrier discount", values: ["number", "no"] },
    phone: { description: "The phone number they said, as digits only (공일공 사팔이칠 일오구삼 → 01048271593)" },
    payment_method: { description: "How they pay: card = 카드, cash = 현금, phone = 휴대폰 (mobile payment)", values: ["card", "cash", "phone"] },
    amount: { description: "Transit card top-up: ten = 만 원, five = 오천 원", values: ["ten", "five"] },
    id_type: { description: "The ID they show: id = an ID card (신분증), passport = 여권, residence = 외국인등록증", values: ["id", "passport", "residence"] },
    receipt: { description: "The receipt: yes = 주세요, no = 버려 주세요 / 됐어요 / 괜찮아요", values: ["yes", "no"] },
  },
  greetings: {
    beginner: [
      { text: "어서 오세요~", meaning: "Welcome~" },
      { text: "안녕하세요, 어서 오세요~", meaning: "Hello, welcome~" },
      { text: "어서 오세요! 비 많이 오죠?", meaning: "Welcome! It's really raining, huh?" },
    ],
    intermediate: [
      { text: "어서 오세요. 비 많이 오죠? 천천히 보세요~", meaning: "Welcome. It's pouring, huh? Take your time~" },
      { text: "어서 오세요~ 찾으시는 거 있으세요?", meaning: "Welcome~ Looking for something?" },
      { text: "안녕하세요! 비 엄청 오네요. 천천히 구경하세요~", meaning: "Hi! It's really coming down. Have a look around~" },
    ],
    immersion: [
      { text: "어서 오세요~ 와, 비 진짜 많이 오네요.", meaning: "Welcome~ Wow, it's really pouring." },
      { text: "어서 오세요~ 늦게까지 고생 많으셨죠?", meaning: "Welcome~ Long day, huh?" },
      { text: "안녕하세요~ 찾으시는 거 있으면 말씀하세요.", meaning: "Hi~ If you're looking for something, just say." },
    ],
  },
  makeVariant: (difficulty, rand) => {
    const r = rand();
    const deal: Deal = difficulty === "beginner" || r < 0.5 ? "kimbap" : r < 0.75 ? "milk" : "patches";
    const counterChance = difficulty === "beginner" ? 0 : difficulty === "immersion" ? 0.3 : 0.2;
    const aisle = rand() < counterChance ? "counter" : rand() < 0.5 ? "aisle3" : "aisle2";
    return {
      deal,
      aisle,
      phone: pick(PHONES, rand),
      balance: rand() < 0.5 ? 2300 : 1800,
      beer: difficulty === "immersion" && rand() < 0.35,
      tapFail: difficulty === "immersion" && rand() < 0.35,
      umbrella: difficulty === "beginner" ? "" : rand() < 0.6 ? "lend" : "sell",
    };
  },
  persona:
    "You are Doyun (도윤), 23, the night-shift clerk (야간 알바) at 달빛24, a small 24-hour convenience store on a side street near the universities in Sinchon, Seoul. It's 11:40 pm on a rainy July night in monsoon season (장마). You study applied music; between customers you write lyrics in a small notebook and hum along to the late-night radio. You have a soft, soothing voice and a calm, gentle way of talking, like a K-pop idol chatting with fans on a late-night livestream: warm, unhurried, kind and a little playful. You notice small things and you cheer people on (화이팅!). You know every 1+1 deal by heart and love sharing 꿀팁 and 꿀조합. You feed 참치, the stray cat who sleeps under the parasol table outside. You always speak polite 해요체 to customers, with the formal checkout phrases (…원입니다, 결제됐습니다, 감사합니다). You are friendly to everyone and never flirt. The customer has just come in out of the rain.",
  facts: (v, difficulty) => {
    const d = dealOf(v);
    return [
      "PRICES: 봉지라면 (매운맛) 천이백 원, plus its machine bowl (라면 전용 용기) 삼백 원; 삼각김밥 천오백 원 (참치마요, 전주비빔); 바나나우유 천칠백 원; 여드름 패치 사천오백 원 (24 dots); 마스크팩 이천 원; 맥주 삼천 원 (ID required); 봉투 (plastic or paper) 백 원; 투명 우산 오천 원.",
      `TODAY'S ONE PLUS ONE (원 플러스 원): the ${d.ko} (the free one can be another ${d.kind.en} at the same price). Sheet masks are always one plus one.`,
      `THE CUSTOMER'S BASKET: 봉지라면 and its bowl, a 참치마요 삼각김밥, a 바나나우유${v.beer ? ", a can of 맥주" : ""}. They still need 여드름 패치. ${PATCHES_AT[String(v.aisle)] ?? PATCHES_AT.aisle3}`,
      "RAMEN MACHINE (라면 조리기), by the window: put the noodles and soup powder in the special paper bowl, set it on the machine and press button 1; it adds water and boils for three minutes. The microwave is next to it (twenty seconds for a kimbap).",
      `PAYMENT: card (insert the chip, no tapping), phone payment and cash all work. Transit card top-ups (교통카드 충전) are cash only. Points (달빛 멤버십) go by phone number, read digit by digit with 공 for 0. The customer's number: ${v.phone}. Their transit card balance: ${wonKo(Number(v.balance))}.`,
      `UMBRELLAS: lost-and-found umbrellas (분실물 우산) sit in the bucket by the door; clear umbrellas are 오천 원.${v.umbrella === "lend" ? " You'll lend them a lost-and-found one." : v.umbrella === "sell" ? " Today you can only sell them a clear one." : ""}`,
      "참치 is the stray cat you named; it likes canned tuna. Call the customer 손님.",
      difficulty === "immersion" ? "IMMERSION: speak at a natural, quick pace, with everyday contractions and fillers, and stack quick checkout questions (봉투 필요하세요? 포인트는요?)." : "",
    ]
      .filter(Boolean)
      .join("\n");
  },
  asrKeywords: [
    "여드름 패치", "화장품", "마스크팩", "삼각김밥", "참치마요", "전주비빔", "라면", "라면 기계", "용기", "바나나우유", "원 플러스 원",
    "하나 더", "데워 주세요", "전자레인지", "봉투", "종이봉투", "포인트", "적립", "통신사", "공일공", "카드", "현금", "휴대폰", "신분증",
    "여권", "외국인등록증", "교통카드", "충전", "영수증", "버려 주세요", "면접", "소개팅", "콘서트", "발표", "우산", "수고하세요", "참치",
  ],
  vocabulary: [
    { term: "어서 오세요", reading: "eoseo oseyo", meaning: "welcome in", stages: ["greeting"] },
    { term: "편의점", reading: "pyeonuijeom", meaning: "convenience store", stages: ["greeting"] },
    { term: "저기요", reading: "jeogiyo", meaning: "excuse me", stages: ["greeting"] },
    { term: "비가 와요", reading: "biga wayo", meaning: "it's raining", stages: ["greeting"] },
    { term: "어디 있어요?", reading: "eodi isseoyo?", meaning: "where is it?", stages: ["find"] },
    { term: "화장품", reading: "hwajangpum", meaning: "cosmetics", stages: ["find"] },
    { term: "여드름 패치", reading: "yeodeureum paechi", meaning: "pimple patch", stages: ["find"] },
    { term: "저쪽", reading: "jeojjok", meaning: "over there", stages: ["find"] },
    { term: "세 번째 줄", reading: "se beonjjae jul", meaning: "the third aisle", stages: ["find"] },
    { term: "바로 옆", reading: "baro yeop", meaning: "right next to", stages: ["find"] },
    { term: "계산", reading: "gyesan", meaning: "checkout, the bill", stages: ["scan"] },
    { term: "다 해서", reading: "da haeseo", meaning: "altogether", stages: ["scan"] },
    { term: "원 플러스 원", reading: "won peulleoseu won", meaning: "buy one, get one free (written 1+1)", stages: ["deal"] },
    { term: "하나 더", reading: "hana deo", meaning: "one more", stages: ["deal"] },
    { term: "가져오다", reading: "gajyeooda", meaning: "to bring", stages: ["deal"] },
    { term: "면접", reading: "myeonjeop", meaning: "job interview", stages: ["chat"] },
    { term: "소개팅", reading: "sogaeting", meaning: "blind date", stages: ["chat"] },
    { term: "발표", reading: "balpyo", meaning: "presentation", stages: ["chat"] },
    { term: "화이팅", reading: "hwaiting", meaning: "you've got this! (officially spelled 파이팅)", stages: ["chat"] },
    { term: "데우다", reading: "deuda", meaning: "to heat up", stages: ["heat"] },
    { term: "전자레인지", reading: "jeonjareinji", meaning: "microwave", stages: ["heat"] },
    { term: "삼각김밥", reading: "samgakgimbap", meaning: "triangle kimbap", stages: ["heat"] },
    { term: "봉투", reading: "bongtu", meaning: "bag", stages: ["bag"] },
    { term: "괜찮아요", reading: "gwaenchanayo", meaning: "no thanks (lit. it's fine)", stages: ["bag"] },
    { term: "포인트 적립", reading: "pointeu jeongnip", meaning: "collecting points", stages: ["points"] },
    { term: "공", reading: "gong", meaning: "zero, in phone numbers", stages: ["points"] },
    { term: "통신사 할인", reading: "tongsinsa harin", meaning: "phone-carrier discount", stages: ["points"] },
    { term: "카드", reading: "kadeu", meaning: "card", stages: ["pay"] },
    { term: "꽂다", reading: "kkotda", meaning: "to insert", stages: ["pay"] },
    { term: "현금", reading: "hyeongeum", meaning: "cash", stages: ["pay"] },
    { term: "거스름돈", reading: "geoseureumdon", meaning: "change", stages: ["pay"] },
    { term: "신분증", reading: "sinbunjeung", meaning: "ID card", stages: ["pay"] },
    { term: "여권", reading: "yeogwon", meaning: "passport", stages: ["pay"] },
    { term: "교통카드 충전", reading: "gyotongkadeu chungjeon", meaning: "transit card top-up", stages: ["pay"] },
    { term: "잔액", reading: "janaek", meaning: "balance", stages: ["pay"] },
    { term: "영수증", reading: "yeongsujeung", meaning: "receipt", stages: ["receipt"] },
    { term: "버려 주세요", reading: "beoryeo juseyo", meaning: "please throw it away", stages: ["receipt"] },
    { term: "라면 기계", reading: "ramyeon gigye", meaning: "ramen machine", stages: ["ramen"] },
    { term: "용기", reading: "yonggi", meaning: "container, bowl", stages: ["ramen"] },
    { term: "먼저", reading: "meonjeo", meaning: "first", stages: ["ramen"] },
    { term: "그다음에", reading: "geudaeume", meaning: "after that", stages: ["ramen"] },
    { term: "누르다", reading: "nureuda", meaning: "to press", stages: ["ramen"] },
    { term: "꿀팁", reading: "kkultip", meaning: "honey tip: a great tip", stages: ["ramen"] },
    { term: "꿀조합", reading: "kkuljohap", meaning: "honey combo: a great pairing", stages: ["ramen"] },
    { term: "수고하세요", reading: "sugohaseyo", meaning: "take it easy (said to someone working)", stages: ["leave"] },
    { term: "조심히 들어가세요", reading: "josimhi deureogaseyo", meaning: "get home safe", stages: ["leave"] },
    { term: "우산", reading: "usan", meaning: "umbrella", stages: ["leave"] },
    { term: "안녕히 계세요", reading: "annyeonghi gyeseyo", meaning: "goodbye (to someone staying)", stages: ["leave"] },
  ],
  eventLines: {
    // The ramen machine, as soon as you press button one.
    order_placed: () => ({ voice: "machine", text: "조리를 시작합니다. 삼 분 후에 완성됩니다.", meaning: "Starting to cook. Ready in three minutes." }),
    // The store radio while you eat by the window.
    time_skip: () => ({
      voice: "radio",
      text: "비 오는 밤이네요. 오늘 하루도 정말 수고 많으셨어요. 따뜻한 거 드시고, 푹 쉬세요.",
      meaning: "A rainy night. You worked so hard today. Have something warm and rest well.",
    }),
  },
  timeSkipText: "Three minutes later… the machine clicks off, your ramen is bubbling, and the rain drums on the window while you eat.",
  successTitle: "오늘도 수고했어요!",
  stages: [
    {
      id: "greeting",
      group: "Greeting",
      npcGoal: "Welcome the customer in from the rain (어서 오세요) and ask if they're looking for something.",
      meaning: "Welcome! Looking for something?",
      situation: "You've come in out of the rain. Doyun is at the register. Your list says 라면, 삼각김밥, 여드름 패치: the ramen and kimbap are in your basket, but you can't find the pimple patches.",
      cards: () => [
        card("greet", "👋", "Say hello", {
          intent: "Say hello back to Doyun.",
          vocab: [{ term: "안녕하세요", reading: "annyeonghaseyo", meaning: "hello" }],
          starter: "안녕…",
          full: "안녕하세요!",
          fullReading: "Annyeonghaseyo!",
          fullMeaning: "Hello!",
        }, ["안녕하세요"], { core: true }),
        card("greet", "🌧️", "Say it's pouring", {
          intent: "Say how hard it's raining out.",
          vocab: [
            { term: "비", reading: "bi", meaning: "rain" },
            { term: "엄청", reading: "eomcheong", meaning: "really, a lot" },
          ],
          starter: "비가…",
          full: "비가 엄청 와요.",
          fullReading: "Biga eomcheong wayo.",
          fullMeaning: "It's really pouring.",
        }, ["비가", "엄청"], { key: "rain", core: true }),
        card("ask_location", "🩹", "Ask where the pimple patches are", {
          intent: "Get his attention and ask where the pimple patches are.",
          vocab: [
            { term: "저기요", reading: "jeogiyo", meaning: "excuse me" },
            { term: "여드름 패치", reading: "yeodeureum paechi", meaning: "pimple patch" },
            { term: "어디 있어요?", reading: "eodi isseoyo?", meaning: "where is it?" },
          ],
          starter: "저기요, 여드름…",
          full: "저기요, 여드름 패치 어디 있어요?",
          fullReading: "Jeogiyo, yeodeureum paechi eodi isseoyo?",
          fullMeaning: "Excuse me, where are the pimple patches?",
        }, ["여드름", "패치"], { key: "where_patches", expect: { item: "patches" }, core: true }),
        card("ask_location", "🔎", "Ask if they sell pimple patches", {
          intent: "Ask if they have pimple patches.",
          vocab: [
            { term: "혹시", reading: "hoksi", meaning: "by any chance" },
            { term: "있어요?", reading: "isseoyo?", meaning: "do you have…?" },
          ],
          starter: "혹시 여드름…",
          full: "혹시 여드름 패치 있어요?",
          fullReading: "Hoksi yeodeureum paechi isseoyo?",
          fullMeaning: "Do you have pimple patches, by any chance?",
        }, ["여드름", "패치"], { key: "have_patches", expect: { item: "patches" }, core: true }),
        card("ask_machine", "🍜", "Ask if there's a ramen machine", {
          intent: "Ask if the store has a ramen machine.",
          vocab: [
            { term: "라면 기계", reading: "ramyeon gigye", meaning: "ramen machine" },
            { term: "여기", reading: "yeogi", meaning: "here" },
          ],
          starter: "여기 라면…",
          full: "여기 라면 기계 있어요?",
          fullReading: "Yeogi ramyeon gigye isseoyo?",
          fullMeaning: "Is there a ramen machine here?",
        }, ["라면 기계", "기계"], { core: true }),
        card("greet", "✍️", "Ask what he's writing", {
          intent: "He's scribbling in a notebook: ask what he's writing.",
          vocab: [
            { term: "쓰다", reading: "sseuda", meaning: "to write" },
            { term: "-고 계세요?", reading: "-go gyeseyo?", meaning: "are you …ing? (polite)" },
          ],
          starter: "뭐 쓰고…",
          full: "뭐 쓰고 계세요?",
          fullReading: "Mwo sseugo gyeseyo?",
          fullMeaning: "What are you writing?",
        }, ["쓰고"], { key: "lyrics" }),
        card("greet", "🐈", "Say the cat outside is cute", {
          intent: "Mention the cute cat outside.",
          vocab: [
            { term: "밖에", reading: "bakke", meaning: "outside" },
            { term: "고양이", reading: "goyangi", meaning: "cat" },
            { term: "귀엽네요", reading: "gwiyeomneyo", meaning: "it's cute!" },
          ],
          starter: "밖에 고양이…",
          full: "밖에 고양이 귀엽네요!",
          fullReading: "Bakke goyangi gwiyeomneyo!",
          fullMeaning: "The cat outside is so cute!",
        }, ["고양이"], { key: "cat" }),
        card("ask_recommendation", "🤔", "Ask what's good lately", {
          intent: "Ask what's good these days.",
          vocab: [
            { term: "요즘", reading: "yojeum", meaning: "these days" },
            { term: "뭐가 맛있어요?", reading: "mwoga masisseoyo?", meaning: "what's good?" },
          ],
          starter: "요즘 뭐가…",
          full: "요즘 뭐가 맛있어요?",
          fullReading: "Yojeum mwoga masisseoyo?",
          fullMeaning: "What's good lately?",
        }, ["요즘"]),
      ],
      // Every reply moves on: his answer ends by inviting them to keep shopping.
      resolve: ({ report: said, slot, variant }) => {
        const report = asksAbout(said, "기계") ? { ...said, intent: "ask_machine" } : said;
        const ask = "ask if they're looking for something (찾으시는 거 있으세요?).";
        if (report.intent === "ask_location") {
          const item = itemOf(report, slot);
          if (item === "patches" || item === "skincare") return toScan(variant);
          if (item === "masks")
            return advance("find", "Say yes, they're in the cosmetics aisle, and one plus one today (네, 마스크팩은 오늘 원 플러스 원이에요). Then ask if they're looking for anything else (또 찾으시는 거 있으세요?).", "Yes, sheet masks are buy one, get one free today. Looking for anything else?");
          if (item === "other") return advance("find", "Point them to it (저쪽에 있어요), then ask if they're looking for anything else (또 찾으시는 거 있으세요?).", "It's over there. Looking for anything else?");
          return advance("find", "Ask, kindly, what they're looking for (뭐 찾으세요?).", "What are you looking for?");
        }
        if (report.intent === "ask_machine")
          return advance("find", `Say yes, by the window: they just buy a bag of ramen and its special bowl (네, 창가에 있어요. 봉지라면이랑 전용 용기 사시면 돼요). Then ${ask}`, "Yes, by the window. Just get a bag of ramen and the special bowl. Looking for something?");
        if (report.intent === "ask_recommendation")
          return advance(
            "find",
            `Say your honey combo lately is a tuna-mayo triangle kimbap with spicy ramen (요즘은 참치마요 삼각김밥에 매운 라면이 꿀조합이에요!), then notice their basket and smile: they've already got it (벌써 고르셨네요!). Then ${ask}`,
            "Lately it's a tuna-mayo kimbap with spicy ramen. Oh, you've already got it! Looking for something?",
          );
        if (report.intent === "browsing" || report.intent === "no") return advance("find", "Say of course, take your time (네~ 천천히 보세요).", "Of course, take your time~");
        if (report.intent === "yes") return advance("find", "Ask, kindly, what they're looking for (뭐 찾으세요?).", "What are you looking for?");
        if (report.intent === "ask_checkout") return advance("find", "Say sure, but first ask if there's anything else they need (네! 혹시 더 필요하신 건 없으세요?).", "Sure! Anything else you need?");
        if (report.intent === "greet") {
          if (has(report, "쓰고", "가사"))
            return advance("find", `Say, a little shy, that you were writing lyrics: rainy days are good for it (아, 가사 쓰고 있었어요. 비 오는 날은 가사가 잘 써지거든요). Then ${ask}`, "Oh, I was writing lyrics. Rainy days are good for lyrics. Looking for something?", { setFlags: { lyrics: true } });
          if (has(report, "고양이", "참치"))
            return advance("find", `Smile: that's 참치, you named it (참치예요! 제가 이름 지어 줬어요). Then ${ask}`, "That's Chamchi! I named it. Looking for something?");
          if (has(report, "비가", "비 많이", "비 엄청", "엄청"))
            return advance("find", `Agree warmly, it's pouring (그쵸? 비 진짜 많이 오네요). Then tell them to take their time and ${ask}`, "Right? It's really pouring. Take your time. Looking for something?");
          return advance("find", `Say hi, take your time (네~ 천천히 보세요), and ${ask}`, "Hi~ Take your time. Looking for something?");
        }
        return null;
      },
    },
    {
      id: "find",
      group: "Greeting",
      aliases: { no: "browsing" },
      npcGoal: "Ask what they're looking for (찾으시는 거 있으세요?) and help them find it.",
      meaning: "Are you looking for something?",
      situation: "Doyun asked if you're looking for something. The pimple patches on your list are nowhere to be seen.",
      cards: () => [
        card("ask_location", "🩹", "Ask where the pimple patches are", {
          intent: "Ask where the pimple patches are.",
          vocab: [
            { term: "여드름 패치", reading: "yeodeureum paechi", meaning: "pimple patch" },
            { term: "어디", reading: "eodi", meaning: "where" },
          ],
          starter: "여드름 패치…",
          full: "여드름 패치 어디 있어요?",
          fullReading: "Yeodeureum paechi eodi isseoyo?",
          fullMeaning: "Where are the pimple patches?",
        }, ["여드름", "패치"], { key: "where_patches", expect: { item: "patches" }, core: true }),
        card("ask_location", "🙏", "Ask politely", {
          intent: "Ask politely where the pimple patches are.",
          vocab: [
            { term: "죄송한데", reading: "joesonghande", meaning: "sorry, but… (polite opener)" },
            { term: "어디에", reading: "eodie", meaning: "where" },
          ],
          starter: "죄송한데, …",
          full: "죄송한데, 여드름 패치는 어디에 있어요?",
          fullReading: "Joesonghande, yeodeureum paechineun eodie isseoyo?",
          fullMeaning: "Sorry, where are the pimple patches?",
        }, ["여드름", "패치"], { key: "where_polite", expect: { item: "patches" }, core: true }),
        card("ask_location", "📝", "Say what you're looking for", {
          intent: "Tell him you're looking for pimple patches.",
          vocab: [
            { term: "찾다", reading: "chatda", meaning: "to look for" },
            { term: "찾고 있어요", reading: "chatgo isseoyo", meaning: "I'm looking for" },
          ],
          starter: "여드름 패치 찾고…",
          full: "여드름 패치 찾고 있어요.",
          fullReading: "Yeodeureum paechi chatgo isseoyo.",
          fullMeaning: "I'm looking for pimple patches.",
        }, ["여드름", "찾고"], { key: "looking", expect: { item: "patches" }, core: true }),
        card("ask_location", "💄", "Ask for the cosmetics aisle", {
          intent: "Ask where the cosmetics aisle is.",
          vocab: [
            { term: "화장품", reading: "hwajangpum", meaning: "cosmetics" },
            { term: "코너", reading: "koneo", meaning: "corner, aisle" },
          ],
          starter: "화장품 코너가…",
          full: "화장품 코너가 어디예요?",
          fullReading: "Hwajangpum koneoga eodiyeyo?",
          fullMeaning: "Where's the cosmetics aisle?",
        }, ["화장품"], { key: "cosmetics", expect: { item: "skincare" }, core: true }),
        card("ask_location", "🧖", "Ask if they sell sheet masks", {
          intent: "Ask if they sell sheet masks too.",
          vocab: [
            { term: "마스크팩", reading: "maseukeupaek", meaning: "sheet mask" },
            { term: "팔다", reading: "palda", meaning: "to sell" },
          ],
          starter: "마스크팩도…",
          full: "마스크팩도 팔아요?",
          fullReading: "Maseukeupaekdo parayo?",
          fullMeaning: "Do you sell sheet masks too?",
        }, ["마스크팩"], { key: "masks", expect: { item: "masks" } }),
        card("ask_machine", "🍜", "Ask how the ramen machine works", {
          intent: "Ask how you use the ramen machine.",
          vocab: [
            { term: "어떻게", reading: "eotteoke", meaning: "how" },
            { term: "쓰다", reading: "sseuda", meaning: "to use" },
          ],
          starter: "라면 기계는…",
          full: "라면 기계는 어떻게 써요?",
          fullReading: "Ramyeon gigyeneun eotteoke sseoyo?",
          fullMeaning: "How do you use the ramen machine?",
        }, ["라면 기계", "기계"], { key: "machine_how" }),
        card("browsing", "👀", "Say you're just looking", {
          intent: "Say you're just looking around for now.",
          vocab: [
            { term: "그냥", reading: "geunyang", meaning: "just" },
            { term: "구경하다", reading: "gugyeonghada", meaning: "to look around" },
          ],
          starter: "그냥 구경…",
          full: "그냥 구경하고 있어요.",
          fullReading: "Geunyang gugyeonghago isseoyo.",
          fullMeaning: "I'm just looking around.",
        }, ["구경"]),
      ],
      resolve: ({ report: said, slot, variant }) => {
        const report = asksAbout(said, "기계") ? { ...said, intent: "ask_machine" } : said;
        const item = itemOf(report, slot);
        if (report.intent === "ask_location" || (report.intent === "yes" && item)) {
          if (item === "patches" || item === "skincare") return toScan(variant);
          if (item === "masks")
            return stay("info", "find", "Say yes: right next to the patches, and they're one plus one today (네, 패치 바로 옆에 있어요. 오늘 원 플러스 원이에요!).", "Yes, right next to the patches. They're buy one, get one free today!");
          if (item === "other") return stay("info", "find", "Point them to it (저쪽에 있어요), then ask if they're looking for anything else (또 찾으시는 거 있으세요?).", "It's over there. Anything else?");
          return stay("info", "find", "Ask, kindly, what they're looking for (뭐 찾으세요?).", "What are you looking for?");
        }
        if (report.intent === "yes") return stay("info", "find", "Ask, kindly, what they're looking for (뭐 찾으세요?).", "What are you looking for?");
        if (report.intent === "ask_machine")
          return stay("info", "find", "Explain briefly: the bag of ramen goes in its special bowl, onto the machine; you'll explain properly after checkout (봉지라면을 전용 용기에 넣고 기계에 올리면 돼요. 계산하고 자세히 알려 드릴게요).", "Put the ramen in the special bowl and set it on the machine. I'll explain after you pay.");
        if (report.intent === "browsing") return stay("info", "find", "Say of course, take your time (네~ 천천히 보세요).", "Of course, take your time~");
        if (report.intent === "ask_checkout")
          return stay("info", "find", "Say sure, but first ask if there's anything else they need (네! 혹시 더 필요하신 건 없으세요?).", "Sure! Anything else you need?");
        return null;
      },
    },
    {
      id: "scan",
      group: "Checkout",
      learnerOpens: "You've got the patches. Put everything on the counter and ask him to ring you up: you speak first.",
      npcGoal: "Ring up the customer's things when they ask.",
      meaning: "",
      situation: "You found the patches. Back at the counter, ask Doyun to ring up your things.",
      cards: () => [
        card("ask_checkout", "🧺", "Ask him to ring you up", {
          intent: "Ask him to ring up your things.",
          vocab: [
            { term: "이거", reading: "igeo", meaning: "this, these" },
            { term: "계산하다", reading: "gyesanhada", meaning: "to pay, to ring up" },
          ],
          starter: "이거 계산…",
          full: "이거 계산해 주세요.",
          fullReading: "Igeo gyesanhae juseyo.",
          fullMeaning: "Please ring these up.",
        }, ["계산"], { key: "checkout", core: true }),
        card("ask_checkout", "💳", "Say you'll pay now", {
          intent: "Say you're ready to pay.",
          vocab: [{ term: "계산할게요", reading: "gyesanhalgeyo", meaning: "I'll pay (now)" }],
          starter: "계산…",
          full: "계산할게요.",
          fullReading: "Gyesanhalgeyo.",
          fullMeaning: "I'll pay now.",
        }, ["계산할게요"], { key: "pay_now", core: true }),
        card("ask_checkout", "🙏", "Ask politely", {
          intent: "Ask, politely, if he could ring these up.",
          vocab: [
            { term: "이것들", reading: "igeotdeul", meaning: "these" },
            { term: "부탁드려요", reading: "butakdeuryeoyo", meaning: "please (a polite request)" },
          ],
          starter: "이것들 계산…",
          full: "이것들 계산 부탁드려요.",
          fullReading: "Igeotdeul gyesan butakdeuryeoyo.",
          fullMeaning: "Could you ring these up, please?",
        }, ["부탁"], { key: "polite", core: true }),
        card("thanks", "😊", "Thank him for the directions", {
          intent: "Thank him for telling you where the patches were.",
          vocab: [
            { term: "아까", reading: "akka", meaning: "earlier, a moment ago" },
            { term: "알려 주다", reading: "allyeo juda", meaning: "to let someone know" },
          ],
          starter: "아까 알려…",
          full: "아까 알려 주셔서 감사해요!",
          fullReading: "Akka allyeo jusyeoseo gamsahaeyo!",
          fullMeaning: "Thanks for telling me earlier!",
        }, ["알려", "감사"], { core: true }),
        card("ask_checkout", "🔢", "Ask how much it all is", {
          intent: "Ask how much it all comes to.",
          vocab: [
            { term: "다 해서", reading: "da haeseo", meaning: "altogether" },
            { term: "얼마예요?", reading: "eolmayeyo?", meaning: "how much?" },
          ],
          starter: "다 해서…",
          full: "다 해서 얼마예요?",
          fullReading: "Da haeseo eolmayeyo?",
          fullMeaning: "How much is it altogether?",
        }, ["다 해서", "얼마"], { key: "how_much", core: true }),
        card("ask_deal", "🏷️", "Ask if anything is on sale", {
          intent: "Ask if anything is on sale.",
          vocab: [{ term: "할인", reading: "harin", meaning: "discount, sale" }],
          starter: "혹시 할인…",
          full: "혹시 할인하는 거 있어요?",
          fullReading: "Hoksi harinhaneun geo isseoyo?",
          fullMeaning: "Is anything on sale, by any chance?",
        }, ["할인"], { core: true }),
      ],
      // Every card starts the scan (the deal comes before the total).
      resolve: ({ report, variant }) => {
        if (["ask_checkout", "ask_deal", "ask_location", "ask_price", "pay", "thanks", "yes"].includes(report.intent)) {
          const { directive, meaning } = dealLine(variant);
          const ack = report.intent === "thanks" ? "Say it was nothing (아니에요~), then ring them up. " : "";
          return advance("deal", `${ack}${directive}`, meaning, { events: ["bill_shown"] });
        }
        return null;
      },
    },
    {
      id: "deal",
      group: "Checkout",
      aliases: { yes: "take_deal", no: "decline_deal" },
      npcGoal: "Tell them the item is one plus one (원 플러스 원): they can grab another free.",
      meaning: "It's buy one, get one free. Grab another!",
      situation: "It's a 1+1 deal: buy one, get one free. Take him up on it?",
      cards: ({ state, variant }) => dealCards(state, variant),
      resolve: ({ report, slot, variant, difficulty }) => {
        const d = dealOf(variant);
        if (report.intent === "take_deal" || report.intent === "ask_fetch") {
          const flavor = slot("flavor");
          const ack =
            report.intent === "ask_fetch"
              ? "Say of course, and go get one for them (그럼요, 잠깐만요~ 여기요!)."
              : `Say sure, take your time (네~ 천천히 다녀오세요)${difficulty === "immersion" ? ", smiling that it's a total win (완전 이득이죠?)" : ""}.`;
          return afterDeal(variant, difficulty, ack, { events: ["item_added"], setSlots: { deal: "taken", ...(flavor ? { flavor } : {}) } });
        }
        if (report.intent === "decline_deal" || declines(report)) return afterDeal(variant, difficulty, "Say no problem (네, 알겠습니다).", { setSlots: { deal: "declined" } });
        if (report.intent === "ask_flavor")
          return stay("info", "deal", `Say yes, any ${d.kind.en} at the same price works (네, 같은 가격이면 아무거나 돼요).`, `Yes, any ${d.kind.en} at the same price is fine.`, { setFlags: { flavorTold: true } });
        return null;
      },
    },
    {
      id: "chat",
      group: "Checkout",
      aliases: { yes: "share_reason" },
      npcGoal: "Gently ask if tomorrow is a big day, since they're buying pimple patches (혹시 내일 중요한 날이에요?).",
      meaning: "Pimple patches… is tomorrow a big day?",
      situation: "Doyun noticed the pimple patches and asked, kindly, if tomorrow is a big day.",
      cards: () => [
        card("share_reason", "💼", "Say you have a job interview", {
          intent: "Tell him you have a job interview tomorrow.",
          vocab: [
            { term: "내일", reading: "naeil", meaning: "tomorrow" },
            { term: "면접", reading: "myeonjeop", meaning: "job interview" },
          ],
          starter: "네, 내일…",
          full: "네, 내일 면접이 있어요.",
          fullReading: "Ne, naeil myeonjeobi isseoyo.",
          fullMeaning: "Yes, I have a job interview tomorrow.",
        }, ["면접"], { key: "interview", expect: { reason: "interview" }, core: true }),
        card("share_reason", "💐", "Say you have a blind date", {
          intent: "Admit you have a blind date tomorrow.",
          vocab: [
            { term: "사실", reading: "sasil", meaning: "actually" },
            { term: "소개팅", reading: "sogaeting", meaning: "blind date" },
          ],
          starter: "사실 내일…",
          full: "사실 내일 소개팅이 있어요.",
          fullReading: "Sasil naeil sogaetingi isseoyo.",
          fullMeaning: "Actually, I have a blind date tomorrow.",
        }, ["소개팅"], { key: "date", expect: { reason: "date" }, core: true }),
        card("share_reason", "🎤", "Say you're going to a concert", {
          intent: "Tell him you're going to a concert tomorrow.",
          vocab: [
            { term: "콘서트", reading: "konseoteu", meaning: "concert" },
            { term: "가요", reading: "gayo", meaning: "I'm going" },
          ],
          starter: "내일 콘서트…",
          full: "내일 콘서트 가요!",
          fullReading: "Naeil konseoteu gayo!",
          fullMeaning: "I'm going to a concert tomorrow!",
        }, ["콘서트"], { key: "concert", expect: { reason: "concert" }, core: true }),
        card("share_reason", "📊", "Say you have a presentation", {
          intent: "Tell him you have a presentation tomorrow.",
          vocab: [
            { term: "발표", reading: "balpyo", meaning: "presentation" },
            { term: "-어서요", reading: "-eoseoyo", meaning: "because… (a soft reason)" },
          ],
          starter: "내일 발표가…",
          full: "내일 발표가 있어서요.",
          fullReading: "Naeil balpyoga isseoseoyo.",
          fullMeaning: "I have a presentation tomorrow.",
        }, ["발표"], { key: "presentation", expect: { reason: "presentation" }, core: true }),
        card("share_reason", "🤷", "Say it's nothing special", {
          intent: "Say no, there's no special reason.",
          vocab: [
            { term: "아니요", reading: "aniyo", meaning: "no" },
            { term: "그냥요", reading: "geunyangyo", meaning: "just because" },
          ],
          starter: "아니요, …",
          full: "아니요, 그냥요.",
          fullReading: "Aniyo, geunyangyo.",
          fullMeaning: "No, just because.",
        }, ["그냥"], { key: "nothing", expect: { reason: "nothing" }, core: true }),
        card("ask_patches", "🕵️", "Ask how he guessed", {
          intent: "Ask how he knew.",
          vocab: [
            { term: "어떻게", reading: "eotteoke", meaning: "how" },
            { term: "아셨어요?", reading: "asyeosseoyo?", meaning: "did you know? (polite)" },
          ],
          starter: "어떻게…",
          full: "어떻게 아셨어요?",
          fullReading: "Eotteoke asyeosseoyo?",
          fullMeaning: "How did you know?",
        }, ["아셨"], { key: "how_guess" }),
        card("ask_patches", "✨", "Ask if they work well", {
          intent: "Ask if these patches actually work.",
          vocab: [
            { term: "효과", reading: "hyogwa", meaning: "effect" },
            { term: "좋아요?", reading: "joayo?", meaning: "is it good?" },
          ],
          starter: "이거 효과…",
          full: "이거 효과 좋아요?",
          fullReading: "Igeo hyogwa joayo?",
          fullMeaning: "Do these work well?",
        }, ["효과"], { key: "works" }),
      ],
      resolve: ({ report, slot }) => {
        if (report.intent === "share_reason" || report.intent === "no" || declines(report)) {
          const reason =
            slot("reason") ||
            (has(report, "면접") ? "interview" : has(report, "소개팅") ? "date" : has(report, "콘서트") ? "concert" : has(report, "발표") ? "presentation" : report.intent === "no" || has(report, "그냥", "아니") ? "nothing" : "");
          const cheer: Record<string, [string, string]> = {
            interview: ["Brighten: good luck with the interview, you've got this (와, 면접 잘 보세요! 화이팅!).", "Oh, good luck with the interview! You've got this!"],
            date: ["Smile: a blind date? You hope it goes well (오~ 소개팅이요? 잘되길 바랄게요. 화이팅!).", "Ooh, a blind date? I hope it goes well. You've got this!"],
            concert: ["Light up: you're jealous, they should have fun (와, 부럽다~ 재밌게 보고 오세요!).", "Wow, I'm jealous~ Have fun!"],
            presentation: ["Encourage them: the presentation will go great (발표 잘하실 거예요. 화이팅!).", "Your presentation will go great. You've got this!"],
            nothing: ["Say warmly that their skin will look great tomorrow anyway (그래도 내일은 피부 좋아질 거예요~).", "Well, your skin will look great tomorrow anyway~"],
          };
          const [line, meaning] = cheer[reason] ?? ["Smile and cheer them on for tomorrow (잘될 거예요. 화이팅!).", "It'll go well. You've got this!"];
          return advance("heat", `${line} Then ${ASK_HEAT}`, `${meaning} Shall I heat the kimbap?`, { setSlots: reason ? { reason } : {} });
        }
        if (report.intent === "ask_patches") {
          if (has(report, "효과", "좋아요"))
            return stay("info", "chat", "Say yes, you use them yourself during exams: put one on before bed (네, 저도 시험 기간에 써요. 자기 전에 붙이면 돼요).", "Yes, I use them during exams too. Put one on before bed.");
          return stay("info", "chat", "Laugh softly: people buying patches at night usually do (하하, 밤에 패치 사시는 분들은 보통 그렇더라고요).", "Haha, people who buy patches at night usually do.");
        }
        return null;
      },
    },
    {
      id: "heat",
      group: "Checkout",
      npcGoal: "Ask if they'd like the triangle kimbap heated (삼각김밥 데워 드릴까요?).",
      meaning: "Shall I heat the kimbap?",
      situation: "Doyun is offering to heat your triangle kimbap in the microwave.",
      cards: ({ state, variant }) => {
        const cards = [
          card("heat", "♨️", "Yes, please heat it", {
            intent: "Say yes, please heat it.",
            vocab: [
              { term: "데우다", reading: "deuda", meaning: "to heat up" },
              { term: "데워 주세요", reading: "dewo juseyo", meaning: "please heat it" },
            ],
            starter: "네, 데워…",
            full: "네, 데워 주세요.",
            fullReading: "Ne, dewo juseyo.",
            fullMeaning: "Yes, please heat it up.",
          }, ["데워"], { key: "heat_yes", expect: { heat: "yes" }, core: true }),
          card("heat", "🙅", "No thanks", { ...NO_THANKS_HINTS, intent: "Say no, thank you: you'll eat it cold." }, ["괜찮"], { key: "heat_no", expect: { heat: "no" }, core: true }),
          card("heat", "🙋", "Say you'll do it yourself", {
            intent: "Say you'll heat it yourself, and ask where the microwave is.",
            vocab: [
              { term: "제가 할게요", reading: "jega halgeyo", meaning: "I'll do it" },
              { term: "전자레인지", reading: "jeonjareinji", meaning: "microwave" },
            ],
            starter: "제가 할게요…",
            full: "제가 할게요. 전자레인지 어디 있어요?",
            fullReading: "Jega halgeyo. Jeonjareinji eodi isseoyo?",
            fullMeaning: "I'll do it. Where's the microwave?",
          }, ["전자레인지", "제가"], { key: "heat_self", expect: { heat: "self" }, core: true }),
          card("ask_wait_time", "⏱️", "Ask how long it takes", {
            intent: "Ask how long it takes.",
            vocab: [
              { term: "얼마나", reading: "eolmana", meaning: "how long, how much" },
              { term: "걸리다", reading: "geollida", meaning: "to take (time)" },
            ],
            starter: "얼마나…",
            full: "얼마나 걸려요?",
            fullReading: "Eolmana geollyeoyo?",
            fullMeaning: "How long does it take?",
          }, ["걸려"]),
          card("ask_recommendation", "🤔", "Ask if it's better warm", {
            intent: "Ask if it's tastier warm.",
            vocab: [
              { term: "데우면", reading: "deumyeon", meaning: "if you heat it" },
              { term: "더", reading: "deo", meaning: "more" },
            ],
            starter: "데우면…",
            full: "데우면 더 맛있어요?",
            fullReading: "Deumyeon deo masisseoyo?",
            fullMeaning: "Is it tastier warm?",
          }, ["데우면"], { key: "better_warm" }),
        ];
        if (variant.deal === "kimbap" && state.slots.deal === "taken")
          cards.push(
            card("heat", "♨️", "Heat both", {
              intent: "Ask him to heat both triangle kimbaps.",
              vocab: [
                { term: "두 개", reading: "du gae", meaning: "two (things)" },
                { term: "다", reading: "da", meaning: "all, both" },
              ],
              starter: "두 개 다…",
              full: "두 개 다 데워 주세요.",
              fullReading: "Du gae da dewo juseyo.",
              fullMeaning: "Please heat both.",
            }, ["두 개", "데워"], { key: "heat_both", expect: { heat: "both" }, core: true }),
          );
        return cards;
      },
      resolve: ({ report, slot, state, variant, difficulty }) => {
        const microwave = asksAbout(report, "전자레인지");
        const fromWords = has(report, "두 개", "둘 다")
          ? "both"
          : has(report, "제가", "전자레인지")
            ? "self"
            : has(report, "데워")
              ? "yes"
              : has(report, "괜찮", "차갑게")
                ? "no"
                : "";
        const answers = report.intent === "heat" || report.intent === "yes" || microwave || declines(report);
        const choice = declines(report)
          ? "no"
          : slot("heat") || (microwave ? "self" : report.intent === "heat" ? fromWords : report.intent === "yes" ? fromWords || "yes" : "");
        if (answers && choice) {
          const line =
            choice === "self"
              ? "Point: the microwave is by the window, twenty seconds does it (전자레인지는 창가 쪽에 있어요. 이십 초 돌리시면 돼요)."
              : choice === "no"
                ? "Say of course (네~ 알겠습니다)."
                : `Pop ${choice === "both" ? "both" : "it"} in the microwave: just twenty seconds (네, 이십 초만 기다려 주세요~).`;
          const extra: Partial<Outcome> = { setSlots: { heat: choice }, ...(choice === "yes" || choice === "both" ? { events: ["heated" as const] } : {}) };
          return difficulty === "beginner" ? toPay(state, variant, line, extra) : toBag(difficulty, line, extra);
        }
        if (report.intent === "ask_wait_time") return stay("info", "heat", "Say just twenty seconds (이십 초면 돼요).", "Just twenty seconds.");
        if (report.intent === "ask_recommendation")
          return stay("info", "heat", "Say yes, warm it's so much better (네, 따뜻하게 먹으면 훨씬 맛있어요!), and ask if you should heat it.", "Yes, it's much better warm! Shall I heat it?");
        return null;
      },
    },
    {
      id: "bag",
      group: "Checkout",
      npcGoal: "Ask if they need a bag; it's 100 won (봉투 필요하세요? 백 원이에요).",
      meaning: "Do you need a bag? It's 100 won.",
      situation: "Doyun asked if you need a bag. Bags cost 100 won here.",
      cards: ({ state, difficulty }) => {
        const cards = [
          card("bag", "🙅", "No thanks", { ...NO_THANKS_HINTS, intent: "Say no thanks, you don't need a bag." }, ["괜찮"], { key: "bag_no", expect: { bag: "no" }, core: true }),
          card("bag", "🛍️", "Yes, one bag", {
            intent: "Say yes, one bag please.",
            vocab: [{ term: "하나", reading: "hana", meaning: "one" }],
            starter: "네, 하나…",
            full: "네, 하나 주세요.",
            fullReading: "Ne, hana juseyo.",
            fullMeaning: "Yes, one please.",
          }, ["하나 주세요"], { key: "bag_yes", expect: { bag: "yes" }, core: true }),
          card("bag", "🤲", "Say you'll just carry them", {
            intent: "Say you'll just carry them.",
            vocab: [{ term: "들고 가다", reading: "deulgo gada", meaning: "to carry (along)" }],
            starter: "그냥 들고…",
            full: "그냥 들고 갈게요.",
            fullReading: "Geunyang deulgo galgeyo.",
            fullMeaning: "I'll just carry them.",
          }, ["들고"], { key: "carry", expect: { bag: "no" }, core: true }),
          card("bag", "🎒", "Say you have a bag", {
            intent: "Say you have your own bag.",
            vocab: [
              { term: "가방", reading: "gabang", meaning: "bag" },
              { term: "넣다", reading: "neota", meaning: "to put in" },
            ],
            starter: "가방 있어요…",
            full: "가방 있어요. 여기 넣을게요.",
            fullReading: "Gabang isseoyo. Yeogi neoeulgeyo.",
            fullMeaning: "I have a bag. I'll put them in here.",
          }, ["가방"], { key: "own_bag", expect: { bag: "no" }, core: true }),
          card("bag", "🧾", "Ask for a paper bag", {
            intent: "Ask for a paper bag.",
            vocab: [{ term: "종이봉투", reading: "jongibongtu", meaning: "paper bag" }],
            starter: "종이봉투…",
            full: "종이봉투 있어요?",
            fullReading: "Jongibongtu isseoyo?",
            fullMeaning: "Do you have paper bags?",
          }, ["종이봉투", "종이"], { key: "paper", expect: { bag: "paper" }, core: true }),
          card("ask_price", "💰", "Ask how much a bag is", {
            intent: "Ask how much a bag costs.",
            vocab: [
              { term: "봉투", reading: "bongtu", meaning: "bag" },
              { term: "얼마예요?", reading: "eolmayeyo?", meaning: "how much?" },
            ],
            starter: "봉투…",
            full: "봉투 얼마예요?",
            fullReading: "Bongtu eolmayeyo?",
            fullMeaning: "How much is a bag?",
          }, ["봉투", "얼마"], { key: "bag_price" }),
        ];
        // Immersion asks about the bag and points in one breath: either answer (or both) works.
        if (difficulty === "immersion" && !state.slots.points)
          cards.push(
            card("bag", "🙅", "No bag, no points", {
              intent: "Say no thanks to both: no bag and no points.",
              vocab: [
                { term: "-랑", reading: "-rang", meaning: "and" },
                { term: "다", reading: "da", meaning: "all, both" },
              ],
              starter: "봉투랑 포인트…",
              full: "봉투랑 포인트 다 괜찮아요.",
              fullReading: "Bongturang pointeu da gwaenchanayo.",
              fullMeaning: "No bag or points, thanks.",
            }, ["봉투랑", "포인트"], { key: "both_no", expect: { bag: "no", points: "no" }, core: true }),
            card("points", "🎫", "Say no to the points first", {
              intent: "Answer the points question first: no thanks.",
              vocab: [{ term: "포인트", reading: "pointeu", meaning: "points" }],
              starter: "포인트는…",
              full: "포인트는 괜찮아요.",
              fullReading: "Pointeuneun gwaenchanayo.",
              fullMeaning: "No points, thanks.",
            }, ["포인트"], { key: "points_first", expect: { points: "no" } }),
          );
        return cards;
      },
      resolve: (ctx) => {
        const { report, slot, state, variant, difficulty } = ctx;
        const phone = String(variant.phone);
        // "포인트는 괜찮아요" answers the points question only, even when the agent hears a plain no.
        const pointsOnly = has(report, "포인트", "적립", "회원", "통신사") && !has(report, "봉투", "가방", "들고");
        const fromWords = has(report, "종이") ? "paper" : has(report, "괜찮", "들고", "가방") ? "no" : has(report, "주세요", "하나") ? "yes" : "";
        const bagAnswer = () => {
          if (pointsOnly) return "";
          if (slot("bag")) return slot("bag");
          if (report.intent === "points") return "";
          if (declines(report)) return "no";
          if (report.intent === "yes") return "yes";
          if (report.intent === "bag") return fromWords;
          return asksAbout(report, "봉투") ? fromWords || "yes" : "";
        };
        const bag = bagAnswer();
        // An answer about points counts too on Immersion, where he asked both at once.
        const points =
          difficulty !== "immersion" || state.slots.points
            ? ""
            : saidPhone(ctx, phone)
              ? "number"
              : slot("points") === "no" || ((report.intent === "points" || pointsOnly) && (declines(report) || has(report, "괜찮", "됐어요", "아니", "없어")))
                ? "no"
                : "";
        const readBack = `read the number back (${phoneKo(phone)}…) and say the points are in (적립됐습니다)`;
        if (bag) {
          const line = bag === "paper" ? "Say yes, paper bags are 100 won too, and bag the items (네, 종이봉투도 백 원이에요)." : bag === "yes" ? "Bag the items (네~)." : "Say of course (네~).";
          const setSlots = { bag, ...(points ? { points } : {}) };
          if (points || state.slots.points) return toPay(state, variant, points === "number" ? `${line} Then ${readBack}.` : line, { setSlots });
          return toPoints(difficulty, line, { setSlots });
        }
        if (points)
          return stay("info", "bag", `${points === "number" ? `Smile and ${readBack}.` : "Say sure (네~)."} Then ask about the bag again (봉투는요?).`, `${points === "number" ? "Points added." : "Sure."} And a bag?`, {
            setSlots: { points },
          });
        if (report.intent === "ask_price") return stay("info", "bag", "Say a bag is 100 won (봉투는 백 원이에요).", "A bag is 100 won.");
        return null;
      },
    },
    {
      id: "points",
      group: "Checkout",
      npcGoal: "Ask if they'd like to collect points (포인트 적립하시겠어요?).",
      meaning: "Would you like to collect points?",
      situation: "Doyun asked if you collect points. Points go by phone number, read digit by digit (0 is 공).",
      cards: ({ variant, difficulty }) => {
        const phone = String(variant.phone);
        const ko = phoneKo(phone);
        const rr = phoneRr(phone);
        const final = hasBatchim(ko);
        const cards = [
          card("points", "📱", `Give your number: ${phone}`, {
            intent: `Give your phone number for the points: ${phone}, digit by digit (0 is 공).`,
            vocab: [
              { term: "공", reading: "gong", meaning: "zero (in phone numbers)" },
              { term: ko, reading: rr, meaning: `${phone}, read digit by digit` },
            ],
            starter: "네, 공일공…",
            full: `네, ${ko}${final ? "이에요" : "예요"}.`,
            fullReading: `Ne, ${rr}${final ? "ieyo" : "yeyo"}.`,
            fullMeaning: `Yes, it's ${phone}.`,
          }, [ko.split(" ")[1], phone.split("-")[1]], { key: "number", expect: { points: "number" }, core: true }),
          card("points", "🔢", `Just say ${phone}`, {
            intent: `Just say your number: ${phone}, digit by digit.`,
            vocab: [{ term: ko, reading: rr, meaning: `${phone}, read digit by digit` }],
            starter: "공일공…",
            full: `${ko}${final ? "이요" : "요"}.`,
            fullReading: `G${rr.slice(1)}${final ? "iyo" : "yo"}.`,
            fullMeaning: `${phone}.`,
          }, [ko.split(" ")[2], phone.split("-")[2]], { key: "number_only", expect: { points: "number" }, core: true }),
          card("points", "🙅", "No thanks", { ...NO_THANKS_HINTS, intent: "Say no thanks, no points." }, ["괜찮"], { key: "points_no", expect: { points: "no" }, core: true }),
          card("points", "🚫", "Say you're not a member", {
            intent: "Say you're not a member.",
            vocab: [
              { term: "회원", reading: "hoewon", meaning: "member" },
              { term: "아니에요", reading: "anieyo", meaning: "it's not, I'm not" },
            ],
            starter: "회원…",
            full: "회원 아니에요.",
            fullReading: "Hoewon anieyo.",
            fullMeaning: "I'm not a member.",
          }, ["회원"], { key: "not_member", expect: { points: "no" }, core: true }),
          card("ask_signup", "📝", "Ask how to sign up", {
            intent: "Ask how you sign up.",
            vocab: [{ term: "가입", reading: "gaip", meaning: "signing up, joining" }],
            starter: "가입은…",
            full: "가입은 어떻게 해요?",
            fullReading: "Gaibeun eotteoke haeyo?",
            fullMeaning: "How do I sign up?",
          }, ["가입"]),
          card("ask_meaning", "❓", "Ask what 적립 means", {
            intent: "Ask what 적립 means.",
            vocab: [{ term: "적립", reading: "jeongnip", meaning: "collecting (points)" }],
            starter: "적립이…",
            full: "적립이 뭐예요?",
            fullReading: "Jeongnibi mwoyeyo?",
            fullMeaning: "What's 적립?",
          }, ["적립"], { key: "what_points" }),
        ];
        if (difficulty === "immersion")
          cards.push(
            card("points", "📵", "Say you have no carrier discount", {
              intent: "Say you don't have a phone-carrier discount.",
              vocab: [
                { term: "통신사", reading: "tongsinsa", meaning: "phone carrier" },
                { term: "할인", reading: "harin", meaning: "discount" },
                { term: "없어요", reading: "eopseoyo", meaning: "there isn't, I don't have" },
              ],
              starter: "통신사 할인은…",
              full: "통신사 할인은 없어요.",
              fullReading: "Tongsinsa harineun eopseoyo.",
              fullMeaning: "I don't have a carrier discount.",
            }, ["통신사"], { key: "no_carrier", expect: { points: "no" }, core: true }),
          );
        return cards;
      },
      resolve: (ctx) => {
        const { report, slot, state, variant } = ctx;
        const phone = String(variant.phone);
        if (report.intent === "points" || report.intent === "yes" || declines(report)) {
          if (saidPhone(ctx, phone))
            return toPay(state, variant, `Read the number back, digit by digit (${phoneKo(phone)}…), and say the points are in (적립됐습니다).`, { setSlots: { points: "number" } });
          if (slot("points") === "no" || declines(report) || has(report, "아니", "괜찮", "없어", "됐어요"))
            return toPay(state, variant, "Say of course (네~).", { setSlots: { points: "no" } });
          if (slot("points") === "number" || digitsOf(report.heard).length >= 7)
            return stay("info", "points", "Check the screen, puzzled: that number isn't registered. Ask them to say it once more (등록된 번호가 없다고 나오는데요… 다시 한번 말씀해 주시겠어요?).", "That number isn't registered… could you say it once more?", {
              success: false,
              note: "Phone numbers are read digit by digit in Sino-Korean numbers, and 0 is 공: 공일공…",
            });
          return stay("info", "points", "Ask for their phone number (번호 말씀해 주시겠어요?).", "Could you tell me your number?");
        }
        if (report.intent === "ask_signup")
          return stay("info", "points", "Say they just enter their number in the app; you can add today's points by number (앱에서 번호만 입력하시면 돼요. 오늘은 번호로 적립해 드릴까요?).", "Just enter your number in the app. Shall I add today's points by number?");
        return null;
      },
    },
    {
      id: "pay",
      group: "Payment",
      npcGoal: "Tell them the total and take the payment.",
      meaning: "Here's your total. How would you like to pay?",
      situation: "Doyun gave you the total. Pay: by card (insert it, chip first), in cash or with your phone.",
      cards: ({ state, variant, difficulty }) => paymentCards(state, variant, difficulty),
      resolve: ({ report, slot, state, variant, difficulty }) => {
        const t = basketTotal(state.slots, variant);
        const totalLine = (total: number) => `${wonKo(total)} (다 해서 ${wonKo(total)}입니다)`;
        if (needsId(state, variant)) {
          if (report.intent === "show_id" || report.intent === "yes")
            return stay("info", "pay", `Check it and hand it back with a smile (감사합니다~ 동안이시네요!), then tell them the total, ${totalLine(t)}.`, `Thank you~ You look so young! That's ${won(t)} altogether.`, {
              setFlags: { idChecked: true },
            });
          if (report.intent === "ask_id") {
            const residence = has(report, "등록증");
            return stay("info", "pay", `Say yes, ${residence ? "a residence card" : "a passport"} is fine (네, ${residence ? "외국인등록증" : "여권"}도 돼요), and wait for it.`, `Yes, ${residence ? "a residence card" : "a passport"} is fine.`, {
              setFlags: { idAsked: true },
            });
          }
          if (report.intent === "no_id" || declines(report)) {
            const lower = basketTotal({ ...state.slots, noBeer: "yes" }, variant);
            return stay("branch", "pay", `Say sorry, then you'll have to take the beer off (그럼 맥주는 빼 드릴게요), and tell them the new total, ${totalLine(lower)}.`, `Then I'll take the beer off. That's ${won(lower)} altogether.`, {
              setFlags: { idChecked: true },
              setSlots: { noBeer: "yes" },
              note: "No ID, no beer: Korean stores check ID for alcohol.",
            });
          }
          return null;
        }
        if (state.flags.topupOpen) {
          if (report.intent === "topup" || report.intent === "yes") {
            const amount = slot("amount") || (has(report, "오천") ? "five" : has(report, "만 원") ? "ten" : "");
            if (!amount) return stay("info", "pay", "Ask how much: ten thousand or five thousand won? (얼마 충전해 드릴까요? 만 원? 오천 원?)", "How much shall I top up? Ten thousand? Five thousand?");
            const balance = Number(variant.balance) + (amount === "five" ? 5000 : 10000);
            return stay("info", "pay", `Take the cash, top up the card and say the new balance (충전됐습니다. 잔액은 ${wonKo(balance)}이에요). Then remind them of the total for their things, ${totalLine(t)}.`, `Topped up. Your balance is ${won(balance)}. And your things come to ${won(t)}.`, {
              setSlots: { toppedUp: amount },
              setFlags: { topupOpen: false },
            });
          }
          if (report.intent === "decline" || declines(report))
            return stay("info", "pay", `Say sure, another time (네~), then the total again, ${totalLine(t)}.`, `Sure. That's ${won(t)}.`, { setFlags: { topupOpen: false } });
        }
        const asksTopup = report.intent === "ask_topup" || (["ask_payment", "ask_location"].includes(report.intent) && has(report, "충전", "교통카드"));
        if (asksTopup && !state.slots.toppedUp)
          return stay("info", "pay", "Say yes, but top-ups are cash only, and ask how much (네, 충전은 현금만 돼요. 얼마 충전해 드릴까요?).", "Yes, but top-ups are cash only. How much?", { setFlags: { topupOpen: true } });
        // After a failed read, "네, 다시 해 볼게요" may come back as `understood`: it's the retry.
        if (report.intent === "pay" || report.intent === "yes" || (report.intent === "understood" && state.flags.cardFailed)) {
          const fromWords = has(report, "현금") ? "cash" : has(report, "휴대폰") ? "phone" : has(report, "카드") ? "card" : "";
          const method =
            slot("payment_method") || fromWords || (report.intent === "pay" || state.flags.cardFailed ? "card" : state.flags.phoneOk ? "phone" : "");
          if (method === "cash" && cashLeft(state) < t)
            return stay("info", "pay", "Say kindly that their cash won't quite cover it, but cards work (현금이 조금 모자라시네요. 카드도 돼요~).", "The cash won't quite cover it. Cards work too~");
          if (method === "card" && variant.tapFail && !state.flags.cardFailed)
            return stay("branch", "pay", "Ask them to insert the card (꽂아 주세요~), then frown at the terminal: it didn't go through. Ask them to insert it once more (어… 결제가 안 됐네요. 한 번만 다시 꽂아 주시겠어요?).", "Hmm… it didn't go through. Could you insert it once more?", {
              setFlags: { cardFailed: true },
              note: "Card readers can be fussy: insert the chip and try again.",
            });
          if (method) return paid(state, variant, difficulty, method);
        }
        if (report.intent === "ask_payment" || asksAbout(report, "휴대폰", "카드")) {
          if ((slot("payment_method") || (has(report, "휴대폰") ? "phone" : "card")) === "phone")
            return stay("info", "pay", `Say yes, phone payment works (네, 돼요~), and the total is ${totalLine(t)}.`, `Yes, that works~ It's ${won(t)}.`, { setFlags: { phoneOk: true } });
          return stay("info", "pay", "Say that here they need to insert the card, chip first (아, 여기는 꽂으셔야 돼요. 칩 쪽으로 꽂아 주세요~).", "Oh, here you need to insert it, chip first~");
        }
        if (report.intent === "ask_price") return stay("info", "pay", `Repeat the total clearly: ${totalLine(t)}.`, `It's ${won(t)}.`);
        return null;
      },
    },
    {
      id: "receipt",
      group: "Payment",
      npcGoal: "Ask if they'd like the receipt (영수증 드릴까요?).",
      meaning: "Would you like the receipt?",
      situation: "Paid. Doyun asked if you'd like the receipt.",
      cards: () => [
        card("receipt", "🗑️", "Ask him to throw it away", {
          intent: "Ask him to throw the receipt away (the most common answer in Korea).",
          vocab: [
            { term: "버리다", reading: "beorida", meaning: "to throw away" },
            { term: "버려 주세요", reading: "beoryeo juseyo", meaning: "please throw it away" },
          ],
          starter: "버려…",
          full: "버려 주세요.",
          fullReading: "Beoryeo juseyo.",
          fullMeaning: "Please throw it away.",
        }, ["버려"], { key: "toss", expect: { receipt: "no" }, core: true }),
        card("receipt", "🧾", "Yes, please", {
          intent: "Say yes, you'll take the receipt.",
          vocab: [{ term: "주세요", reading: "juseyo", meaning: "please give me" }],
          starter: "네, …",
          full: "네, 주세요.",
          fullReading: "Ne, juseyo.",
          fullMeaning: "Yes, please.",
        }, ["네 주세요"], { key: "keep", expect: { receipt: "yes" }, core: true }),
        card("receipt", "🙅", "No thanks", { ...NO_THANKS_HINTS, intent: "Say no thanks to the receipt." }, ["괜찮"], { key: "receipt_no", expect: { receipt: "no" }, core: true }),
        card("receipt", "✋", "Say you don't need it", {
          intent: "Say you don't need the receipt.",
          vocab: [
            { term: "영수증", reading: "yeongsujeung", meaning: "receipt" },
            { term: "됐어요", reading: "dwaesseoyo", meaning: "no need (lit. it's done)" },
          ],
          starter: "영수증은…",
          full: "영수증은 됐어요.",
          fullReading: "Yeongsujeungeun dwaesseoyo.",
          fullMeaning: "I don't need the receipt.",
        }, ["영수증"], { key: "no_need", expect: { receipt: "no" }, core: true }),
        card("receipt", "📎", "Take it, just in case", {
          intent: "Take it, just in case.",
          vocab: [{ term: "혹시 모르니까", reading: "hoksi moreunikka", meaning: "just in case" }],
          starter: "혹시 모르니까…",
          full: "혹시 모르니까 주세요.",
          fullReading: "Hoksi moreunikka juseyo.",
          fullMeaning: "Just in case, I'll take it.",
        }, ["모르니까"], { key: "just_in_case", expect: { receipt: "yes" }, core: true }),
        card("ask_refund", "↩️", "Ask if you need it for a refund", {
          intent: "Ask if you'd need the receipt for a refund.",
          vocab: [
            { term: "환불", reading: "hwanbul", meaning: "refund" },
            { term: "필요해요?", reading: "piryohaeyo?", meaning: "is it needed?" },
          ],
          starter: "환불할 때…",
          full: "환불할 때 필요해요?",
          fullReading: "Hwanbulhal ttae piryohaeyo?",
          fullMeaning: "Do I need it for a refund?",
        }, ["환불"]),
      ],
      resolve: ({ report, slot }) => {
        const answers = report.intent === "receipt" || report.intent === "yes" || declines(report);
        const choice =
          declines(report) || has(report, "버려", "됐어요", "괜찮")
            ? "no"
            : slot("receipt") || (has(report, "주세요") || report.intent === "yes" ? "yes" : "");
        if (answers && choice) {
          const line = choice === "no" ? "Crumple it into the bin with a smile (네~)." : "Hand them the receipt (여기요~).";
          return advance(
            "ramen",
            `${line} Then tell them they can cook the ramen at the machine by the window, and ask if it's their first time (라면은 창가 쪽 기계에서 끓이시면 돼요. 처음이세요?).`,
            "You can cook the ramen at the machine by the window. First time?",
            { setSlots: { receipt: choice } },
          );
        }
        if (report.intent === "ask_refund")
          return stay("info", "receipt", "Say yes, they'd need it for an exchange or a refund (네, 교환이나 환불할 땐 있어야 돼요), and ask again if they'd like it.", "Yes, you'd need it for an exchange or refund. Would you like it?");
        return null;
      },
    },
    {
      id: "ramen",
      group: "Ramen & goodbye",
      aliases: { no: "understood" },
      npcGoal: "Help them with the ramen machine by the window (처음이세요?).",
      meaning: "First time with the machine?",
      situation: "Time for ramen: the machine is by the window. Doyun asked if it's your first time.",
      cards: ({ state }) => [
        card("ask_machine", "🍜", "Say it's your first time, ask how", {
          intent: "Say yes, it's your first time, and ask how it works.",
          vocab: [
            { term: "처음", reading: "cheoeum", meaning: "the first time" },
            { term: "어떻게 해요?", reading: "eotteoke haeyo?", meaning: "how do I do it?" },
          ],
          starter: "네, 처음인데…",
          full: "네, 처음인데 어떻게 해요?",
          fullReading: "Ne, cheoeuminde eotteoke haeyo?",
          fullMeaning: "Yes, it's my first time. How does it work?",
        }, ["처음", "어떻게"], { key: "how", core: true }),
        card("ask_slower", "🐢", "Ask him to say it again, slowly", {
          intent: "Ask him to say it once more, slowly.",
          vocab: [
            { term: "천천히", reading: "cheoncheonhi", meaning: "slowly" },
            { term: "한 번 더", reading: "han beon deo", meaning: "once more" },
          ],
          starter: "죄송한데, 천천히…",
          full: "죄송한데, 천천히 한 번 더 말해 주실 수 있어요?",
          fullReading: "Joesonghande, cheoncheonhi han beon deo malhae jusil su isseoyo?",
          fullMeaning: "Sorry, could you say that once more, slowly?",
        }, ["천천히"], { key: "slower" }),
        ...(state.flags.stepsHeard
          ? [
              card("understood", "👍", "Say you've got it", {
                intent: "Say you've got it and you'll give it a try.",
                vocab: [
                  { term: "알겠어요", reading: "algesseoyo", meaning: "got it, I understand" },
                  { term: "해 볼게요", reading: "hae bolgeyo", meaning: "I'll give it a try" },
                ],
                starter: "알겠어요! …",
                full: "알겠어요! 해 볼게요.",
                fullReading: "Algesseoyo! Hae bolgeyo.",
                fullMeaning: "Got it! I'll give it a try.",
              }, ["알겠어요"], { key: "got_it", core: true }),
            ]
          : []),
        card("understood", "😎", "Say you've used one before", {
          intent: "Say no, you've used one before.",
          vocab: [{ term: "해 봤어요", reading: "hae bwasseoyo", meaning: "I've done it before" }],
          starter: "아니요, 해…",
          full: "아니요, 해 봤어요. 감사합니다!",
          fullReading: "Aniyo, hae bwasseoyo. Gamsahamnida!",
          fullMeaning: "No, I've used one before. Thanks!",
        }, ["해 봤어요"], { key: "done_before", core: true }),
        card("ask_wait_time", "⏱️", "Ask how long it takes", {
          intent: "Ask how many minutes it takes.",
          vocab: [{ term: "몇 분", reading: "myeot bun", meaning: "how many minutes" }],
          starter: "몇 분…",
          full: "몇 분 걸려요?",
          fullReading: "Myeot bun geollyeoyo?",
          fullMeaning: "How many minutes does it take?",
        }, ["몇 분"], { key: "minutes" }),
        card("ask_recommendation", "🍙", "Ask what goes well with it", {
          intent: "Ask what tastes good with it.",
          vocab: [
            { term: "같이", reading: "gachi", meaning: "together" },
            { term: "맛있는 거", reading: "masinneun geo", meaning: "something tasty" },
          ],
          starter: "같이 먹으면…",
          full: "같이 먹으면 맛있는 거 있어요?",
          fullReading: "Gachi meogeumyeon masinneun geo isseoyo?",
          fullMeaning: "Anything that tastes good with it?",
        }, ["같이"], { key: "combo" }),
        card("ask_seat", "🪑", "Ask where to sit", {
          intent: "Ask where you can eat.",
          vocab: [
            { term: "어디서", reading: "eodiseo", meaning: "where (at)" },
            { term: "먹으면 돼요?", reading: "meogeumyeon dwaeyo?", meaning: "may I eat…?" },
          ],
          starter: "어디서…",
          full: "어디서 먹으면 돼요?",
          fullReading: "Eodiseo meogeumyeon dwaeyo?",
          fullMeaning: "Where can I eat?",
        }, ["어디서"], { key: "seat" }),
      ],
      resolve: ({ report, state }) => {
        const steps =
          "explain the three steps, matching the sign on the window: first put the noodles and soup powder in the bowl, then set it on the machine and press button one; three minutes (먼저 용기에 면이랑 스프를 넣으세요. 그다음에 기계에 올리고, 일 번 버튼을 누르시면 돼요. 삼 분이면 끝나요!)";
        if (report.intent === "ask_machine" || (report.intent === "yes" && !state.flags.stepsHeard))
          return stay("info", "ramen", `Smile and ${steps}.`, "First, put the noodles and soup powder in the bowl. Then set it on the machine and press button one. Three minutes and it's done!", {
            setFlags: { stepsHeard: true },
          });
        if (report.intent === "understood" || report.intent === "thanks" || report.intent === "yes") {
          // Heard the steps, or used one before: just "enjoy". "Got it" before the steps gets the short version.
          const knowsHow = state.flags.stepsHeard || has(report, "해 봤", "알아요", "아니");
          return advance(
            "leave",
            knowsHow ? "Say enjoy (네~ 맛있게 드세요!)." : `Quickly ${steps}, then say enjoy (맛있게 드세요!).`,
            knowsHow ? "Enjoy~" : "Noodles and soup in the bowl, onto the machine, button one. Enjoy!",
            { events: ["order_placed", "time_skip"] },
          );
        }
        if (report.intent === "ask_wait_time") return stay("info", "ramen", "Say three minutes (삼 분이요).", "Three minutes.");
        if (report.intent === "ask_recommendation")
          return stay("info", "ramen", "Share a honey tip: dunk the triangle kimbap in the ramen broth, a real honey combo (삼각김밥 라면 국물에 말아 드세요. 진짜 꿀조합이에요!).", "Dunk your kimbap in the ramen broth. It's a real honey combo!");
        if (report.intent === "ask_seat" || asksAbout(report, "어디서", "자리"))
          return stay("info", "ramen", "Say they can sit anywhere at the window counter and watch the rain (창가 자리 편하게 쓰세요. 비 구경하면서 드세요~).", "Sit anywhere by the window. Watch the rain while you eat~");
        return null;
      },
    },
    {
      id: "leave",
      group: "Ramen & goodbye",
      learnerOpens: "Your ramen is gone and the rain is still pouring. Say goodbye on your way out: you speak first.",
      npcGoal: "Respond to the customer as they leave.",
      meaning: "",
      situation: "You've eaten. Say goodbye to Doyun on your way out into the rain.",
      cards: ({ state, variant }) => {
        const cards = [
          card("goodbye", "🙇", "Wish him an easy shift", {
            intent: "Say what Koreans say to someone at work as they leave.",
            vocab: [{ term: "수고하세요", reading: "sugohaseyo", meaning: "take it easy (said to someone working)" }],
            starter: "수고…",
            full: "수고하세요!",
            fullReading: "Sugohaseyo!",
            fullMeaning: "Take it easy!",
          }, ["수고"], { key: "sugo", core: true }),
          card("goodbye", "👋", "Say it was delicious, then goodbye", {
            intent: "Say the meal was great, and goodbye (you're the one leaving).",
            vocab: [
              { term: "잘 먹었습니다", reading: "jal meogeotseumnida", meaning: "that was delicious (after eating)" },
              { term: "안녕히 계세요", reading: "annyeonghi gyeseyo", meaning: "goodbye (to someone staying)" },
            ],
            starter: "잘 먹었습니다! …",
            full: "잘 먹었습니다! 안녕히 계세요!",
            fullReading: "Jal meogeotseumnida! Annyeonghi gyeseyo!",
            fullMeaning: "That was delicious! Goodbye!",
          }, ["계세요", "잘 먹었습니다"], { key: "bye", core: true }),
          card("come_again", "🌙", "Say you'll come again", {
            intent: "Tell him you'll be back.",
            vocab: [
              { term: "또", reading: "tto", meaning: "again" },
              { term: "올게요", reading: "olgeyo", meaning: "I'll come" },
            ],
            starter: "또…",
            full: "또 올게요!",
            fullReading: "Tto olgeyo!",
            fullMeaning: "I'll come again!",
          }, ["올게요"], { core: true }),
          card("goodbye", "🌧️", "Thank him for the long night", {
            intent: "Acknowledge his long night shift as you leave.",
            vocab: [
              { term: "밤새", reading: "bamsae", meaning: "all night" },
              { term: "고생 많으세요", reading: "gosaeng maneuseyo", meaning: "you're working so hard" },
            ],
            starter: "밤새…",
            full: "밤새 고생 많으세요. 수고하세요!",
            fullReading: "Bamsae gosaeng maneuseyo. Sugohaseyo!",
            fullMeaning: "You're working hard all night. Take it easy!",
          }, ["고생"], { key: "long_night", core: true }),
          card("compliment", "🎶", "Compliment his voice", {
            intent: "Tell him he has a lovely voice.",
            vocab: [
              { term: "목소리", reading: "moksori", meaning: "voice" },
              { term: "좋으세요", reading: "joeuseyo", meaning: "is nice (polite)" },
            ],
            starter: "목소리…",
            full: "목소리 진짜 좋으세요!",
            fullReading: "Moksori jinjja joeuseyo!",
            fullMeaning: "You have a really nice voice!",
          }, ["목소리"], { key: "voice" }),
          card("greet", "🐈", "Say bye to the cat", {
            intent: "Say bye to 참치, the cat by the door.",
            vocab: [
              { term: "참치", reading: "chamchi", meaning: "tuna (the cat's name)" },
              { term: "안녕", reading: "annyeong", meaning: "bye (casual)" },
            ],
            starter: "참치야…",
            full: "참치야, 안녕!",
            fullReading: "Chamchiya, annyeong!",
            fullMeaning: "Bye, Chamchi!",
          }, ["참치"], { key: "bye_cat" }),
        ];
        if (variant.umbrella && !state.flags.umbrellaOffered && !state.flags.umbrellaForSale)
          cards.push(
            card("ask_umbrella", "☂️", "Ask if he has an umbrella", {
              intent: "You have no umbrella: ask if he has one.",
              vocab: [{ term: "우산", reading: "usan", meaning: "umbrella" }],
              starter: "혹시 우산…",
              full: "혹시 우산 있어요?",
              fullReading: "Hoksi usan isseoyo?",
              fullMeaning: "Do you have an umbrella, by any chance?",
            }, ["우산"], { key: "umbrella" }),
          );
        if (state.flags.umbrellaOffered)
          cards.push(
            card("thanks", "🙏", "Thank him for the umbrella", {
              intent: "Thank him for the umbrella and promise to bring it back.",
              vocab: [
                { term: "정말", reading: "jeongmal", meaning: "really, so much" },
                { term: "꼭", reading: "kkok", meaning: "for sure" },
                { term: "갖다드릴게요", reading: "gatdadeurilgeyo", meaning: "I'll bring it back (to you)" },
              ],
              starter: "정말 감사합니다! …",
              full: "정말 감사합니다! 다음에 꼭 갖다드릴게요.",
              fullReading: "Jeongmal gamsahamnida! Daeume kkok gatdadeurilgeyo.",
              fullMeaning: "Thank you so much! I'll definitely bring it back next time.",
            }, ["갖다드릴게요", "다음에"], { key: "thanks_umbrella", core: true }),
          );
        if (state.flags.umbrellaForSale && !state.slots.umbrella)
          cards.push(
            card("buy_umbrella", "🛒", "Buy the umbrella", {
              intent: "Say you'll buy one.",
              vocab: [{ term: "살게요", reading: "salgeyo", meaning: "I'll buy" }],
              starter: "그럼 하나…",
              full: "그럼 하나 살게요.",
              fullReading: "Geureom hana salgeyo.",
              fullMeaning: "Then I'll buy one.",
            }, ["살게요"], { key: "buy_umbrella", core: true }),
          );
        return cards;
      },
      resolve: ({ report, state, variant }) => {
        const lend =
          "Stop them kindly: wait, they don't have an umbrella, do they? Hand them one from the lost-and-found bucket; they can bring it back whenever (아, 손님! 잠깐만요. 우산 없으시죠? 이거 쓰세요. 손님들이 두고 간 우산이에요. 나중에 갖다주시면 돼요~).";
        const lendMeaning = "Oh, wait! You don't have an umbrella, right? Take this one. Customers left it behind. Bring it back whenever~";
        const lent: Partial<Outcome> = { setFlags: { umbrellaOffered: true }, setSlots: { umbrella: "lent" } };
        const slip = SAYS_GASEYO.test(report.heard);
        if (report.intent === "ask_umbrella" || asksAbout(report, "우산")) {
          if (variant.umbrella === "lend") return stay("info", "leave", lend, lendMeaning, lent);
          if (variant.umbrella === "sell")
            return stay("info", "leave", "Say the clear umbrellas by the door are five thousand won (투명 우산 오천 원이에요).", "The clear umbrellas are 5,000 won.", { setFlags: { umbrellaForSale: true } });
          return stay("info", "leave", "Apologize: you're out of umbrellas, but the rain should ease soon (죄송해요, 우산이 다 나갔어요. 곧 그칠 거예요).", "Sorry, we're out of umbrellas. It should ease up soon.");
        }
        if (["buy_umbrella", "yes", "pay"].includes(report.intent) && state.flags.umbrellaForSale && !state.slots.umbrella)
          return stay("info", "leave", "Ring it up: they insert the card again (카드 다시 꽂아 주세요~), then hand it over (비 조심하세요!).", "Insert your card again~ Here you go. Careful in the rain!", {
            events: ["payment_done"],
            setSlots: { umbrella: "bought" },
          });
        if (report.intent === "goodbye" || report.intent === "thanks" || report.intent === "come_again") {
          // On the way out without an umbrella, he stops them first (and laughs off a 가세요 slip).
          if (variant.umbrella === "lend" && !state.flags.umbrellaOffered)
            return stay("info", "leave", `${slip ? "Laugh softly: you're the one staying (하하, 저는 여기 있을게요~). Then " : ""}${lend}`, slip ? `Haha, I'm the one staying~ ${lendMeaning}` : lendMeaning, {
              ...lent,
              ...(slip ? { success: false, note: SLIP_NOTE } : {}),
            });
          if (slip)
            return complete("leave", "Laugh softly: you're the one staying (하하, 저는 여기 있을게요~), then send them off warmly (안녕히 가세요! 조심히 들어가세요).", "Haha, I'm the one staying here~ Goodbye! Get home safe.", {
              success: false,
              note: SLIP_NOTE,
            });
          return complete(
            "leave",
            report.intent === "come_again"
              ? "Say you'd love that, then a warm final goodbye (네~ 또 오세요! 비 오니까 조심히 들어가세요!)."
              : "Say a warm final goodbye in one short sentence (감사합니다~ 비 오니까 조심히 들어가세요!).",
            report.intent === "come_again" ? "Please do! It's raining, so get home safe!" : "Thank you~ It's raining, so get home safe!",
          );
        }
        if (report.intent === "compliment")
          return stay("info", "leave", "Get a little shy: thank them, and admit you're practicing singing (아… 감사합니다. 사실 노래 연습하고 있어요).", "Oh… thank you. Actually, I'm practicing singing.");
        if (report.intent === "greet" && has(report, "참치", "고양이")) return stay("info", "leave", "Laugh: 참치 says bye too (하하, 참치도 인사하네요~).", "Haha, Chamchi says bye too~");
        return null;
      },
    },
  ],
};
