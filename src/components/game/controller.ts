"use client";

import type { ConversationControlsValue, HookOptions } from "@elevenlabs/react";
import { buildNpcPrompt } from "@/lib/engine/agentConfig";
import {
  createInitialState,
  currentCards,
  formatDirective,
  getStage,
  normalizeReport,
  pick,
  progressGroups,
  resolveTurn,
  seededRandom,
} from "@/lib/engine/engine";
import { stripAudioTags } from "@/lib/evaluation/text";
import { api, assetUrl } from "@/lib/client/api";
import { audioEngine } from "@/lib/client/audioEngine";
import { MicRecorder, type Recording } from "@/lib/client/recorder";
import type { Difficulty, InputMode, IntentCard, ScenarioDef, SceneEventId, TurnReport } from "@/lib/scenarios/types";
import type { LearnerTurn, NpcLine, SessionRecord } from "@/lib/session/types";
import { createGameStore, type GameStore, type GameUI, type Phase } from "./store";

const AGENT_SPEED: Record<Difficulty, number> = { beginner: 0.85, intermediate: 1, immersion: 1.08 };
const REPLAY_SPEED: Record<Difficulty, number> = { beginner: 0.9, intermediate: 1, immersion: 1.05 };
const AMBIENT_BASE: Record<Difficulty, number> = { beginner: 0.18, intermediate: 0.22, immersion: 0.32 };
/** Scene events that play out after the NPC finishes the line that caused them. */
const DEFERRED: SceneEventId[] = ["order_placed", "time_skip", "served"];

const rid = (n = 8) => crypto.randomUUID().replace(/-/g, "").slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GameController {
  readonly store: GameStore;
  readonly session: SessionRecord;
  private controls: ConversationControlsValue | null = null;
  private recorder = new MicRecorder();
  private audio = audioEngine();
  private lastNpcLine: NpcLine | null = null;
  private pendingMeaning: string | null = null;
  private activeTurn: LearnerTurn | null = null;
  private pendingAssist = { hints: [] as number[], repeats: 0, slows: 0, translations: 0 };
  private deferredEvents: SceneEventId[] = [];
  private agentSpeaking = false;
  private listeningTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private activityTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private background: Promise<unknown>[] = [];
  private replayHandle: { stop: () => void } | null = null;
  private narrationPending = false;
  private disposed = false;

  constructor(
    readonly scenario: ScenarioDef,
    readonly difficulty: Difficulty,
    inputMode: InputMode,
  ) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const state = createInitialState(scenario);
    const variant = scenario.makeVariant(difficulty, seededRandom(seed));
    this.session = {
      id: crypto.randomUUID(),
      version: 1,
      scenarioId: scenario.id,
      language: scenario.language,
      difficulty,
      inputMode,
      seed,
      startedAt: Date.now(),
      status: "active",
      variant,
      state,
      npcLines: [],
      turns: [],
      events: [],
      assistance: { hints: [], translations: 0, repeats: 0, slows: 0, subtitleToggles: 0, typedTurns: 0 },
    };
    const initial: GameUI = {
      phase: "briefing",
      error: null,
      busyLabel: null,
      toast: null,
      npcSpeaking: false,
      voiceOwner: null,
      expression: "neutral",
      subtitle: null,
      showSubtitles: difficulty !== "immersion",
      showTranslation: false,
      translationAllowed: difficulty === "beginner",
      stageId: state.stageId,
      cards: currentCards(scenario, state, variant, difficulty),
      selectedCard: null,
      progress: progressGroups(scenario, state),
      narration: null,
      hintLevel: 0,
      hintOpen: false,
      hintBusy: false,
      micMuted: true,
      recording: false,
      micAvailable: true,
      inputMode,
      world: [],
      timeSkipped: false,
      slots: {},
      flags: {},
      transitionText: null,
      completion: null,
      sessionId: this.session.id,
      needsTap: false,
    };
    this.store = createGameStore(initial);
  }

  /* ------------------------------------------------------------------ */
  /* plumbing                                                            */
  /* ------------------------------------------------------------------ */

  attach(controls: ConversationControlsValue) {
    this.controls = controls;
  }

  private get ui() {
    return this.store.getState();
  }
  private set(patch: Partial<GameUI>) {
    if (!this.disposed) this.store.setState(patch);
  }
  private setPhase(phase: Phase) {
    this.set({ phase });
    this.updateActivityPings(phase);
  }
  private log(type: string, data?: Record<string, unknown>) {
    this.session.events.push({ t: Date.now(), type, data });
  }
  toast(text: string, tone: "info" | "warn" | "good" = "info") {
    this.set({ toast: { id: Date.now(), text, tone } });
  }

  /** Mouth amplitude for the NPC (ElevenAgents output or a local ElevenLabs TTS replay). */
  npcLevel() {
    if (this.agentSpeaking && this.controls) {
      try {
        return Math.min(1, this.controls.getOutputVolume() * 2.2);
      } catch {
        return 0;
      }
    }
    return this.ui.voiceOwner === "npc" ? this.audio.voiceLevel() : 0;
  }

  micLevel() {
    return this.ui.recording ? this.recorder.level() : 0;
  }

  audioNow() {
    return this.audio.now();
  }

  private refreshStageUI() {
    const s = this.session.state;
    this.set({
      stageId: s.stageId,
      cards: currentCards(this.scenario, s, this.session.variant, this.difficulty),
      progress: progressGroups(this.scenario, s),
      slots: { ...s.slots },
      flags: { ...s.flags },
    });
  }

  private scheduleSave(delay = 700) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveNow(), delay);
  }

  private async saveNow() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      await api.saveSession(this.session);
    } catch (e) {
      console.warn("[babbli] save failed", e);
    }
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private startWatchdog(ms: number, onTimeout: () => void) {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      onTimeout();
    }, ms);
  }

  /** Keep the agent from nudging the learner while they read cards & hints (not in Immersion). */
  private updateActivityPings(phase: Phase) {
    const want = (phase === "choose" || phase === "speak") && this.difficulty !== "immersion";
    if (want && !this.activityTimer) {
      this.activityTimer = setInterval(() => {
        try {
          this.controls?.sendUserActivity();
        } catch {
          /* not connected */
        }
      }, 4000);
    } else if (!want && this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* session start                                                       */
  /* ------------------------------------------------------------------ */

  /** Start the scene immediately; if the browser has seen no click on this page yet, wait for one tap. */
  autoEnter() {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) {
      this.set({ needsTap: true });
      return;
    }
    void this.enter();
  }

  async enter() {
    if (this.ui.phase !== "briefing" || !this.controls) return;
    this.setPhase("connecting");
    this.set({ busyLabel: "Stepping inside…", needsTap: false });
    await this.audio.unlock();
    void this.audio.playSfx(assetUrl(this.scenario.sfx.enter), 0.8);
    this.audio.startAmbient(assetUrl(this.scenario.ambienceAsset), AMBIENT_BASE[this.difficulty]).catch((e) =>
      console.warn("[babbli] ambience unavailable", e),
    );

    try {
      await this.recorder.init();
    } catch {
      this.set({ micAvailable: false, inputMode: "ptt" });
      this.session.inputMode = "ptt";
      this.toast("No microphone access — you can still type your replies.", "warn");
    }

    let agent;
    try {
      agent = await api.agentSession(this.scenario.id);
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
      return;
    }
    this.session.agentId = agent.agentId;
    this.log("agent", { agentId: agent.agentId, llm: agent.llm, ttsModel: agent.ttsModel });

    const rand = seededRandom(this.session.seed + 7);
    const greeting = pick(this.scenario.greetings[this.difficulty], rand);
    this.pendingMeaning = greeting.meaning;
    const prompt = buildNpcPrompt({ scenario: this.scenario, difficulty: this.difficulty, variant: this.session.variant });

    const options: HookOptions = {
      signedUrl: agent.signedUrl,
      connectionType: "websocket",
      overrides: {
        agent: { prompt: { prompt }, firstMessage: greeting.text, language: this.scenario.language },
        tts: { speed: AGENT_SPEED[this.difficulty] },
        asr: { keywords: this.scenario.asrKeywords },
      },
      clientTools: { [agent.toolName]: (params: Record<string, unknown>) => this.handleTool(params) },
      onConnect: ({ conversationId }) => {
        this.session.conversationId = conversationId;
        this.log("connected", { conversationId });
        this.scheduleSave(100);
      },
      onDisconnect: (details) => this.handleDisconnect(details.reason, "message" in details ? details.message : undefined),
      onError: (message) => {
        console.warn("[babbli] agent error", message);
        this.log("agent_error", { message });
      },
      onMessage: ({ message, role }) => (role === "agent" ? this.handleAgentLine(message) : this.handleUserTranscript(message)),
      onModeChange: ({ mode }) => this.handleMode(mode),
    };
    this.controls.startSession(options);
    this.log("session_start", { difficulty: this.difficulty, inputMode: this.session.inputMode, variant: this.session.variant });
    this.startWatchdog(25000, () => {
      if (this.ui.phase === "connecting") this.fail("The NPC didn't answer. Check your ElevenLabs key and network, then try again.");
    });
  }

  private fail(message: string) {
    this.clearWatchdog();
    this.set({ error: message, busyLabel: null });
    this.setPhase("error");
    this.audio.stopAmbient(1);
  }

  private handleDisconnect(reason: string, message?: string) {
    this.log("disconnected", { reason, message });
    const phase = this.ui.phase;
    if (phase === "ending" || phase === "done" || phase === "briefing") return;
    if (reason === "error") this.fail(`Connection lost${message ? `: ${message}` : ""}`);
    else if (reason === "agent") void this.finish(this.session.state.objectiveComplete ? "completed" : "abandoned");
  }

  /* ------------------------------------------------------------------ */
  /* agent events                                                        */
  /* ------------------------------------------------------------------ */

  private handleAgentLine(raw: string) {
    const text = stripAudioTags(raw);
    if (!text) return;
    const stage = getStage(this.scenario, this.session.state.stageId);
    const line: NpcLine = {
      id: rid(),
      text,
      meaning: this.pendingMeaning ?? stage.meaning,
      stageId: stage.id,
      at: Date.now(),
      source: "agent",
      speaker: this.scenario.npc.name,
    };
    this.pendingMeaning = null;
    this.session.npcLines.push(line);
    this.lastNpcLine = line;
    if (this.ui.showTranslation && this.ui.translationAllowed) this.recordAssist("translations");
    this.set({ subtitle: { id: line.id, text: line.text, meaning: line.meaning, speaker: line.speaker }, busyLabel: null });
    if (this.ui.phase === "connecting" || this.ui.phase === "processing") {
      this.clearWatchdog();
      this.setPhase("npc");
    }
    this.scheduleSave();
  }

  private handleUserTranscript(text: string) {
    if (this.session.inputMode !== "live") return;
    const turn = this.activeTurn;
    if (!turn || turn.transcriptAgent) return;
    turn.transcriptAgent = text;
    if (this.ui.phase === "speak") void this.closeLiveTurn();
  }

  private handleMode(mode: "speaking" | "listening") {
    if (this.listeningTimer) clearTimeout(this.listeningTimer);
    this.listeningTimer = null;
    if (mode === "speaking") {
      this.replayHandle?.stop();
      if (!this.agentSpeaking) {
        this.agentSpeaking = true;
        this.set({ npcSpeaking: true, voiceOwner: "npc", busyLabel: null });
        this.audio.duck(true);
      }
      if (this.ui.phase === "connecting" || this.ui.phase === "processing") {
        this.clearWatchdog();
        this.setPhase("npc");
      }
      return;
    }
    // Debounce: audio chunks can leave short gaps mid-sentence.
    this.listeningTimer = setTimeout(() => {
      this.listeningTimer = null;
      if (!this.agentSpeaking) return;
      this.agentSpeaking = false;
      this.set({ npcSpeaking: false, voiceOwner: null });
      this.audio.duck(this.ui.phase === "speak");
      void this.afterNpcLine();
    }, 550);
  }

  private async afterNpcLine() {
    if (this.ui.phase !== "npc") return;
    if (this.session.state.finished) {
      await sleep(700);
      await this.finish("completed");
      return;
    }
    if (this.deferredEvents.length) await this.playDeferredEvents();
    const phaseNow: Phase = this.store.getState().phase;
    if (this.disposed || phaseNow === "ending" || phaseNow === "done") return;
    const stage = getStage(this.scenario, this.session.state.stageId);
    this.refreshStageUI();
    this.set({ narration: this.narrationPending && stage.learnerOpens ? stage.learnerOpens : null });
    this.narrationPending = false;
    this.setPhase("choose");
    setTimeout(() => {
      if (!this.ui.npcSpeaking) this.set({ expression: "neutral" });
    }, 1400);
  }

  private async playDeferredEvents() {
    const events = this.deferredEvents;
    this.deferredEvents = [];
    const state = this.session.state;
    if (events.includes("order_placed")) {
      this.addWorld("order_placed");
      const lineFor = this.scenario.eventLines.order_placed;
      const sfx = this.scenario.sfx.order_placed;
      if (sfx) void this.audio.playSfx(assetUrl(sfx), 0.6);
      if (lineFor) {
        const line = lineFor(state);
        const voice = this.scenario.backgroundVoices[line.voice];
        try {
          const tts = await api.tts(line.text, voice.voiceKey, 1.05);
          this.session.npcLines.push({ id: rid(), text: line.text, meaning: line.meaning, stageId: state.stageId, at: Date.now(), source: "background", speaker: voice.name });
          this.set({ subtitle: { id: rid(), text: line.text, meaning: line.meaning, speaker: voice.name } });
          await this.audio.playBackgroundVoice(tts.url, -0.5, 0.55);
        } catch (e) {
          console.warn("[babbli] background voice failed", e);
        }
      }
    }
    if (events.includes("time_skip")) {
      this.setPhase("transition");
      this.set({ transitionText: this.scenario.timeSkipText, subtitle: null });
      const sfx = this.scenario.sfx.time_skip;
      await sleep(900);
      if (events.includes("served")) this.addWorld("served");
      if (sfx) void this.audio.playSfx(assetUrl(sfx), 0.7);
      // Optional voice heard during the skip (e.g. a store PA announcement).
      const lineFor = this.scenario.eventLines.time_skip;
      let voiceDone: Promise<unknown> = Promise.resolve();
      if (lineFor) {
        const line = lineFor(state);
        const voice = this.scenario.backgroundVoices[line.voice];
        voiceDone = (async () => {
          await sleep(1400); // let the chime finish first
          const tts = await api.tts(line.text, voice.voiceKey, 1);
          await this.audio.playBackgroundVoice(tts.url, 0, 0.5);
        })().catch((e) => console.warn("[babbli] time-skip voice failed", e));
      }
      await Promise.all([sleep(3200), voiceDone]);
      this.set({ transitionText: null, timeSkipped: true });
      this.setPhase("npc");
    } else if (events.includes("served")) {
      this.addWorld("served");
      const sfx = this.scenario.sfx.served;
      if (sfx) void this.audio.playSfx(assetUrl(sfx), 0.7);
    }
  }

  private addWorld(event: SceneEventId) {
    if (!this.ui.world.includes(event)) this.set({ world: [...this.ui.world, event] });
  }

  /* ------------------------------------------------------------------ */
  /* the client tool: ElevenAgents → state machine                       */
  /* ------------------------------------------------------------------ */

  private async handleTool(params: Record<string, unknown>): Promise<string> {
    if (this.ui.phase === "speak") await this.closeLiveTurn();
    const turn = this.activeTurn;
    if (!turn) {
      this.log("tool_without_turn", params);
      return "NO NEW CUSTOMER UTTERANCE was received. Do not respond to this; wait silently for the customer.";
    }
    const report: TurnReport = normalizeReport(this.scenario, params);
    const before = this.session.state;
    const { outcome, state } = resolveTurn(this.scenario, before, report, this.session.variant, this.difficulty);

    let intentMatched: boolean | null = null;
    if (turn.expected) {
      const slotsOk = Object.entries(turn.expected.expect ?? {}).every(([k, v]) => {
        const got = typeof report[k] === "string" ? (report[k] as string) : "";
        return !got || got === v;
      });
      intentMatched = report.intent === turn.expected.intent && slotsOk;
    }
    turn.report = report;
    turn.transcriptAgent ||= report.heard;
    turn.endedAt ||= Date.now();
    turn.outcome = {
      kind: outcome.kind,
      success: outcome.success,
      answeredQuestion: outcome.answeredQuestion,
      intentMatched,
      note: outcome.note,
      nextStageId: outcome.nextStageId,
    };
    this.session.state = state;
    this.log("turn_resolved", { turnId: turn.id, intent: report.intent, kind: outcome.kind, next: outcome.nextStageId });
    this.activeTurn = null;
    this.pendingMeaning = outcome.meaning;
    this.narrationPending = outcome.nextStageId !== before.stageId && !!getStage(this.scenario, outcome.nextStageId).learnerOpens;

    const immediate = (outcome.events ?? []).filter((e) => !DEFERRED.includes(e));
    this.deferredEvents.push(...(outcome.events ?? []).filter((e) => DEFERRED.includes(e)));
    for (const e of immediate) {
      this.addWorld(e);
      const sfx = this.scenario.sfx[e];
      if (sfx) void this.audio.playSfx(assetUrl(sfx), 0.6);
    }
    if (outcome.success && (outcome.kind === "advance" || outcome.kind === "complete")) {
      void this.audio.playSfx(assetUrl("ui-success"), 0.28);
    }

    this.set({
      expression: outcome.reaction,
      selectedCard: null,
      hintLevel: 0,
      hintOpen: false,
      narration: null,
      busyLabel: null,
      slots: { ...state.slots },
      flags: { ...state.flags },
      progress: progressGroups(this.scenario, state),
    });
    if (outcome.kind === "clarify") this.toast("They didn't quite get that — try again.", "warn");
    this.startWatchdog(15000, () => this.recoverFromSilence());
    this.scheduleSave(200);
    return formatDirective(this.scenario, outcome, state, this.difficulty);
  }

  private recoverFromSilence() {
    if (this.ui.phase !== "processing") return;
    this.toast(`${this.scenario.npc.name} didn't respond — try saying it again.`, "warn");
    if (this.activeTurn && !this.activeTurn.outcome) this.cancelTurn(false);
    this.refreshStageUI();
    this.setPhase("choose");
  }

  /* ------------------------------------------------------------------ */
  /* learner turns                                                       */
  /* ------------------------------------------------------------------ */

  private createTurn(card: IntentCard | null) {
    const stage = getStage(this.scenario, this.session.state.stageId);
    const turn: LearnerTurn = {
      id: `t${this.session.turns.length + 1}-${rid(6)}`,
      index: this.session.turns.length,
      stageId: stage.id,
      stageGroup: stage.group,
      npcPrompt: this.lastNpcLine?.text ?? "",
      npcPromptMeaning: this.lastNpcLine?.meaning ?? stage.meaning,
      expected: card
        ? {
            intent: card.id,
            key: card.key ?? card.id,
            label: card.label,
            reference: card.hints.full,
            referenceReading: card.hints.fullReading,
            referenceMeaning: card.hints.fullMeaning,
            expect: card.expect,
            keywords: card.keywords,
          }
        : undefined,
      startedAt: Date.now(),
      inputMethod: "voice",
      inputMode: this.session.inputMode,
      hints: [...this.pendingAssist.hints],
      repeats: this.pendingAssist.repeats,
      slows: this.pendingAssist.slows,
      translations: this.pendingAssist.translations,
    };
    this.pendingAssist = { hints: [], repeats: 0, slows: 0, translations: 0 };
    this.session.turns.push(turn);
    this.activeTurn = turn;
    return turn;
  }

  private cancelTurn(restoreAssist = true) {
    const turn = this.activeTurn;
    if (!turn) return;
    if (restoreAssist) {
      this.pendingAssist = { hints: turn.hints, repeats: turn.repeats, slows: turn.slows, translations: turn.translations };
    }
    this.session.turns = this.session.turns.filter((t) => t.id !== turn.id);
    this.activeTurn = null;
  }

  chooseCard(card: IntentCard) {
    if (this.ui.phase !== "choose" || this.ui.npcSpeaking) return;
    this.set({ selectedCard: card, narration: null });
    this.log("card_chosen", { intent: card.id, key: card.key ?? card.id });
    this.beginSpeaking(card);
  }

  /** Mic without choosing a card — the learner decides what to say. */
  speakFreely() {
    if (this.ui.phase !== "choose" || this.ui.npcSpeaking) return;
    this.set({ selectedCard: null, narration: null });
    this.beginSpeaking(null);
  }

  private beginSpeaking(card: IntentCard | null) {
    this.createTurn(card);
    this.set({ expression: "neutral" });
    this.setPhase("speak");
    if (this.recorder.ready) {
      this.recorder.start();
      this.set({ recording: true, micMuted: this.session.inputMode !== "live" });
    }
    this.audio.duck(true);
  }

  backToChoices() {
    if (this.ui.phase !== "speak") return;
    void this.recorder.stop();
    this.cancelTurn();
    this.set({ recording: false, micMuted: true, selectedCard: null });
    this.audio.duck(false);
    this.setPhase("choose");
  }

  /** Learner taps the mic to say they're done. */
  async finishSpeaking() {
    if (this.ui.phase !== "speak") return;
    if (this.session.inputMode === "live") {
      await this.closeLiveTurn();
      this.startWatchdog(12000, () => this.recoverFromSilence());
      return;
    }
    // Push-to-talk: Scribe transcribes, then the text goes to the ElevenAgents NPC.
    const turn = this.activeTurn;
    this.setPhase("processing");
    this.set({ recording: false, busyLabel: "Listening…" });
    this.audio.duck(false);
    const rec = await this.recorder.stop();
    if (!turn || !rec) {
      this.cancelTurn();
      this.set({ busyLabel: null });
      this.setPhase("choose");
      return;
    }
    turn.endedAt = Date.now();
    this.attachAudio(turn, rec, false);
    try {
      const stt = await api.stt(rec.blob, this.scenario.language, this.keyterms(turn));
      turn.stt = stt;
      if (!stt.transcript.trim() || stt.words.length === 0) {
        this.cancelTurn();
        this.set({ busyLabel: null });
        this.toast("I didn't catch anything — try again, a little closer to the mic.", "warn");
        this.setPhase("choose");
        return;
      }
      turn.transcriptAgent = stt.transcript;
      this.set({ busyLabel: null });
      this.controls?.sendUserMessage(stt.transcript);
      this.log("ptt_sent", { turnId: turn.id, transcript: stt.transcript });
      this.startWatchdog(15000, () => this.recoverFromSilence());
    } catch (e) {
      this.cancelTurn();
      this.set({ busyLabel: null });
      this.toast(`Speech recognition failed: ${e instanceof Error ? e.message : e}`, "warn");
      this.setPhase("choose");
    }
  }

  private async closeLiveTurn() {
    if (this.ui.phase !== "speak") return;
    const turn = this.activeTurn;
    this.set({ micMuted: true, recording: false });
    this.setPhase("processing");
    this.audio.duck(false);
    const rec = await this.recorder.stop();
    if (turn) {
      turn.endedAt = Date.now();
      if (rec) this.attachAudio(turn, rec, true);
    }
  }

  private keyterms(turn: LearnerTurn) {
    return Array.from(new Set([...(turn.expected?.keywords ?? []), ...this.scenario.asrKeywords])).slice(0, 40);
  }

  /** Store raw audio server-side and (in live mode) run Scribe for word timings in the background. */
  private attachAudio(turn: LearnerTurn, rec: Recording, transcribe: boolean) {
    turn.audio = { mimeType: rec.mimeType, durationMs: Math.round(rec.durationMs), uploaded: false };
    const upload = api
      .uploadTurnAudio(this.session.id, turn.id, rec.blob)
      .then(() => {
        turn.audio!.uploaded = true;
        this.scheduleSave();
      })
      .catch((e) => console.warn("[babbli] audio upload failed", e));
    this.background.push(upload);
    if (transcribe) {
      const stt = api
        .stt(rec.blob, this.scenario.language, this.keyterms(turn))
        .then((r) => {
          turn.stt = r;
          this.scheduleSave();
        })
        .catch((e) => console.warn("[babbli] scribe failed", e));
      this.background.push(stt);
    }
  }

  submitText(text: string) {
    const clean = text.trim();
    if (!clean || !this.controls) return;
    if (this.ui.phase !== "choose" && this.ui.phase !== "speak") return;
    let turn = this.activeTurn;
    if (!turn) turn = this.createTurn(this.ui.selectedCard);
    if (this.recorder.recording) void this.recorder.stop();
    turn.inputMethod = "text";
    turn.transcriptAgent = clean;
    turn.endedAt = Date.now();
    this.session.assistance.typedTurns += 1;
    this.set({ recording: false, micMuted: true });
    this.setPhase("processing");
    this.audio.duck(false);
    this.controls.sendUserMessage(clean);
    this.log("text_sent", { turnId: turn.id });
    this.startWatchdog(15000, () => this.recoverFromSilence());
  }

  /* ------------------------------------------------------------------ */
  /* assistance: hints, replays, subtitles                               */
  /* ------------------------------------------------------------------ */

  private recordAssist(kind: "hints" | "repeats" | "slows" | "translations", level?: number) {
    const a = this.session.assistance;
    const target = this.activeTurn ?? this.pendingAssist;
    if (kind === "hints" && level) {
      a.hints.push(level);
      target.hints.push(level);
    } else if (kind !== "hints") {
      a[kind] += 1;
      target[kind] += 1;
    }
    this.log(kind, level ? { level } : undefined);
    this.scheduleSave();
  }

  hintCard(): IntentCard | null {
    return this.ui.selectedCard ?? this.ui.cards[0] ?? null;
  }

  toggleHints() {
    if (this.ui.hintOpen) {
      this.set({ hintOpen: false });
      return;
    }
    if (this.ui.hintLevel === 0) this.nextHint();
    else this.set({ hintOpen: true });
  }

  nextHint() {
    const level = Math.min(5, this.ui.hintLevel + 1);
    if (level === this.ui.hintLevel) {
      if (level === 5) void this.playHintAudio();
      return;
    }
    this.set({ hintLevel: level, hintOpen: true });
    this.recordAssist("hints", level);
    void this.audio.playSfx(assetUrl("ui-hint"), 0.35);
    if (level === 5) void this.playHintAudio();
  }

  /** Hint 5: an ElevenLabs native coach voice speaks the full response. */
  async playHintAudio() {
    const card = this.hintCard();
    if (!card || this.ui.npcSpeaking || this.ui.hintBusy) return;
    this.set({ hintBusy: true });
    try {
      const tts = await api.tts(card.hints.full, `coach_${this.scenario.language}`, this.difficulty === "beginner" ? 0.9 : 1);
      const wasMuted = this.ui.micMuted;
      this.set({ voiceOwner: "coach", micMuted: true });
      this.audio.duck(true);
      const handle = await this.audio.playVoice(tts.url);
      await handle.done;
      this.set({ voiceOwner: null, micMuted: wasMuted });
      this.audio.duck(this.ui.phase === "speak");
    } catch (e) {
      this.toast(`Couldn't play the audio hint: ${e instanceof Error ? e.message : e}`, "warn");
    } finally {
      this.set({ hintBusy: false });
    }
  }

  /** Repeat / slow: the NPC's own voice re-speaks the last line via ElevenLabs TTS (with karaoke timings). */
  async replay(slow: boolean) {
    const line = this.lastNpcLine;
    const phase = this.ui.phase;
    if (!line || this.ui.npcSpeaking || !["choose", "speak"].includes(phase)) return;
    this.recordAssist(slow ? "slows" : "repeats");
    this.set({ busyLabel: slow ? "Slowing down…" : null });
    try {
      const tts = await api.tts(line.text, this.scenario.npc.voiceKey, slow ? 0.72 : REPLAY_SPEED[this.difficulty]);
      if (this.ui.npcSpeaking) return;
      const wasMuted = this.ui.micMuted;
      this.set({ micMuted: true, npcSpeaking: true, voiceOwner: "npc", busyLabel: null });
      this.audio.duck(true);
      const handle = await this.audio.playVoice(tts.url);
      this.replayHandle = handle;
      this.set({
        subtitle: {
          id: `${line.id}-r${Date.now()}`,
          text: line.text,
          meaning: line.meaning,
          speaker: line.speaker,
          karaoke: tts.alignment
            ? { chars: tts.alignment.characters, starts: tts.alignment.character_start_times_seconds, t0: handle.startedAt }
            : undefined,
        },
      });
      await handle.done;
      this.replayHandle = null;
      if (!this.agentSpeaking) {
        this.set({ npcSpeaking: false, voiceOwner: null, micMuted: wasMuted });
        this.audio.duck(this.ui.phase === "speak");
      }
    } catch (e) {
      this.set({ busyLabel: null, npcSpeaking: false, voiceOwner: null });
      this.toast(`Replay failed: ${e instanceof Error ? e.message : e}`, "warn");
    }
  }

  toggleSubtitles() {
    const on = !this.ui.showSubtitles;
    this.set({ showSubtitles: on });
    this.session.assistance.subtitleToggles += 1;
    this.log("subtitles", { on });
  }

  toggleTranslation() {
    if (!this.ui.translationAllowed) return;
    const on = !this.ui.showTranslation;
    this.set({ showTranslation: on, showSubtitles: on ? true : this.ui.showSubtitles });
    if (on && this.ui.subtitle) this.recordAssist("translations");
  }

  closeHints() {
    this.set({ hintOpen: false });
  }

  setAmbientLevel(base: number) {
    this.audio.setAmbientBase(base);
  }

  /* ------------------------------------------------------------------ */
  /* ending                                                              */
  /* ------------------------------------------------------------------ */

  async finish(status: "completed" | "abandoned") {
    const phase = this.ui.phase;
    if (phase === "ending" || phase === "done") return;
    this.setPhase("ending");
    this.clearWatchdog();
    if (this.listeningTimer) clearTimeout(this.listeningTimer);
    if (this.recorder.recording) {
      const rec = await this.recorder.stop();
      if (this.activeTurn && rec && !this.activeTurn.transcriptAgent) this.cancelTurn(false);
    }
    try {
      this.controls?.endSession();
    } catch {
      /* already closed */
    }
    this.audio.stopVoice();
    this.audio.stopAmbient(2.5);
    this.set({ npcSpeaking: false, recording: false, micMuted: true, busyLabel: "Saving your session…" });
    if (status === "completed") void this.audio.playSfx(assetUrl("ui-complete"), 0.6);
    this.session.status = status;
    this.session.endedAt = Date.now();
    this.log("session_end", { status });
    await Promise.race([Promise.allSettled(this.background), sleep(9000)]);
    await this.saveNow();
    this.set({ busyLabel: null, completion: { objectiveComplete: this.session.state.objectiveComplete } });
    this.setPhase("done");
  }

  /** Re-arm after a StrictMode dev unmount/remount cycle (nothing has started yet at that point). */
  activate() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    this.clearWatchdog();
    if (this.activityTimer) clearInterval(this.activityTimer);
    if (this.listeningTimer) clearTimeout(this.listeningTimer);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    try {
      this.controls?.endSession();
    } catch {
      /* noop */
    }
    this.recorder.release();
    this.audio.stopVoice();
    this.audio.stopAmbient(0.6);
    if (this.session.turns.length && this.session.status === "active") {
      this.session.status = "abandoned";
      this.session.endedAt = Date.now();
      void api.saveSession(this.session).catch(() => undefined);
    }
  }
}
