"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PlayButton } from "@/components/dashboard/PlayButton";

interface Status {
  hasKey: boolean;
  config: Record<string, string>;
  subscription: { tier: string; used: number; limit: number } | null;
  voices: { key: string; name: string; role: string; language: string; description: string; voiceId: string | null; designed: boolean; error: string | null }[];
  agents: { scenarioId: string; title: string; name: string; agentId: string | null; toolId: string | null; llm: string | null; ttsModel: string | null; degraded: string | null; updatedAt: string | null }[];
  assets: { id: string; label: string; kind: string; prompt: string; ready: boolean }[];
}

type Job = { kind: "voice" | "agent" | "asset"; id: string; force?: boolean };

export function StudioClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/studio");
    setStatus(await r.json());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (job: Job) => {
    const label = `${job.kind}:${job.id}`;
    setBusy(label);
    const t0 = performance.now();
    try {
      const r = await fetch("/api/studio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(job) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? r.statusText);
      setStatus(body);
      setLog((l) => [`✓ ${label} (${((performance.now() - t0) / 1000).toFixed(1)}s)`, ...l]);
    } catch (e) {
      setLog((l) => [`✗ ${label}: ${e instanceof Error ? e.message : e}`, ...l]);
    } finally {
      setBusy(null);
    }
  };

  const provisionAll = async () => {
    if (!status) return;
    const jobs: Job[] = [
      ...status.voices.filter((v) => !v.designed).map((v) => ({ kind: "voice" as const, id: v.key })),
      ...status.agents.map((a) => ({ kind: "agent" as const, id: a.scenarioId })),
      ...status.assets.filter((a) => !a.ready).map((a) => ({ kind: "asset" as const, id: a.id })),
    ];
    for (const j of jobs) await run(j);
  };

  if (!status) return <main className="grid min-h-dvh place-items-center bg-night text-cream/70">Loading…</main>;

  return (
    <main className="min-h-dvh bg-night pb-20 text-cream">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <Link href="/" className="text-sm font-bold text-cream/70 hover:text-cream">
          ← Babbli
        </Link>
        <h1 className="mt-4 font-display text-4xl">ElevenLabs Studio</h1>
        <p className="mt-1 max-w-3xl text-cream/70">
          Everything Babbli creates on ElevenLabs: conversational NPC agents (ElevenAgents), designed native voices, and the generated soundscape (ElevenCreative
          Sound Effects &amp; Music). Resources are created once, then reused. You can also run <code className="rounded bg-white/10 px-1">npm run setup</code>.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${status.hasKey ? "bg-[#0ca30c]/20 text-[#7be07b]" : "bg-[#d03b3b]/25 text-[#ffb3b3]"}`}>
            {status.hasKey ? "✓ ELEVENLABS_API_KEY found" : "✗ ELEVENLABS_API_KEY missing — add it to .env.local"}
          </span>
          {status.subscription && (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
              {status.subscription.tier} · {status.subscription.used.toLocaleString()} / {status.subscription.limit.toLocaleString()} credits used
            </span>
          )}
          <button
            disabled={!status.hasKey || !!busy}
            onClick={() => void provisionAll()}
            className="rounded-full bg-tangerine px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? `Working… ${busy}` : "Provision everything"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-cream/60">
          {Object.entries(status.config).map(([k, v]) => (
            <span key={k} className="rounded bg-white/5 px-2 py-1">
              {k}: <b className="text-cream/85">{v}</b>
            </span>
          ))}
        </div>

        <h2 className="mt-10 font-display text-2xl">ElevenAgents · NPCs</h2>
        <p className="text-sm text-cream/60">One agent per scene, with a client tool that hands every learner turn to Babbli&apos;s deterministic scenario engine, plus post-call evaluation criteria &amp; data collection.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {status.agents.map((a) => (
            <div key={a.scenarioId} className="rounded-2xl bg-white/5 p-4">
              <div className="font-bold">{a.title}</div>
              <div className="mt-1 break-all text-xs text-cream/60">{a.agentId ?? "not created yet"}</div>
              {a.agentId && (
                <div className="mt-1 text-xs text-cream/70">
                  LLM {a.llm} · TTS {a.ttsModel}
                  {a.degraded && <span className="ml-1 text-gold">(fallback: {a.degraded})</span>}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!status.hasKey || !!busy} onClick={() => void run({ kind: "agent", id: a.scenarioId, force: true })} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/15 disabled:opacity-50">
                  {a.agentId ? "Sync config" : "Create agent"}
                </button>
                {a.agentId && (
                  <a href={`https://elevenlabs.io/app/agents/agents/${a.agentId}`} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/15">
                    Open in ElevenLabs ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 font-display text-2xl">Voice Design · characters</h2>
        <p className="text-sm text-cream/60">Each character voice is designed from a text description in its native language.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {status.voices.map((v) => (
            <div key={v.key} className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold">{v.name.replace("Babbli · ", "")}</div>
                <span className="text-xs font-bold uppercase text-cream/50">{v.language}</span>
              </div>
              <div className="text-xs text-gold/90">{v.role}</div>
              <p className="mt-1 text-xs leading-snug text-cream/60">{v.description}</p>
              <div className="mt-2 text-xs">
                {v.designed ? (
                  <span className="text-[#7be07b]">✓ designed · {v.voiceId}</span>
                ) : v.voiceId ? (
                  <span className="text-gold" title={v.error ?? ""}>
                    ◐ using premade fallback
                  </span>
                ) : (
                  <span className="text-cream/50">not created yet</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!v.designed && (
                  <button disabled={!status.hasKey || !!busy} onClick={() => void run({ kind: "voice", id: v.key, force: true })} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/15 disabled:opacity-50">
                    Design voice
                  </button>
                )}
                {v.designed && <PlayButton src={`/api/voices/${v.key}/preview`} label="Preview" />}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 font-display text-2xl">Sound Effects &amp; Music · immersion layer</h2>
        <p className="text-sm text-cream/60">Looping ambience, one-shot effects and the menu theme — generated from prompts, cached on disk.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {status.assets.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-3">
              <div>
                <div className="text-sm font-bold">
                  {a.kind === "music" ? "🎵" : "🔊"} {a.label} {a.ready ? <span className="text-[#7be07b]">✓</span> : <span className="text-cream/40">○</span>}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-cream/55">{a.prompt}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {a.ready && <PlayButton src={`/api/assets/${a.id}`} label="Play" />}
                <button disabled={!status.hasKey || !!busy} onClick={() => void run({ kind: "asset", id: a.id, force: a.ready })} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/15 disabled:opacity-50">
                  {a.ready ? "Regenerate" : "Generate"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {log.length > 0 && (
          <div className="mt-8 rounded-xl bg-black/30 p-4 font-mono text-xs text-cream/80">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
