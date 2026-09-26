# Babbli

**Walk in. Figure out what to say.** — HackTheHill III submission

Babbli is a first-person language-practice simulator. You don't chat with an AI: you walk into a New York department store, a Tokyo ramen shop, a Paris café or a Sevilla hotel, and you have to *get something done* — find the right item, order, answer the follow-up, pay, fix a broken reservation — by speaking to a character who only speaks the local language.

> We simulate the situations you're actually going to encounter — before you encounter them.

| Scene | Language | Objective | Role |
|---|---|---|---|
| Whitmore's · New York department store | English | Find a specific gift, handle a sold-out item, buy it | Hero scenario |
| 麺屋ほし · Tokyo ramen shop | Japanese | Order food, answer a follow-up, pay | Generalization |
| Café des Lilas · Paris | French | Order, respond to clarification, ask for the bill | Generalization |
| Hotel Azahar · Sevilla | Spanish | Check in and resolve a reservation problem | Generalization |

## How it uses ElevenLabs

**ElevenAgents is the core.** Every NPC (Jordan, Hiroshi, Camille, Lucía) is an ElevenLabs Agent:

- **Real-time voice conversation** over a signed-URL WebSocket session (`@elevenlabs/react` `ConversationProvider`), with per-session overrides for the system prompt, first line, TTS speed (slower for beginners) and ASR keywords (menu items, names).
- **A client tool per scene** (`babbli_report_turn_<scene>`). After every learner utterance the agent reports its interpretation (intent, whether the question was answered, language used, extracted slots like dish or payment method). Babbli's deterministic state machine decides what's true and returns the NPC's next instruction. The LLM writes the words; the application controls progression and completion.
- **Expressive speech** with `eleven_v3_conversational` and suggested audio tags (`[apologetic]` when something is sold out, `[confused]` when it didn't understand you).
- **Patient turn-taking** for learners, a controlled mic mute (the learner speaks after choosing an intention), and `sendUserActivity` so the NPC doesn't nag while you read hints.
- **Post-call analysis** configured on the agent: evaluation criteria (objective completed; numeric comprehension, target-language use, politeness scores) and data collection (strengths, suggestions, corrections, key expressions, a translation of everything the NPC said). This analysis appears on the results page as the NPC's review.

**ElevenCreative is the immersion layer:**

- **Voice Design** creates every character voice from a text description in its native language: NPCs, background characters (the store PA announcer, the chef shouting orders, the barista, the bellhop) and a native "coach" voice per language.
- **Sound Effects** generate the seamless looping ambience for each venue plus one-shots (sliding door and bell, bowl on the counter, espresso machine, elevator ding, cash register, UI chimes).
- **Eleven Music** composes the main-menu theme.
- **Text to Speech with timestamps** powers Repeat/Slow (the NPC's own voice with karaoke subtitles), the level-5 audio hint, and the native reference audio compared against your recording.

**Scribe (speech-to-text)** transcribes each learner turn with word timestamps and per-word confidence. That drives pauses, pace against the native reference, hesitation, recognition clarity and "hard to recognise" words.

## Quick start

Requires Node 20+ and an ElevenLabs API key with access to Agents, TTS, STT, Voice Design, Sound Effects and Music (the Creator plan covers this).

```bash
npm install
cp .env.example .env.local        # add ELEVENLABS_API_KEY
npm run setup                     # designs voices, creates agents + tools, generates ambience/SFX/music (one-time)
npm run dev                       # http://localhost:3000
```

`npm run setup` is optional: everything is also provisioned lazily the first time it's needed. It's much faster to do it up front before a demo. The **ElevenLabs Studio** page (`/studio`) shows every provisioned resource with previews, links to the agents in the ElevenLabs dashboard, and buttons to (re)generate them.

Other scripts: `npm run simulate` (plays all scenarios × difficulties × 60 seeds through the state machine offline), `npm run typecheck`, `npm run lint`, `npm run build`.

## The experience

1. **Choose a destination, scene, difficulty and how you'll talk.** Beginner (slower speech, subtitles + optional English, full hints), Intermediate (natural speed, unexpected follow-ups), Immersion (native speed, colloquial, no subtitles, louder ambience, you ask for clarification yourself). Then pick Live conversation or Push-to-talk.
2. **You're in the scene straight away.** A full-screen illustrated scene with ambient sound. The NPC has idle, speaking (mouth driven by the live audio amplitude), listening, thinking, confused and happy states.
3. **Pick what you want to say.** Three intention cards describe *what* to communicate ("Ask what he recommends"), never the sentence itself.
4. **Say it yourself.** The mic opens, the NPC listens, and the conversation branches: sold-out dishes, cash-only shops, a waiter who mishears your order, a missing reservation.
5. **Get help if you need it:** 💡 a five-step hint ladder (intent → key words → sentence starter → full sentence → native audio), 🔁 repeat, 🐢 slow, CC subtitles, EN translation (beginner; in the English scene it is a simpler-English paraphrase instead). Every use is recorded.
6. **See how you did:** completion status; separate comprehension, speaking clarity, fluency, vocabulary and independence scores; what you handled well and struggled with; the NPC's review; a turn-by-turn replay with your recording against the native reference on a shared timeline; and the scene's vocabulary with audio.

Keyboard: `1–3` choose · `Space` talk/done · `H` hint · `R` repeat · `S` slow · `C` subtitles · `T` English.

## Architecture

```
Browser (Next.js, React, Tailwind, Framer Motion)
 ├─ Scene: layered SVG art + NPC character + subtitles + cards + controls
 ├─ GameController ─────────────── ElevenAgents session (WebSocket)
 │   ├─ state machine (src/lib/engine) ◀── client tool call: {intent, slots, answered?, language}
 │   │                                  ──▶ "NEXT LINE: …" directive → NPC speaks it
 │   ├─ MediaRecorder (raw audio per turn) → /api/stt (Scribe) → word timings
 │   └─ Web Audio mixer: ambience + ducking, SFX, replays, lip-sync analyser
 └─ Dashboard: scoring (src/lib/evaluation) + native reference TTS + agent analysis
Server (Next.js route handlers)
 ├─ /api/agent/session   provision agent/tool/voice once → signed URL
 ├─ /api/tts, /api/stt, /api/assets/[id]   ElevenLabs TTS / Scribe / SFX + Music (disk-cached)
 ├─ /api/sessions/...    session JSON, per-turn recordings, post-call analysis
 └─ /api/studio          provisioning status + actions
Storage: .babbli/ (registry of ElevenLabs resources, generated audio, sessions + recordings)
```

Before a scene, the learner chooses **how to respond**, and it's fixed for the session (saved as `responseMode`):

- **Voice Mode** — the microphone and nothing else (no typing). **Live** means the agent hears the mic directly and handles turn-taking; **Push-to-talk** records the turn, transcribes it with Scribe, and sends the text to the agent, so learners who pause mid-sentence aren't cut off. Beginner recommends push-to-talk, the others live.
- **Text Mode** — a text composer instead of the mic, for practising somewhere quiet. The same agent runs as an ElevenAgents text-only conversation (the microphone is never requested), and each NPC line is voiced with ElevenLabs TTS in the character's designed voice.

The mode only changes how the learner responds and which measurements are valid — the scenario engine, cards, branching, hints and progression are identical. Evaluation is mode-aware (`src/lib/evaluation/scoring.ts`): Voice sessions report Comprehension, Speaking clarity, Fluency, Vocabulary and Independence plus per-reply speech analytics; Text sessions report Comprehension, Language accuracy, Vocabulary, Independence and Task performance, with the speech metrics marked "not measured" and excluded from everything rather than scored as zero.

## Requirements coverage

| Requirement (spec section) | Where |
|---|---|
| Core flow: language → scenario → difficulty → scene → voice → branching → objective → dashboard (§1) | `src/components/menu`, `src/components/game`, `src/components/dashboard` |
| Structured scenarios: location, NPC, objective, required/optional info, branching, unavailable items, misunderstandings, recovery, completion (§2, §11) | `src/lib/scenarios/*.ts`, `src/lib/engine/engine.ts` |
| NPC in the target language, remembers, follows up, never gives the answer, stays in scene, varies wording (§3) | `src/lib/engine/agentConfig.ts` (prompt + tool), per-run variants |
| ElevenLabs TTS/STT, raw audio capture, multiple voices, ambient audio below dialogue (§4) | `src/lib/server/*`, `src/lib/client/audioEngine.ts`, `recorder.ts` |
| Difficulty system (§5) | `DIFFICULTIES` in `src/lib/scenarios/types.ts`, speed/ambience/subtitle/turn settings in `controller.ts` |
| Progressive hints 1–5, tracked (§6) | `HintPanel.tsx`, `controller.ts` (`recordAssist`) |
| Speaking evaluation: clarity, timing, fluency, pauses, hesitation, rate, similarity, native reference comparison; no fake phoneme score (§7) | `src/lib/evaluation/speech.ts`, `RhythmChart.tsx` |
| Comprehension separate from pronunciation; missed questions, clarifications, recovery (§8) | `src/lib/evaluation/scoring.ts` |
| Dashboard: completion, five scores, independence, strengths/struggles, vocabulary, playback comparison (§9) | `src/components/dashboard` |
| First-person UI, NPC states, compact controls, mouth movement, reactions tied to state (§10) | `src/components/game`, `src/components/art` |
| Per-turn data: audio, transcript, times, word timestamps, NPC prompt, expected/detected intent, progress, hints, repeats (§12) | `LearnerTurn` in `src/lib/session/types.ts` ("Turn data" table on the dashboard) |

## Adding a scenario

Scenes are data. Copy `src/lib/scenarios/cafe.ts`, then define stages (each with three intention cards, hints, and a `resolve` function returning an outcome), slots, greetings per difficulty, facts, persona and vocabulary. Register the new file in `src/lib/scenarios/index.ts`. Add voices to `VOICE_DEFS` and sounds to `AUDIO_ASSETS`. For art, either add a vector scene in `src/components/art/scenes` or set `backgroundImage` and `npc.sprites` (transparent PNG/WebP per state: idle, speaking, listening, thinking, confused, positive) to use illustrated assets. The agent and its tool are generated from the definition automatically.

## Configuration

See `.env.example`. The defaults are `claude-haiku-4-5` for the NPC LLM inside ElevenAgents (low latency matters in voice), ElevenLabs' default model for post-call analysis (only some LLMs are allowed there), `eleven_v3_conversational` for agent voices, `eleven_v3` (with the language pinned) for replays, hint audio and native references, and `scribe_v2` for STT. If ElevenLabs rejects part of the agent config for your account, provisioning adjusts only the rejected field (for example switching to `eleven_flash_v2_5`), and the Studio page shows what was adjusted.

## Notes and limitations

- Scores are feedback signals, not certification. "Speaking clarity" is Scribe's recognition confidence, not a phoneme-level pronunciation score (forced alignment is future work).
- Data is stored on local disk under `.babbli/`. For a serverless deploy, point `BABBLI_DATA_DIR` at writable storage.
- The English "meaning" shown under subtitles for beginners comes from the state machine's description of what the NPC was told to say. The dashboard's full translations come from ElevenAgents post-call analysis.
