# Babbli

Built at [HackTheHill III](https://hackthehill.com/) and **won four awards**.

- 🥉 **Winner of General Challenge: Third Place**
- 🎙️ **Best Project Built with ElevenLabs** (Best Use of ElevenLabs)
- 📚 **Best Educational Project** — MathemaTech: Education for Everyone
- 🎨 **Best UI/UX**

## What is Babbli?

**Walk in. Figure out what to say.** 

Babbli is a first-person language-practice simulator. You don't chat with an AI: you walk into a real-feeling place and have to *get something done* by talking to a character who only speaks the local language. Find a gift, order dinner, answer a follow-up question, pay, or fix a broken hotel booking.

> We simulate the situations you're actually going to encounter, before you encounter them.

| Scene | Language | Your goal |
|---|---|---|
| Whitmore's department store, New York (featured) | English | Find a navy wool scarf for your sister, handle a sold-out item, buy it |
| 麺屋ほし ramen shop, Tokyo | Japanese | Order food, answer the waiter's follow-up, pay |
| Café des Lilas, Paris | French | Order breakfast, answer a question about your order, ask for the bill |
| Hotel Azahar, Sevilla | Spanish | Check in and sort out a problem with your reservation |
| 晴茶 boba shop, Shanghai | Mandarin Chinese | Order a milk tea with the topping you like, get the sweetness and ice right, pay by QR code, and pick up your number |
| 달빛24 convenience store, Seoul (new) | Korean | Find the pimple patches, grab the 1+1 deal at checkout, pay, cook your ramen at the machine, and head back out into the midnight rain |

<img width="1920" height="989" alt="thumbnail_newer" src="https://github.com/user-attachments/assets/5519caf1-fdff-4cdb-b7b1-a348fef8c276" />


## How it works

1. **Pick a destination, a difficulty and how you'll answer.** Speak with your voice (push-to-talk or a live conversation), or type your replies in Text Mode.
2. **Step into the scene.** An illustrated room with its own ambient sound and a character who greets you in their language.
3. **Choose what you want to say.** Three cards describe *what* to get across ("Ask where the scarves are"), never the exact sentence.
4. **Say it your way.** The character understands you, reacts and keeps the story going. Things can go wrong on purpose: sold-out dishes, a waiter who mishears your order, a card machine that's down, a missing reservation, a cashier who hears 香草 (vanilla) when you said 仙草 (grass jelly).
5. **Get help if you need it:** a five-step hint ladder (from "what to say" up to hearing a native speaker say it), Repeat, Slow, subtitles, and a translation on Beginner. Every bit of help is noted.
6. **See how you did.** Once you complete the scene, the results page shows your scores, what went well, what to work on, the character's written review, a replay of every reply next to a native speaker, and the scene's vocabulary with audio.

**Difficulty levels**
- **Beginner:** subtitles you can switch off, an English translation, full hints, more time to answer.
- **Intermediate:** natural pace, subtitles always on, surprise questions.
- **Immersion:** native speed, no subtitles or hints, and a noisier room.

**Your Traveler Profile** (optional): choose a nickname, pronouns and an avatar, set your favourite destination and defaults, and pick a coach voice. Finishing scenes earns cosmetic passport pins. Everything is saved in your own browser, with no account needed. Characters in French and Spanish use your pronouns for grammar (for example *bienvenida* or *bienvenido*), and in Shanghai the tea shop staff may call you 帅哥 or 美女, the way they do in China. In Seoul, the night-shift clerk calls everyone 손님 (customer), as Korean shop staff do.

Keyboard shortcuts: `1–3` choose a card · `Space` talk or finish · `H` hint · `R` repeat · `S` slow · `C` subtitles · `T` translation.

## The idea behind it

**The AI talks, the code decides.** Each character is an ElevenLabs Agent that understands what you say and replies naturally. But the character doesn't decide what happens. After every reply, it reports what it thinks you meant to Babbli's scenario engine, and the engine decides the rest: whether you're understood, whether the scene moves on, what's in stock. It then tells the character what to say next, in its own words.

That keeps every scene fair, reliable and gradable, while the conversation still feels natural. An offline simulator plays the scenes 1,620 times to check that every path can be finished.

## How we use ElevenLabs

- **Agents** are the characters: speech recognition, a language model, natural turn-taking and an expressive voice in one live conversation.
- **Client tools** let each character report your replies to the scenario engine.
- **Signed URLs** let your browser join the conversation without the API key ever leaving our server.
- **Post-call analysis** writes each character's review of your conversation on the results page.
- **Voice Design** created 26 native-sounding voices: the six characters, background voices (a store announcer, a ramen chef, a barista, a bellhop, a bubble tea maker, a pickup-call system, a ramen machine and a late-night radio DJ) and two native coaches in each language.
- **Text to Speech** powers Repeat and Slow, the audio hint, the native-speaker reference on the results page, and the character's voice in Text Mode, with word-by-word karaoke subtitles.
- **Scribe** transcribes your replies with the timing of every word, which drives the fluency analysis (speaking pace, pauses, filler words), plus live captions while you speak.
- **Sound Effects** made the looping room ambience and every sound effect; **Eleven Music** composed the menu theme and the Seoul store's late-night radio.

## Built with

- **Next.js 16** and **React 19**, written in **TypeScript**
- **Tailwind CSS** for styling and **Framer Motion** for interface animations
- **Zustand** for game state
- **ElevenLabs React and JavaScript SDKs**
- Hand-drawn **SVG** scenes and characters, animated with CSS and a small custom animation loop (no game engine or image files)

## Getting started

You need Node 20 or newer and an ElevenLabs API key with access to Agents, Text to Speech, Speech to Text, Voice Design, Sound Effects and Music.

```bash
npm install
cp .env.example .env.local        # add your ELEVENLABS_API_KEY
npm run setup                     # optional: creates the voices, characters and sounds up front
npm run dev                       # open http://localhost:3000
```

`npm run setup` is optional because everything is created automatically the first time it's needed. Running it before a demo means nobody has to wait.

Other commands: `npm run simulate` (plays every scene offline to check nothing gets stuck), `npm run typecheck`, `npm run lint`, `npm run build` and `npm start`.

## Good to know

- Scores are feedback, not a certification. "Speaking clarity" measures how easily speech recognition understood you, not a detailed pronunciation grade. Speaking pace follows published research (Kormos & Dénes, 2004); the other speech measures are Babbli's own feedback.
- Scores only appear for completed scenes.
- The public version has no login, so anyone with the link uses the same ElevenLabs credits.

**Thank you for reading! We hope you enjoy Babbli!**
