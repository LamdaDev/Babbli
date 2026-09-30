"use client";

import { useState } from "react";
import { chromeIntentUrl, type InAppBrowser } from "@/lib/client/inAppBrowser";

const BROWSER = { ios: "Safari", android: "Chrome", other: "your browser" } as const;

/** "Copy link", then "Link copied" for a moment. */
function CopyLink({ className }: { className: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  };
  return (
    <button onClick={() => void copy()} className={className}>
      {copied ? "✓ Link copied" : "Copy link"}
    </button>
  );
}

/**
 * Babbli opened inside an app's built-in browser (LinkedIn…), where the microphone often fails:
 * open it in a real browser for voice, or keep going in Text Mode.
 * "banner" sits on the home page; "card" stands between a Voice Mode scene and its microphone.
 */
export function InAppNotice({
  info,
  variant,
  onTextMode,
  textHref,
  onVoiceAnyway,
  textModeOn = false,
}: {
  info: InAppBrowser;
  variant: "banner" | "card";
  onTextMode?: () => void;
  /** Home page: Text Mode is already the chosen way to respond. */
  textModeOn?: boolean;
  textHref?: string;
  onVoiceAnyway?: () => void;
}) {
  const browser = BROWSER[info.os];
  const how =
    info.os === "other"
      ? "open this page in your usual browser"
      : `open the ${info.app} menu (••• or ⋮) and choose to open the page in ${browser}, or copy the link into ${browser}`;
  const secondary = "rounded-2xl border-2 border-ink/15 px-4 py-2.5 text-center text-sm font-bold transition hover:border-brand/40";
  const primary = "rounded-2xl bg-brand px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-brand-dark";
  const textMode = textHref ? (
    <a href={textHref} className={primary}>
      Continue in Text Mode
    </a>
  ) : (
    <button onClick={onTextMode} className={primary} aria-pressed={textModeOn}>
      {textModeOn ? "✓ Text Mode selected" : "Use Text Mode"}
    </button>
  );
  const openChrome = info.os === "android" && (
    <a href={chromeIntentUrl(window.location.href)} className={secondary}>
      Open in Chrome
    </a>
  );

  if (variant === "banner") {
    return (
      <div role="note" className="mt-6 flex flex-col gap-3 rounded-2xl bg-gold/15 p-4 ring-1 ring-gold/40 sm:flex-row sm:items-center">
        <span className="text-2xl" aria-hidden>
          📱
        </span>
        <p className="flex-1 text-sm leading-snug">
          <span className="font-bold">You&apos;re in {info.app}&apos;s built-in browser.</span> Voice practice needs your microphone, which often doesn&apos;t work
          here. For voice, {how}. Or continue in Text Mode.
        </p>
        <div className="flex flex-wrap gap-2">
          {openChrome}
          <CopyLink className={secondary} />
          {textMode}
        </div>
      </div>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby="inapp-title" className="paper-grain w-full max-w-md rounded-3xl bg-paper p-6 text-ink shadow-2xl">
      <div className="text-4xl" aria-hidden>
        📱
      </div>
      <h2 id="inapp-title" className="mt-2 font-display text-2xl">
        The microphone may not work here
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        You opened Babbli inside {info.app}, whose built-in browser often blocks the microphone{info.os === "ios" ? ", especially on iPhone" : ""}. For voice,{" "}
        {how}. Or keep going in Text Mode: the same scene, and you type your replies.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {textMode}
        <div className="flex gap-2 [&>*]:flex-1">
          {openChrome}
          <CopyLink className={secondary} />
        </div>
        {onVoiceAnyway && (
          <button onClick={onVoiceAnyway} className="mt-1 text-sm font-bold text-ink-soft underline-offset-4 hover:underline">
            Try voice here anyway
          </button>
        )}
      </div>
    </div>
  );
}
