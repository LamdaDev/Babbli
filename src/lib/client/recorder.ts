"use client";

/**
 * Captures the learner's raw audio per turn (kept for evaluation and playback),
 * independently of the ElevenAgents audio stream.
 */
export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export class MicRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private stopping: Promise<Recording | null> | null = null;

  get ready() {
    return !!this.stream;
  }

  async init() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.data = new Uint8Array(this.analyser.fftSize);
    src.connect(this.analyser);
  }

  get recording() {
    return this.recorder?.state === "recording";
  }

  start() {
    if (!this.stream || this.recording) return;
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    const mimeType = pickMime();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.recorder.start(250);
    this.startedAt = performance.now();
    this.stopping = null;
  }

  stop(): Promise<Recording | null> {
    if (this.stopping) return this.stopping;
    const rec = this.recorder;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    this.stopping = new Promise((resolve) => {
      rec.onstop = () => {
        const mimeType = rec.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        resolve(blob.size > 0 ? { blob, mimeType, durationMs: performance.now() - this.startedAt } : null);
      };
      rec.stop();
    });
    return this.stopping;
  }

  /** 0..1 microphone level. */
  level() {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.data.length) * 5);
  }

  release() {
    try {
      if (this.recorder?.state === "recording") this.recorder.stop();
    } catch {
      /* noop */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
  }
}
