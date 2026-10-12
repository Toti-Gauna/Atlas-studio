"use client";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useSyncExternalStore } from "react";

gsap.registerPlugin(useGSAP);

/** Motion budget from the art direction (seconds). Mirrors --d-* tokens. */
export const MOTION = {
  hero: 0.8, // 650–900 ms question → source → artifact
  agent: 0.2, // 180–220 ms agent selection
  drawer: 0.24, // 200–280 ms drawer/canvas
  reco: 0.28, // 240–320 ms recommendation cards
  step: 0.22, // workflow step highlight on server state
  ease: "power2.out",
} as const;

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true, // server snapshot: assume reduced so nothing animates before hydration
  );
}

export { gsap, useGSAP };
