"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

/** When the intro starts to lift (see .intro in globals.css), and when it's gone. */
const LIFT_MS = 1550;
const DONE_MS = 2100;

/**
 * Played once per page load: coming back home from a scene doesn't replay it. Only ever set in the
 * browser (effects don't run on the server, whose modules every visitor shares).
 */
let played = false;
/** Called when the intro lifts early (skipped with a click). */
const skipped = new Set<() => void>();

/**
 * The 2-second intro on the home page: the mark slides in from the left, the name from the right, then
 * the navy screen lifts. Pure CSS (globals.css), so it runs from the first paint, before the page is
 * interactive. A click skips it; reduced-motion users never see it.
 */
export function Intro() {
  const [show, setShow] = useState(!played);
  useEffect(() => {
    if (!show) return;
    played = true;
    const t = setTimeout(() => setShow(false), DONE_MS);
    return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  const skip = () => {
    setShow(false);
    skipped.forEach((reveal) => reveal());
  };
  return (
    <div className="intro" aria-hidden onClick={skip}>
      <div className="intro-stage">
        <div className="intro-mark">
          <LogoMark className="h-14 w-auto sm:h-20" decorative />
        </div>
        <span className="intro-word">Babbli</span>
      </div>
    </div>
  );
}

/** Whether the home page may animate in: straight away without the intro, else as it lifts (or is skipped). */
export function useIntroRevealed() {
  const [revealed, setRevealed] = useState(played);
  useEffect(() => {
    if (revealed) return;
    const reveal = () => setRevealed(true);
    const t = setTimeout(reveal, LIFT_MS);
    skipped.add(reveal);
    return () => {
      clearTimeout(t);
      skipped.delete(reveal);
    };
  }, [revealed]);
  return revealed;
}
