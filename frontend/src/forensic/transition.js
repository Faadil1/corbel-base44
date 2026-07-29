// Forensic transition engine — local, preview-only.
// Drives staged state-transition motion via per-channel interpolation.
// No Base44 imports. No backend. No persistence.

import { useEffect, useRef, useState } from "react";
import { getForensicState } from "./forensicSampleData";

const TOP = 96;
const BOTTOM = 730;
const TOTAL = BOTTOM - TOP;
const AFFECTED = "Fall protection anchor";

const frac = (capY) => (capY == null ? 1 : (capY - TOP) / TOTAL);

function textFor(key) {
  const d = getForensicState(key);
  return {
    word: d.stateWord,
    qualifier: d.stateQualifier,
    sentence: d.statusSentence,
    affectedLabel: key === "READY" || key === "RELEASED" ? null : AFFECTED,
  };
}

// Static channel snapshot per state. Final frame of every transition == this.
const SNAP = {
  READY:        { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:1,         capY:null, capVis:0, releaseBlocked:0, downGhost:0, deflect:0, dimmed:0, void:0, compactPresent:1, fullPresent:0, rejected:0, restraint:1,   receipt:0, annoPrev:0, annoNext:1 },
  HOLD_UNOWNED: { ownerName:0, socketSeated:0, transferJoint:0, cavity:1, pathFrac:frac(450),  capY:450,  capVis:1, releaseBlocked:1, downGhost:1, deflect:1, dimmed:1, void:0, compactPresent:0, fullPresent:0, rejected:0, restraint:0,   receipt:0, annoPrev:0, annoNext:1 },
  HOLD_OWNED:   { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:frac(466),  capY:466,  capVis:1, releaseBlocked:1, downGhost:1, deflect:0, dimmed:0, void:1, compactPresent:0, fullPresent:0, rejected:0, restraint:0,   receipt:0, annoPrev:0, annoNext:1 },
  VERIFYING:    { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:frac(466),  capY:466,  capVis:1, releaseBlocked:1, downGhost:1, deflect:0, dimmed:0, void:0, compactPresent:0, fullPresent:1, rejected:0, restraint:0.5, receipt:0, annoPrev:0, annoNext:1 },
  RELEASED:     { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:1,         capY:null, capVis:0, releaseBlocked:0, downGhost:0, deflect:0, dimmed:0, void:0, compactPresent:0, fullPresent:1, rejected:0, restraint:1,   receipt:1, annoPrev:0, annoNext:1 },
  REJECTED:     { ownerName:1, socketSeated:1, transferJoint:1, cavity:0, pathFrac:frac(466),  capY:466,  capVis:1, releaseBlocked:1, downGhost:1, deflect:0, dimmed:0, void:0, compactPresent:0, fullPresent:1, rejected:1, restraint:0,   receipt:0, annoPrev:0, annoNext:1 },
};

// Per-transition plan: duration (ms) + per-channel [start,end] windows.
// Channels not listed animate across the full duration.
const TRANSITIONS = {
  "READY>HOLD_UNOWNED": { duration: 320, channels: {
    ownerName:[0,70], restraint:[0,70], compactPresent:[0,70], dimmed:[0,70],
    socketSeated:[50,120], transferJoint:[50,120], cavity:[50,120],
    pathFrac:[90,190], capVis:[90,190],
    deflect:[130,220], downGhost:[170,260], releaseBlocked:[220,320],
  }},
  "HOLD_UNOWNED>HOLD_OWNED": { duration: 300, channels: {
    ownerName:[0,80],
    socketSeated:[50,130], transferJoint:[50,130], cavity:[50,130],
    pathFrac:[50,130], capY:[50,130],
    deflect:[90,180], dimmed:[90,180], void:[140,220],
  }},
  "HOLD_OWNED>VERIFYING": { duration: 240, channels: {
    void:[0,200], fullPresent:[0,200], restraint:[80,220],
  }},
  "VERIFYING>RELEASED": { duration: 300, channels: {
    restraint:[0,140],
    pathFrac:[80,240], capVis:[80,240], capY:[80,240],
    downGhost:[80,240], releaseBlocked:[80,240],
    receipt:[240,300],
  }},
  "VERIFYING>REJECTED": { duration: 240, channels: {
    restraint:[0,100], rejected:[70,170],
  }},
};

const lerp = (a, b, p) => a + (b - a) * p;

function lerpCapY(a, b, p) {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a; // keep position while cap visibility fades
  return lerp(a, b, p);
}

function chanProgress(t, w, duration) {
  const s = w[0] / duration;
  const e = w[1] / duration;
  if (e <= s) return t >= s ? 1 : 0;
  if (t <= s) return 0;
  if (t >= e) return 1;
  return (t - s) / (e - s);
}

function computeChannels(fromSnap, toSnap, windows, t, duration) {
  if (t >= 1) return { ...toSnap };
  const out = {};
  for (const k of Object.keys(toSnap)) {
    if (k === "annoPrev" || k === "annoNext") continue;
    const a = fromSnap[k];
    const b = toSnap[k];
    if (a === b) {
      out[k] = a;
      continue;
    }
    const w = windows[k] ?? [0, duration];
    const p = chanProgress(t, w, duration);
    out[k] = k === "capY" ? lerpCapY(a, b, p) : lerp(a, b, p);
  }
  // annotation crossfade (prev out, next in) — no overlapping text
  out.annoPrev = 1 - Math.min(1, t / 0.3);
  out.annoNext = Math.max(0, (t - 0.3) / 0.7);
  return out;
}

export function useForensicTransition(stateKey) {
  const [channels, setChannels] = useState(() => SNAP[stateKey] || SNAP.READY);
  const [text, setText] = useState(() => ({ prev: textFor(stateKey), next: textFor(stateKey) }));
  const [prevKey, setPrevKey] = useState(stateKey);
  const prevKeyRef = useRef(stateKey);
  const channelsRef = useRef(channels);
  const rafRef = useRef(0);
  const reducedRef = useRef(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    const from = prevKeyRef.current;
    const to = stateKey;
    if (from === to) return;
    setText({ prev: textFor(from), next: textFor(to) });

    // Reduced motion: render final geometry immediately; opacity handled by
    // a 120ms CSS transition on .fl-anim-opacity. No staged sequence.
    if (reducedRef.current) {
      const fin = { ...SNAP[to] };
      setChannels(fin);
      channelsRef.current = fin;
      prevKeyRef.current = to;
      setPrevKey(to);
      return;
    }

    const plan = TRANSITIONS[`${from}>${to}`];
    const duration = plan?.duration ?? 300;
    const windows = plan?.channels ?? {};
    const fromSnap = { ...channelsRef.current };
    const toSnap = SNAP[to];

    // Set the start frame synchronously so the new annotation text does not
    // flash for a frame before the first rAF tick.
    const startFrame = computeChannels(fromSnap, toSnap, windows, 0, duration);
    channelsRef.current = startFrame;
    setChannels(startFrame);

    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ch = computeChannels(fromSnap, toSnap, windows, t, duration);
      channelsRef.current = ch;
      setChannels(ch);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevKeyRef.current = to;
        setPrevKey(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stateKey]);

  return { channels, text, prevKey };
}
