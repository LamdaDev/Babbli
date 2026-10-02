"use client";

import type { ConversationControlsValue, HookOptions } from "@elevenlabs/react";
import { buildNpcPrompt, buildResyncNote } from "@/lib/engine/agentConfig";
import {
  createInitialState,
  currentCards,
  defaultHintCard,
  formatDirective,
  getStage,
  normalizeReport,
  pick,
  progressGroups,
  resolveTurn,
  seededRandom,
} from "@/lib/engine/engine";
import { cleanTranscript, stripAudioTags, withoutEmDashes } from "@/lib/evaluation/text";
import { AgentAudioTape, type ChunkAlignment } from "@/lib/client/agentAudio";
import { api, ApiError, assetUrl, type TtsResult } from "@/lib/client/api";
import { audioEngine } from "@/lib/client/audioEngine";
import { detectInAppBrowser } from "@/lib/client/inAppBrowser";
import { getProfile, recordScene } from "@/lib/client/profileStore";
import { LiveCaptions } from "@/lib/client/liveCaptions";
import { MicRecorder, type Recording } from "@/lib/client/recorder";
import type { BadgeId } from "@/lib/profile/badges";
import { addressForm, coachVoiceKey, learnerPromptNote } from "@/lib/profile/profile";
import { inAddressForm, type Difficulty, type InputMode, type IntentCard, type ResponseMode, type ScenarioDef, type SceneEventId, type TurnReport } from "@/lib/scenarios/types";
import type { LearnerTurn, NpcLine, SessionRecord } from "@/lib/session/types";
import { createGameStore, type GameStore, type GameUI, type Phase, type Subtitle } from "./store";

const AGENT_SPEED: Record<Difficulty, number> = { beginner: 0.85, intermediate: 1, immersion: 1.08 };
/** Playback rates for Repeat and Slow when the line has to be voiced again with TTS (applied in the browser, pitch kept). */
const REPLAY_SPEED: Record<Difficulty, number> = { beginner: 0.9, intermediate: 1, immersion: 1.05 };
/** Slow replays play at this share of the native pace. */
const SLOW_SPEED = 0.72;
/** Idle auto-end: "Still there?" after 90 s with nobody doing anything, the scene ends at 2 min (or after 1 min in a background tab). */
const IDLE_PROMPT_MS = 90_000;
const IDLE_END_MS = 120_000;
const HIDDEN_END_MS = 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
/** Max speaking time per turn — nobody talks at a shop assistant for two minutes. */
const TURN_LIMIT_MS: Record<Difficulty, number> = { beginner: 20000, intermediate: 30000, immersion: 30000 };
const AMBIENT_BASE: Record<Difficulty, number> = { beginner: 0.18, intermediate: 0.22, immersion: 0.32 };
/** A scene's radio (its music bed), quietly under the ambience. */
const RADIO_LEVEL = 0.12;
/** Scene events that play out after the NPC finishes the line that caused them. */
const DEFERRED: SceneEventId[] = ["order_placed", "time_skip", "served"];

const rid = (n = 8) => crypto.randomUUID().replace(/-/g, "").slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The microphone permission, without asking for it ("unknown" where the browser can't tell). */
async function micPermission(): Promise<PermissionState | "unknown"> {
  try {
    return (await navigator.permissions.query({ name: "microphone" as PermissionName })).state;
  } catch {
    return "unknown";
  }
}
const AUDIO_TAG = /\[[^\]]{1,30}\]\s*/g;

/** The raw ElevenAgents events the controller reads (onIncomingEvent). */
type AgentEvent = {
  type?: string;
  tentative_user_transcription_event?: { user_transcript?: string };
  agent_response_event?: { event_id?: number };
  audio_event?: { audio_base_64?: string; event_id?: number; alignment?: ChunkAlignment };
};

/**
 * Karaoke timings for an NPC line: voiced with TTS in Text Mode, or the agent's own audio on a replay.
 * The audio may carry audio tags like [cheerful] (expressive delivery) that the subtitle doesn't
 * show, so the tags' characters are dropped from the alignment. No karaoke if it doesn't line up.
 */
function karaokeFor(shown: string, alignment: TtsResult["alignment"], rate: number, t0: number): Subtitle["karaoke"] {
  if (!alignment) return undefined;
  const { characters: chars, character_start_times_seconds: starts } = alignment;
  const keep = chars.map(() => true);
  const owner = chars.flatMap((c, i) => Array.from({ length: c.length }, () => i));
  for (const m of chars.join("").matchAll(AUDIO_TAG)) for (let p = m.index; p < m.index + m[0].length; p++) keep[owner[p]] = false;
  let idx = chars.map((_, i) => i).filter((i) => keep[i]);
  while (idx.length && /\s/.test(chars[idx[0]])) idx = idx.slice(1);
  while (idx.length && /\s/.test(chars[idx[idx.length - 1]])) idx = idx.slice(0, -1);
  if (idx.map((i) => chars[i]).join("") !== shown) return undefined;
  return { chars: idx.map((i) => chars[i]), starts: idx.map((i) => starts[i] / rate), t0 };
}

export class GameController {
  readonly store: GameStore;
  readonly session: SessionRecord;
  private controls: ConversationControlsValue | null = null;
  private recorder = new MicRecorder();
  /** Push-to-talk live captions (realtime Scribe); live mode uses the agent's tentative transcripts. */
  private captions = new LiveCaptions((text) => {
    if (this.ui.phase === "speak") this.set({ userCaption: { text, final: false } });
  });
  private audio = audioEngine();
  private lastNpcLine: NpcLine | null = null;
  private pendingMeaning: string | null = null;
  private activeTurn: LearnerTurn | null = null;
  private pendingAssist = { hints: [] as number[], repeats: 0, slows: 0, translations: 0 };
  private deferredEvents: SceneEventId[] = [];
  private agentSpeaking = false;
  /** Learner turn whose words reached the agent and still wait for the report tool call. */
  private awaitingTool: string | null = null;
  /** Text Mode: NPC lines voiced locally, strictly one after another. */
  private npcVoiceQueue: Promise<void> = Promise.resolve();
  private listeningTimer: ReturnType<typeof setTimeout> | null = null;
  private expressionTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private activityTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  /** Time left on the turn while it's on hold (exit dialog open). */
  private heldTurnMs: number | null = null;
  /** Learner recordings being uploaded (finish waits for them, showing progress). */
  private uploads: Promise<unknown>[] = [];
  private uploadsDone = 0;
  private showingUploads = false;
  private replayHandle: { stop: () => void } | null = null;
  /** Voice Mode: the agent's own audio for the latest lines, so Repeat and Slow cost no new speech. */
  private tape = new AgentAudioTape((url) => this.audio.forget(url));
  /** Event id of the agent response being delivered (it arrives just before onMessage). */
  private agentEventId: number | null = null;
  /** Text Mode: the TTS each NPC line was voiced with, replayed as is. */
  private voiced = new Map<string, TtsResult>();
  /** Idle auto-end: time spent waiting on the learner since they last did anything. */
  private idleMs = 0;
  private idleTick = 0;
  private idleTimer: ReturnType<typeof setInterval> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  /** The session's first save (see enter): NPC voicing waits for it. */
  private firstSave: Promise<unknown> = Promise.resolve();
  private firstSaveAt = 0;
  /** startSession was called and neither onConnect nor onError has answered yet. */
  private starting = false;
  private narrationPending = false;
  private disposed = false;

  constructor(
    readonly scenario: ScenarioDef,
    readonly difficulty: Difficulty,
    inputMode: InputMode,
    /** Voice or Text Mode — fixed for the session. Only changes how the learner responds, never the scenario logic. */
    readonly responseMode: ResponseMode = "voice",
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
      responseMode,
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
      errorAction: null,
      errorKind: null,
      busyLabel: null,
      toast: null,
      npcSpeaking: false,
      voiceOwner: null,
      expression: "neutral",
      subtitle: null,
      userCaption: null,
      showSubtitles: difficulty !== "immersion",
      showTranslation: false,
      translationAllowed: difficulty === "beginner",
      stageId: state.stageId,
      cards: currentCards(scenario, state, variant, difficulty, seed),
      selectedCard: null,
      progress: progressGroups(scenario, state),
      narration: null,
      hintLevel: 0,
      hintOpen: false,
      helpOpen: false,
      hintBusy: false,
      micMuted: true,
      recording: false,
      turnTimer: null,
      micAvailable: responseMode === "voice",
      inputMode,
      responseMode,
      world: [],
      timeSkipped: false,
      slots: {},
      flags: {},
      transitionText: null,
      completion: null,
      loadProgress: null,
      saveProgress: null,
      idle: null,
      endReason: null,
      sessionId: this.session.id,
      needsTap: false,
      inApp: null,
      micPrompt: false,
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
    if (phase !== "speak") this.clearTurnTimer();
    this.set({ phase });
    this.updateActivityPings(phase);
  }
  private log(type: string, data?: Record<string, unknown>) {
    this.session.events.push({ t: Date.now(), type, data });
  }
  toast(text: string, tone: "info" | "warn" | "good" = "info") {
    this.set({ toast: { id: Date.now(), text, tone } });
  }

  /** Text Mode: typed replies, a text-only ElevenAgents conversation, no microphone at all. */
  private get textMode() {
    return this.responseMode === "text";
  }

  /** Voice Mode where ElevenAgents hears the mic directly (vs push-to-talk). */
  private get liveVoice() {
    return this.responseMode === "voice" && this.session.inputMode === "live";
  }

  /** Mouth amplitude for the NPC (ElevenAgents output or a local ElevenLabs TTS playback). */
  npcLevel() {
    // Text Mode has no agent audio stream — the NPC's line plays locally (voiceOwner "npc").
    if (this.agentSpeaking && this.controls && !this.textMode) {
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
      cards: currentCards(this.scenario, s, this.session.variant, this.difficulty, this.session.seed),
      progress: progressGroups(this.scenario, s),
      slots: { ...s.slots },
      flags: { ...s.flags },
    });
  }

  private scheduleSave(delay = 700) {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveNow(), delay);
  }

  private async saveNow(): Promise<boolean> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      await api.saveSession(this.session);
      return true;
    } catch (e) {
      console.warn("[babbli] save failed", e);
      return false;
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
  /* idle auto-end                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * A forgotten tab keeps the ElevenAgents conversation (and its minutes) running. Only time spent
   * waiting on the learner counts: the NPC talking, thinking or a scene transition pauses the clock.
   */
  private startIdleWatch() {
    if (this.idleTimer) return;
    this.idleMs = 0;
    this.idleTick = Date.now();
    // Capture phase: the key that answers "Still there?" is swallowed before the game shortcuts see it.
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, this.markActive, { capture: true, passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.idleTimer = setInterval(() => this.checkIdle(), 1000);
    if (document.hidden) this.onVisibility();
  }

  private stopIdleWatch() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, this.markActive, { capture: true });
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.ui.idle) this.set({ idle: null });
  }

  /** Any click, key, touch or pointer move means someone is there (and answers "Still there?"). */
  readonly markActive = (e?: { type: string; stopImmediatePropagation?: () => void }) => {
    this.idleMs = 0;
    if (this.ui.idle) {
      if (e?.type === "keydown") e.stopImmediatePropagation?.();
      this.set({ idle: null });
      this.log("idle_dismissed");
    }
  };

  private checkIdle() {
    const now = Date.now();
    const dt = now - this.idleTick;
    this.idleTick = now;
    const s = this.ui;
    const waiting = (s.phase === "choose" || (s.phase === "speak" && this.textMode)) && !s.npcSpeaking && !s.voiceOwner;
    if (!waiting) {
      if (s.idle) this.set({ idle: { endsAt: s.idle.endsAt + dt } });
      return;
    }
    this.idleMs += dt;
    if (this.idleMs >= IDLE_END_MS) void this.endForInactivity("idle");
    else if (this.idleMs >= IDLE_PROMPT_MS && !s.idle) {
      this.set({ idle: { endsAt: now + IDLE_END_MS - this.idleMs } });
      this.log("idle_prompt");
      void this.audio.playSfx(assetUrl("ui-hint"), 0.35);
    }
  }

  private readonly onVisibility = () => {
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    if (!document.hidden) {
      this.markActive();
      return;
    }
    this.log("tab_hidden");
    this.hiddenTimer = setTimeout(() => {
      this.hiddenTimer = null;
      if (document.hidden) void this.endForInactivity("hidden");
    }, HIDDEN_END_MS);
  };

  private async endForInactivity(reason: "idle" | "hidden") {
    const phase = this.ui.phase;
    if (phase === "briefing" || phase === "ending" || phase === "done" || phase === "error") return;
    this.log("auto_end", { reason });
    this.set({ endReason: reason });
    await this.finish(this.session.state.objectiveComplete ? "completed" : "abandoned");
  }

  /* ------------------------------------------------------------------ */
  /* session start                                                       */
  /* ------------------------------------------------------------------ */

  /** Start the scene immediately; if the browser has seen no click on this page yet, wait for one tap. */
  autoEnter() {
    // Voice inside an app's built-in browser (LinkedIn…): the microphone often fails there, so offer
    // a real browser or Text Mode first. The choice is a click, so no tap is needed after it.
    const inApp = this.textMode ? null : detectInAppBrowser();
    if (inApp) {
      this.set({ inApp });
      this.log("in_app_browser", { app: inApp.app, os: inApp.os });
      return;
    }
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) {
      this.set({ needsTap: true });
      return;
    }
    void this.enter();
  }

  /** "Try voice here anyway" on the in-app browser notice. */
  enterAnyway() {
    this.set({ inApp: null });
    void this.enter();
  }

  async enter() {
    if (this.ui.phase !== "briefing" || !this.controls) return;
    this.setPhase("connecting");
    const npc = this.scenario.npc.name;
    this.set({ busyLabel: "Stepping inside…", needsTap: false, loadProgress: 0.1 });
    await this.audio.unlock();
    void this.audio.playSfx(assetUrl(this.scenario.sfx.enter), 0.8);
    // Decode the feedback and scene sounds now, so the first success chime isn't late (or missed).
    for (const id of new Set(["ui-success", "ui-hint", "ui-complete", ...Object.values(this.scenario.sfx)])) {
      this.audio.load(assetUrl(id)).catch(() => undefined);
    }
    this.audio.startAmbient(assetUrl(this.scenario.ambienceAsset), AMBIENT_BASE[this.difficulty]).catch((e) =>
      console.warn("[babbli] ambience unavailable", e),
    );
    if (this.scenario.musicAsset)
      this.audio.startMusic(assetUrl(this.scenario.musicAsset), RADIO_LEVEL, { speaker: true, ducks: true }).catch((e) =>
        console.warn("[babbli] radio unavailable", e),
      );

    // Text Mode never touches the microphone. Voice Mode needs it — and never falls back to typing.
    if (!this.textMode) {
      this.set({ busyLabel: "Checking your microphone…", loadProgress: 0.25 });
      // First visit: the browser is about to ask for the microphone. Say why, just before it does.
      const permission = this.recorder.ready ? "granted" : await micPermission();
      const asking = permission === "prompt" || permission === "unknown";
      if (asking) {
        this.set({ micPrompt: true });
        await sleep(500);
      }
      try {
        await this.recorder.init();
      } catch {
        this.set({ micPrompt: false });
        this.set({ micAvailable: false });
        this.fail("mic", "Voice Mode needs your microphone, and the browser didn't allow it. Allow microphone access and try again, or switch to Text Mode to type your replies.", {
          label: "Switch to Text Mode",
          href: this.textModeHref,
        });
        return;
      }
      this.set({ micPrompt: false });
    }

    // The session exists on the server before the NPC speaks: its lines are only voiced (and replies
    // only transcribed) for a scene being played.
    if (!this.firstSaveAt) {
      this.firstSaveAt = Date.now();
      this.firstSave = this.saveNow();
    }
    this.set({ busyLabel: `Getting ${npc} ready…`, loadProgress: 0.45 });
    let agent;
    try {
      agent = await api.agentSession(this.scenario.id);
    } catch (e) {
      this.fail(e instanceof ApiError && e.code === "missing_key" ? "setup" : "busy", e instanceof Error ? e.message : String(e));
      return;
    }
    this.session.agentId = agent.agentId;
    this.log("agent", { agentId: agent.agentId, llm: agent.llm, ttsModel: agent.ttsModel });

    const rand = seededRandom(this.session.seed + 7);
    const greeting = pick(this.scenario.greetings[this.difficulty], rand);
    // The Traveler Profile: greet the learner in their address form, and tell the NPC their pronouns.
    const profile = getProfile();
    const firstMessage = inAddressForm(greeting.text, greeting.forms, addressForm(profile));
    this.pendingMeaning = greeting.meaning;
    const prompt = buildNpcPrompt({
      scenario: this.scenario,
      difficulty: this.difficulty,
      variant: this.session.variant,
      learner: learnerPromptNote(profile, this.scenario.language),
    });

    const options: HookOptions = {
      signedUrl: agent.signedUrl,
      connectionType: "websocket",
      overrides: {
        agent: { prompt: { prompt }, firstMessage, language: this.scenario.language },
        // Text Mode: the same agent, tool and engine over a text-only conversation (no mic, no audio
        // stream) — the NPC's lines are voiced locally with ElevenLabs TTS (see voiceNpcLine).
        ...(this.textMode
          ? { conversation: { textOnly: true } }
          : { tts: { speed: AGENT_SPEED[this.difficulty] }, asr: { keywords: this.scenario.asrKeywords } }),
      },
      clientTools: { [agent.toolName]: (params: Record<string, unknown>) => this.handleTool(params) },
      onConnect: ({ conversationId }) => {
        this.starting = false;
        this.session.conversationId = conversationId;
        this.log("connected", { conversationId });
        this.scheduleSave(100);
        if (this.ui.phase === "connecting") this.set({ busyLabel: `${npc} is about to greet you…`, loadProgress: 0.9 });
      },
      onDisconnect: (details) => this.handleDisconnect(details.reason, "message" in details ? details.message : undefined),
      onError: (message) => {
        console.warn("[babbli] agent error", message);
        this.log("agent_error", { message });
        // Before onConnect, an error means the conversation couldn't start (e.g. every conversation
        // slot on the ElevenLabs plan is taken).
        const failedStart = this.starting;
        this.starting = false;
        if (failedStart && this.ui.phase === "connecting") this.fail("busy", message);
      },
      onMessage: ({ message, role }) => (role === "agent" ? this.handleAgentLine(message) : this.handleUserTranscript(message)),
      onIncomingEvent: (event: AgentEvent) => {
        // Keep the NPC's streamed voice for Repeat and Slow (see replay).
        const audio = event?.type === "audio" ? event.audio_event : undefined;
        if (audio?.audio_base_64 && typeof audio.event_id === "number") {
          this.tape.add(audio.event_id, audio.audio_base_64, audio.alignment);
          return;
        }
        if (event?.type === "agent_response") {
          this.agentEventId = event.agent_response_event?.event_id ?? null;
          return;
        }
        // Live mode: what the agent is hearing so far, for the learner's own captions.
        if (event?.type !== "tentative_user_transcript" || !this.liveVoice || this.ui.phase !== "speak") return;
        const text = cleanTranscript(event.tentative_user_transcription_event?.user_transcript ?? "");
        if (text) this.set({ userCaption: { text, final: false } });
      },
      // Text Mode has no agent audio: its speaking/listening cycle comes from voiceNpcLine instead.
      onModeChange: ({ mode }) => {
        if (!this.textMode) this.handleMode(mode);
      },
    };
    this.set({ busyLabel: `Connecting to ${npc}…`, loadProgress: 0.7 });
    this.starting = true;
    this.controls.startSession(options);
    this.startIdleWatch();
    this.log("session_start", { difficulty: this.difficulty, responseMode: this.responseMode, inputMode: this.session.inputMode, variant: this.session.variant });
    this.startWatchdog(25000, () => {
      if (this.ui.phase === "connecting") this.fail("busy", "The NPC didn't answer within 25 seconds.");
    });
  }

  get textModeHref() {
    return `/play/${this.scenario.id}?difficulty=${this.difficulty}&respond=text`;
  }

  /** kind picks what the learner is shown; message is the technical detail (tucked away, and logged). */
  private fail(kind: NonNullable<GameUI["errorKind"]>, message: string, action: GameUI["errorAction"] = null) {
    this.clearWatchdog();
    this.log("error", { kind, message });
    const offerText = (kind === "busy" || kind === "lost") && !this.textMode;
    this.set({ error: message, errorKind: kind, errorAction: action ?? (offerText ? { label: "Try Text Mode", href: this.textModeHref } : null), busyLabel: null });
    this.setPhase("error");
    this.audio.stopAmbient(1);
    if (this.scenario.musicAsset) this.audio.stopMusic(1);
  }

  /**
   * "Try again" after the scene couldn't start: the same scene again, in place when the failed start
   * is over (a start that never answered may still be pending in the SDK, so that one reloads).
   */
  retry() {
    if (this.ui.phase !== "error") return;
    if (this.ui.errorKind !== "busy" || this.starting || Date.now() - this.firstSaveAt > 10 * 60_000) {
      window.location.reload();
      return;
    }
    this.stopIdleWatch();
    this.log("retry");
    this.set({ error: null, errorKind: null, errorAction: null });
    this.setPhase("briefing");
    void this.enter();
  }

  private handleDisconnect(reason: string, message?: string) {
    this.log("disconnected", { reason, message });
    const phase = this.ui.phase;
    const starting = this.starting;
    this.starting = false;
    if (phase === "ending" || phase === "done" || phase === "briefing" || phase === "error") return;
    if (reason === "error") this.fail(phase === "connecting" || starting ? "busy" : "lost", `Connection lost${message ? `: ${message}` : ""}`);
    else if (reason === "agent") void this.finish(this.session.state.objectiveComplete ? "completed" : "abandoned");
  }

  /* ------------------------------------------------------------------ */
  /* agent events                                                        */
  /* ------------------------------------------------------------------ */

  private handleAgentLine(message: string) {
    const raw = withoutEmDashes(message, this.scenario.language);
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
    if (this.agentEventId !== null) this.tape.bind(line.id, this.agentEventId);
    this.agentEventId = null;
    if (this.ui.showTranslation && this.ui.translationAllowed) this.recordAssist("translations");
    this.set({ subtitle: { id: line.id, text: line.text, meaning: line.meaning, speaker: line.speaker }, busyLabel: null });
    // The NPC's reply replaces the learner's caption (unless it's a nudge while they're still talking).
    if (this.ui.phase !== "speak") this.set({ userCaption: null });
    if (this.ui.phase === "connecting" || this.ui.phase === "processing") {
      this.clearWatchdog();
      this.setPhase("npc");
    }
    if (this.textMode) this.voiceNpcLine(raw, line);
    this.scheduleSave();
  }

  /**
   * Text Mode: ElevenAgents answers in text, so each NPC line is voiced here with ElevenLabs TTS in
   * the character's own designed voice, one after another. Playback drives the same speaking →
   * listening cycle as the live agent audio does in Voice Mode (handleMode).
   */
  private voiceNpcLine(raw: string, line: NpcLine) {
    this.npcVoiceQueue = this.npcVoiceQueue.then(async () => {
      if (this.disposed || this.ui.phase === "ending" || this.ui.phase === "done") return;
      const rate = AGENT_SPEED[this.difficulty];
      this.handleMode("speaking");
      try {
        await this.firstSave;
        const tts = await api.tts(raw, this.scenario.npc.voiceKey, 1, this.session.id);
        if (this.disposed) return;
        this.voiced.set(line.id, tts);
        const handle = await this.audio.playVoice(tts.url, rate);
        const karaoke = karaokeFor(line.text, tts.alignment, rate, handle.startedAt);
        if (karaoke && this.ui.subtitle?.id === line.id) this.set({ subtitle: { ...this.ui.subtitle, karaoke } });
        await handle.done;
      } catch (e) {
        // No audio (network, credits…): still give the learner time to read the line.
        console.warn("[babbli] NPC voice unavailable", e);
        await sleep(Math.min(5000, 800 + line.text.length * 45));
      } finally {
        this.handleMode("listening");
      }
    });
  }

  private handleUserTranscript(text: string) {
    if (!this.liveVoice) return;
    const turn = this.activeTurn;
    if (!turn || turn.transcriptAgent) return;
    turn.transcriptAgent = text;
    this.awaitingTool = turn.id;
    this.set({ userCaption: { text: cleanTranscript(text), final: true } });
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
    // The NPC has finished answering, yet the report tool never came: the engine didn't see that turn.
    if (this.awaitingTool) this.resyncAfterSkippedTool();
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
    // The reaction fades back to neutral — unless a newer reaction or line has replaced it by then.
    this.clearExpressionTimer();
    this.expressionTimer = setTimeout(() => {
      this.expressionTimer = null;
      if (!this.ui.npcSpeaking) this.set({ expression: "neutral" });
    }, 1400);
  }

  private clearExpressionTimer() {
    if (this.expressionTimer) clearTimeout(this.expressionTimer);
    this.expressionTimer = null;
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
    const expected = turn.expected;
    // The picked card helps the engine read the agent's intent label (several labels fit the same words).
    const chosen = expected ? { id: expected.intent, expect: expected.expect, keywords: expected.keywords } : null;
    const { outcome, state, intent } = resolveTurn(this.scenario, before, report, this.session.variant, this.difficulty, chosen);

    let intentMatched: boolean | null = null;
    if (expected) {
      const slotsOk = Object.entries(expected.expect ?? {}).every(([k, v]) => {
        const got = typeof report[k] === "string" ? (report[k] as string) : "";
        return !got || got === v;
      });
      intentMatched = intent === expected.intent && slotsOk;
    }
    turn.report = report;
    turn.transcriptAgent ||= report.heard;
    turn.endedAt ||= Date.now();
    turn.outcome = {
      kind: outcome.kind,
      success: outcome.success,
      answeredQuestion: outcome.answeredQuestion,
      intentMatched,
      intent,
      note: outcome.note,
      nextStageId: outcome.nextStageId,
    };
    this.session.state = state;
    this.log("turn_resolved", { turnId: turn.id, intent: report.intent, resolvedAs: intent, kind: outcome.kind, next: outcome.nextStageId });
    this.activeTurn = null;
    this.awaitingTool = null;
    this.pendingMeaning = outcome.meaning;
    this.narrationPending = outcome.nextStageId !== before.stageId && !!getStage(this.scenario, outcome.nextStageId).learnerOpens;

    // Every reply the engine counts as a success gets the chime — questions and small talk that
    // don't move the scene on included (asking for a repeat isn't an answer).
    const correct = outcome.success && outcome.kind !== "learner_clarify";
    if (correct) void this.audio.playSfx(assetUrl("ui-success"), 0.45);
    const immediate = (outcome.events ?? []).filter((e) => !DEFERRED.includes(e));
    this.deferredEvents.push(...(outcome.events ?? []).filter((e) => DEFERRED.includes(e)));
    for (const e of immediate) {
      this.addWorld(e);
      const sfx = this.scenario.sfx[e];
      // Scene sounds (bag rustle, card reader…) follow the chime instead of drowning it out.
      if (sfx) {
        setTimeout(() => {
          if (!this.disposed) void this.audio.playSfx(assetUrl(sfx), 0.6);
        }, correct ? 450 : 0);
      }
    }

    this.clearExpressionTimer();
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
    if (outcome.kind === "clarify") this.toast("They didn't quite get that. Try again.", "warn");
    this.startWatchdog(15000, () => this.recoverFromSilence());
    this.scheduleSave(200);
    this.stampScene(false);
    return formatDirective(this.scenario, outcome, state, this.difficulty);
  }

  /**
   * The agent answered the learner without calling the report tool, so nothing the NPC just said
   * happened in the scene. Quietly re-sync the agent (otherwise it keeps building on its own
   * improvisation, as if the scene had moved on) and give the learner the same turn back — the
   * cards stay as they were, since the scene didn't change.
   */
  private resyncAfterSkippedTool() {
    const turnId = this.awaitingTool;
    this.awaitingTool = null;
    this.log("tool_skipped", { turnId });
    this.clearWatchdog();
    try {
      this.controls?.sendContextualUpdate(buildResyncNote(this.scenario, this.session.state));
    } catch {
      /* not connected */
    }
    // The unjudged attempt stays in the record (no outcome); the learner's next reply is a new turn.
    if (this.activeTurn?.id === turnId) this.activeTurn = null;
  }

  private recoverFromSilence() {
    if (this.ui.phase !== "processing") return;
    this.awaitingTool = null;
    this.toast(`${this.scenario.npc.name} didn't respond. Try saying it again.`, "warn");
    this.set({ userCaption: null });
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
      inputMethod: this.textMode ? "text" : "voice",
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
    if (this.awaitingTool === turn.id) this.awaitingTool = null;
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
    const turn = this.createTurn(card);
    this.clearExpressionTimer();
    // Text Mode: the composer takes over — no microphone, captions or speaking time limit.
    if (this.textMode) {
      this.set({ expression: "neutral", userCaption: null });
      this.setPhase("speak");
      return;
    }
    this.set({ expression: "neutral", userCaption: { text: "", final: false } });
    this.setPhase("speak");
    if (this.recorder.ready) {
      this.recorder.start();
      this.set({ recording: true, micMuted: !this.liveVoice });
      if (!this.liveVoice) {
        this.captions.start(this.scenario.language, this.keyterms(turn)).catch((e) => console.warn("[babbli] live captions unavailable", e));
      }
      this.startTurnTimer();
    }
    this.audio.duck(true);
  }

  /** Time limit per turn: when the ring around the mic closes, the turn is sent automatically. */
  private startTurnTimer(ms = TURN_LIMIT_MS[this.difficulty]) {
    this.clearTurnTimer();
    this.heldTurnMs = null;
    this.set({ turnTimer: { startedAt: Date.now(), ms, total: TURN_LIMIT_MS[this.difficulty] } });
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (this.ui.phase !== "speak") return;
      this.log("turn_time_limit", { ms });
      this.toast("Time's up! Sending what you said.", "info");
      void this.finishSpeaking();
    }, ms);
  }

  private clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (this.ui.turnTimer) this.set({ turnTimer: null });
  }

  /** Freeze the time limit (e.g. while the exit dialog is open), keeping the time left. */
  holdTurnTimer() {
    const t = this.ui.turnTimer;
    if (!t) return;
    this.clearTurnTimer();
    this.heldTurnMs = Math.max(1500, t.ms - (Date.now() - t.startedAt));
  }

  resumeTurnTimer() {
    const ms = this.heldTurnMs;
    this.heldTurnMs = null;
    if (ms !== null && this.ui.phase === "speak" && this.ui.recording) this.startTurnTimer(ms);
  }

  backToChoices() {
    if (this.ui.phase !== "speak") return;
    void this.recorder.stop();
    this.captions.stop();
    this.cancelTurn();
    this.set({ recording: false, micMuted: true, selectedCard: null, userCaption: null });
    this.audio.duck(false);
    this.setPhase("choose");
  }

  /** Learner taps the mic to say they're done. */
  async finishSpeaking() {
    if (this.ui.phase !== "speak" || this.textMode) return;
    if (this.liveVoice) {
      await this.closeLiveTurn();
      this.startWatchdog(12000, () => this.recoverFromSilence());
      return;
    }
    // Push-to-talk: Scribe transcribes, then the text goes to the ElevenAgents NPC.
    const turn = this.activeTurn;
    this.captions.stop();
    this.setPhase("processing");
    this.set({ recording: false, busyLabel: "Listening…" });
    this.audio.duck(false);
    const rec = await this.recorder.stop();
    if (!turn || !rec) {
      this.cancelTurn();
      this.set({ busyLabel: null, userCaption: null });
      this.setPhase("choose");
      return;
    }
    turn.endedAt = Date.now();
    this.attachAudio(turn, rec);
    // Scribe answers in a second or two, but can stall now and then (the server tries again): say so.
    const slow = [
      setTimeout(() => this.ui.phase === "processing" && this.set({ busyLabel: "Still listening…" }), 5000),
      setTimeout(() => this.ui.phase === "processing" && this.set({ busyLabel: "ElevenLabs is slower than usual, one moment…" }), 12000),
    ];
    try {
      const stt = await api.stt(rec.blob, this.session.id, this.keyterms(turn)).finally(() => slow.forEach(clearTimeout));
      turn.stt = stt;
      if (!stt.transcript.trim() || stt.words.length === 0) {
        this.cancelTurn();
        this.set({ busyLabel: null, userCaption: null });
        this.toast("I didn't catch anything. Try again, a little closer to the mic.", "warn");
        this.setPhase("choose");
        return;
      }
      turn.transcriptAgent = stt.transcript;
      // The final (batch) transcript replaces the live caption — it's exactly what the NPC receives.
      this.set({ busyLabel: null, userCaption: { text: stt.transcript, final: true } });
      this.controls?.sendUserMessage(stt.transcript);
      this.awaitingTool = turn.id;
      this.log("ptt_sent", { turnId: turn.id, transcript: stt.transcript });
      this.startWatchdog(15000, () => this.recoverFromSilence());
    } catch (e) {
      this.cancelTurn();
      this.set({ busyLabel: null, userCaption: null });
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
      // The agent heard the learner directly; Scribe's word timings are only needed for the
      // results page, which transcribes the uploaded recording when someone opens it.
      if (rec) this.attachAudio(turn, rec);
    }
  }

  private keyterms(turn: LearnerTurn) {
    return Array.from(new Set([...(turn.expected?.keywords ?? []), ...this.scenario.asrKeywords])).slice(0, 40);
  }

  /** Store the raw recording server-side, for playback and scoring on the results page. */
  private attachAudio(turn: LearnerTurn, rec: Recording) {
    turn.audio = { mimeType: rec.mimeType, durationMs: Math.round(rec.durationMs), uploaded: false };
    const upload = api
      .uploadTurnAudio(this.session.id, turn.id, rec.blob)
      .then(() => {
        turn.audio!.uploaded = true;
        this.scheduleSave();
      })
      .catch((e) => console.warn("[babbli] audio upload failed", e))
      .finally(() => {
        this.uploadsDone++;
        this.showUploadProgress();
      });
    this.uploads.push(upload);
  }

  /** On the completion card while the scene is saved: how many recordings have reached the server. */
  private showUploadProgress() {
    if (!this.showingUploads) return;
    const total = this.uploads.length;
    this.set({ saveProgress: { label: `Uploading your recordings (${this.uploadsDone} of ${total})`, value: 0.1 + (0.75 * this.uploadsDone) / total } });
  }

  /** Text Mode only: the typed reply goes to the same ElevenAgents NPC (and engine) as speech would. */
  submitText(text: string) {
    const clean = text.trim();
    if (!clean || !this.controls || !this.textMode) return;
    if (this.ui.phase !== "choose" && this.ui.phase !== "speak") return;
    let turn = this.activeTurn;
    if (!turn) turn = this.createTurn(this.ui.selectedCard);
    turn.transcriptAgent = clean;
    turn.endedAt = Date.now();
    this.session.assistance.typedTurns += 1;
    this.set({ recording: false, micMuted: true, userCaption: { text: clean, final: true } });
    this.setPhase("processing");
    this.audio.duck(false);
    this.controls.sendUserMessage(clean);
    this.awaitingTool = turn.id;
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
    return this.ui.selectedCard ?? defaultHintCard(this.ui.cards);
  }

  toggleHelp() {
    this.set({ helpOpen: !this.ui.helpOpen });
  }

  toggleHints() {
    if (this.difficulty === "immersion") return; // no hints in Immersion
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
      const coach = coachVoiceKey(this.scenario.language, getProfile().coachVoice);
      // Native-pace audio (v3 ignores the TTS speed setting), slowed on playback for Beginner: the same
      // cached clip as the native reference on the results page (pre-generated by npm run setup).
      const tts = await api.tts(card.hints.full, coach, 1);
      const wasMuted = this.ui.micMuted;
      this.set({ voiceOwner: "coach", micMuted: true });
      this.audio.duck(true);
      const handle = await this.audio.playVoice(tts.url, this.difficulty === "beginner" ? 0.9 : 1);
      await handle.done;
      this.set({ voiceOwner: null, micMuted: wasMuted });
      this.audio.duck(this.ui.phase === "speak");
    } catch (e) {
      this.toast(`Couldn't play the audio hint: ${e instanceof Error ? e.message : e}`, "warn");
    } finally {
      this.set({ hintBusy: false });
    }
  }

  /**
   * Repeat / slow: the NPC's last line again, with karaoke timings. Voice Mode replays the agent's own
   * streamed audio and Text Mode the TTS the line was voiced with, so neither costs new speech.
   */
  async replay(slow: boolean) {
    const line = this.lastNpcLine;
    const phase = this.ui.phase;
    if (!line || this.ui.npcSpeaking || !["choose", "speak"].includes(phase)) return;
    this.recordAssist(slow ? "slows" : "repeats");
    this.set({ busyLabel: slow ? "Slowing down…" : null });
    try {
      const { url, alignment, rate } = await this.replaySource(line, slow);
      if (this.ui.npcSpeaking) return;
      const wasMuted = this.ui.micMuted;
      this.set({ micMuted: true, npcSpeaking: true, voiceOwner: "npc", busyLabel: null });
      this.audio.duck(true);
      const handle = await this.audio.playVoice(url, rate);
      this.replayHandle = handle;
      this.set({
        subtitle: {
          id: `${line.id}-r${Date.now()}`,
          text: line.text,
          meaning: line.meaning,
          speaker: line.speaker,
          karaoke: karaokeFor(line.text, alignment, rate, handle.startedAt),
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

  /** Audio and playback rate for a replay: Repeat plays the line as it was heard, Slow at SLOW_SPEED of the native pace. */
  private async replaySource(line: NpcLine, slow: boolean): Promise<{ url: string; alignment: TtsResult["alignment"]; rate: number }> {
    const pace = AGENT_SPEED[this.difficulty];
    // Voice Mode: the agent already spoke at the level's pace.
    const clip = this.tape.clip(line.id);
    if (clip) {
      this.log("replay_source", { source: "agent" });
      return { ...clip, rate: slow ? Math.min(0.8, SLOW_SPEED / pace) : 1 };
    }
    // Text Mode: native-pace TTS, played at the level's pace (see voiceNpcLine).
    const voiced = this.voiced.get(line.id);
    if (voiced) {
      this.log("replay_source", { source: "voiced" });
      return { url: voiced.url, alignment: voiced.alignment, rate: slow ? SLOW_SPEED : pace };
    }
    // No audio kept (e.g. the stream was cut): voice the line again. Same audio for Repeat and Slow
    // (v3 ignores the TTS speed setting); the rate is applied on playback.
    this.log("replay_source", { source: "tts" });
    const tts = await api.tts(line.text, this.scenario.npc.voiceKey, 1, this.session.id);
    return { url: tts.url, alignment: tts.alignment, rate: slow ? SLOW_SPEED : REPLAY_SPEED[this.difficulty] };
  }

  toggleSubtitles() {
    if (this.difficulty !== "beginner") return; // on in Intermediate, off in Immersion — fixed
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
    this.stopIdleWatch();
    this.clearWatchdog();
    this.captions.stop();
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
    if (this.scenario.musicAsset) this.audio.stopMusic(2.5);
    this.set({ npcSpeaking: false, recording: false, micMuted: true });
    if (status === "completed") void this.audio.playSfx(assetUrl("ui-complete"), 0.6);
    this.session.status = status;
    const badges = this.stampScene(true);
    this.session.endedAt = Date.now();
    this.log("session_end", { status });
    // The card shows straight away; the session is saved underneath it, with its progress on the card.
    const objectiveComplete = this.session.state.objectiveComplete;
    this.set({ busyLabel: null, completion: { objectiveComplete, badges }, saveProgress: { label: "Ending the conversation", value: 0.05 } });
    if (this.uploadsDone < this.uploads.length) {
      // At most 9 s: a slower upload still lands later, and marks its reply as uploaded then.
      this.showingUploads = true;
      this.showUploadProgress();
      await Promise.race([Promise.allSettled(this.uploads), sleep(9000)]);
      this.showingUploads = false;
    }
    this.set({ saveProgress: { label: "Saving your session", value: 0.92 } });
    const saved = (await this.saveNow()) || (await sleep(1500).then(() => this.saveNow()));
    this.set({ saveProgress: null, completion: { objectiveComplete, badges, saveFailed: !saved } });
    this.setPhase("done");
  }

  /**
   * This browser's record of the scene: passport pins (cosmetic, never part of the session or its
   * scores) and the home page's recent sessions. Kept up to date after every reply, so a scene left by
   * closing the tab is listed too; only the final stamp can complete it and unlock pins.
   */
  private stampScene(final: boolean): BadgeId[] {
    try {
      return recordScene({
        sessionId: this.session.id,
        scenarioId: this.scenario.id,
        language: this.scenario.language,
        difficulty: this.difficulty,
        responseMode: this.responseMode,
        completed: final && this.session.state.objectiveComplete,
        hints: this.session.assistance.hints.length,
        replies: this.session.turns.length,
        at: Date.now(),
      });
    } catch (e) {
      console.warn("[babbli] passport not updated", e);
      return [];
    }
  }

  /** Re-arm after a StrictMode dev unmount/remount cycle (nothing has started yet at that point). */
  activate() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    this.stopIdleWatch();
    this.tape.clear();
    this.clearWatchdog();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.captions.stop();
    if (this.activityTimer) clearInterval(this.activityTimer);
    if (this.listeningTimer) clearTimeout(this.listeningTimer);
    this.clearExpressionTimer();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    try {
      this.controls?.endSession();
    } catch {
      /* noop */
    }
    this.recorder.release();
    this.audio.stopVoice();
    this.audio.stopAmbient(0.6);
    if (this.scenario.musicAsset) this.audio.stopMusic(0.6);
    if (this.session.turns.length && this.session.status === "active") {
      this.session.status = "abandoned";
      this.session.endedAt = Date.now();
      void api.saveSession(this.session).catch(() => undefined);
    }
  }
}
