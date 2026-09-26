"use client";

/**
 * Web Audio mixer for the scene: ambient loop (with ducking), one-shot SFX,
 * background character voices, and foreground voice playback routed through
 * an analyser so the NPC's mouth can follow the audio amplitude.
 */
export interface VoiceHandle {
  stop: () => void;
  done: Promise<void>;
  startedAt: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambientGain!: GainNode;
  private sfxGain!: GainNode;
  private voiceGain!: GainNode;
  private musicGain!: GainNode;
  private analyser!: AnalyserNode;
  private analyserData!: Uint8Array<ArrayBuffer>;
  private ambientSource: AudioBufferSourceNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private currentVoice: (() => void) | null = null;
  private ambientBase = 0.22;
  private ducked = false;

  get context() {
    return this.ctx;
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0;
    this.ambientGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.55;
    this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.5;
    this.analyserData = new Uint8Array(this.analyser.fftSize);
    this.voiceGain = ctx.createGain();
    this.voiceGain.connect(this.analyser);
    this.analyser.connect(this.master);
    return ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  load(url: string): Promise<AudioBuffer> {
    const ctx = this.ensure();
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Audio ${url} → ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => ctx.decodeAudioData(b));
      p.catch(() => this.buffers.delete(url));
      this.buffers.set(url, p);
    }
    return p;
  }

  /* ---------- ambience ---------- */

  async startAmbient(url: string, base: number) {
    const ctx = this.ensure();
    this.ambientBase = base;
    const buffer = await this.load(url);
    this.stopAmbient(0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.ambientGain);
    src.start();
    this.ambientSource = src;
    this.rampAmbient(this.ducked ? base * 0.3 : base, 2.5);
  }

  stopAmbient(fade = 1.2) {
    const src = this.ambientSource;
    if (!src || !this.ctx) return;
    this.rampAmbient(0, fade);
    setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }, fade * 1000 + 50);
    this.ambientSource = null;
  }

  private rampAmbient(target: number, seconds: number) {
    if (!this.ctx) return;
    const g = this.ambientGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + seconds);
  }

  /** Dialogue ducking: ambience drops to ~30% of its base while someone is speaking. */
  duck(on: boolean) {
    this.ducked = on;
    this.rampAmbient(on ? this.ambientBase * 0.3 : this.ambientBase, on ? 0.35 : 0.9);
  }

  setAmbientBase(base: number) {
    this.ambientBase = base;
    this.rampAmbient(this.ducked ? base * 0.3 : base, 0.5);
  }

  /* ---------- music ---------- */

  async startMusic(url: string, level = 0.35) {
    const ctx = this.ensure();
    const buffer = await this.load(url);
    this.stopMusic(0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.musicSource = src;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(0, ctx.currentTime);
    g.linearRampToValueAtTime(level, ctx.currentTime + 2);
  }

  stopMusic(fade = 1) {
    const src = this.musicSource;
    if (!src || !this.ctx) return;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
    setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* noop */
      }
    }, fade * 1000 + 50);
    this.musicSource = null;
  }

  /* ---------- sfx & voices ---------- */

  async playSfx(url: string, gain = 1) {
    try {
      const ctx = this.ensure();
      const buffer = await this.load(url);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.sfxGain);
      src.start();
    } catch (e) {
      console.warn("[babbli] sfx failed", url, e);
    }
  }

  /** A secondary character heard from elsewhere in the room (panned, quieter, not lip-synced). */
  async playBackgroundVoice(url: string, pan = -0.45, gain = 0.5): Promise<void> {
    const ctx = this.ensure();
    const buffer = await this.load(url);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.master);
    src.start();
    return new Promise((resolve) => (src.onended = () => resolve()));
  }

  /**
   * Foreground voice (NPC replay / coach audio) routed through the analyser.
   * `rate` below/above 1 slows/speeds it up with the pitch kept.
   */
  async playVoice(url: string, rate = 1): Promise<VoiceHandle> {
    const ctx = this.ensure();
    if (rate !== 1) return this.playStretched(ctx, url, rate);
    const buffer = await this.load(url);
    this.stopVoice();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.voiceGain);
    const done = new Promise<void>((resolve) => (src.onended = () => resolve()));
    src.start();
    const stop = () => {
      try {
        src.stop();
      } catch {
        /* noop */
      }
    };
    this.currentVoice = stop;
    return { stop, done, startedAt: ctx.currentTime };
  }

  /**
   * ElevenLabs v3 ignores the TTS `speed` setting, so slow replays are time-stretched here:
   * a media element with preservesPitch (the browser's own 0.75x-style playback), fed into
   * the same voice bus so ducking and lip-sync still follow it.
   */
  private async playStretched(ctx: AudioContext, url: string, rate: number): Promise<VoiceHandle> {
    this.stopVoice();
    const el = new Audio(url);
    el.preservesPitch = true;
    el.playbackRate = rate;
    const node = ctx.createMediaElementSource(el);
    node.connect(this.voiceGain);
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => (resolveDone = resolve));
    const stop = () => {
      el.pause();
      node.disconnect();
      resolveDone();
    };
    el.onended = stop;
    el.onerror = stop;
    this.currentVoice = stop;
    try {
      await el.play();
    } catch (e) {
      stop();
      throw e;
    }
    return { stop, done, startedAt: ctx.currentTime };
  }

  stopVoice() {
    try {
      this.currentVoice?.();
    } catch {
      /* noop */
    }
    this.currentVoice = null;
  }

  /** 0..1 amplitude of the foreground voice (for pseudo lip-sync). */
  voiceLevel() {
    if (!this.ctx) return 0;
    this.analyser.getByteTimeDomainData(this.analyserData);
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = (this.analyserData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.analyserData.length) * 4);
  }

  now() {
    return this.ctx?.currentTime ?? 0;
  }
}

let engine: AudioEngine | null = null;
export function audioEngine() {
  if (!engine) engine = new AudioEngine();
  return engine;
}
