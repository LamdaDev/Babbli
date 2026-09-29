"use client";

import { useSyncExternalStore } from "react";

/**
 * A link opened inside an app (LinkedIn, Facebook, Instagram) loads in that app's built-in browser,
 * which often blocks or mishandles the microphone, especially on iPhone.
 */
export interface InAppBrowser {
  app: "LinkedIn" | "Facebook" | "Instagram";
  os: "ios" | "android" | "other";
}

export function detectInAppBrowser(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): InAppBrowser | null {
  // Instagram's user agent also carries Facebook's markers, so it goes first.
  const app = /LinkedInApp/i.test(ua) ? "LinkedIn" : /Instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ? "Facebook" : null;
  if (!app) return null;
  return { app, os: /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other" };
}

const noSubscribe = () => () => undefined;

/** The in-app browser this page is open in (null on the server and in a real browser). */
export function useInAppBrowser(): InAppBrowser | null {
  // Detected once per page: the user agent never changes.
  return useSyncExternalStore(noSubscribe, cachedDetect, () => null);
}

let cached: InAppBrowser | null | undefined;
function cachedDetect() {
  if (cached === undefined) cached = detectInAppBrowser();
  return cached;
}

/** Android: the same page in Chrome (an intent link works from in-app browsers). */
export function chromeIntentUrl(href: string) {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
}
