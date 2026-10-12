"use client";
import { useRef } from "react";
import { gsap, MOTION, useGSAP, useReducedMotion } from "@/lib/motion";
import s from "./landing.module.css";

/**
 * Hero scene: a real question from the demo corpus → the cited source passage
 * → the deliverable that keeps the citation. One 650–900 ms sequence, no loop.
 * It illustrates the product flow; it is not a live execution.
 */
export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (reduced) return;
      const paths = gsap.utils.toArray<SVGPathElement>("[data-link]");
      paths.forEach((p) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      });
      const tl = gsap.timeline({ defaults: { ease: MOTION.ease } });
      tl.from("[data-node='q']", { y: 10, opacity: 0, duration: 0.22 })
        .to(paths[0] ?? {}, { strokeDashoffset: 0, duration: 0.18 }, "-=0.04")
        .from("[data-node='src']", { y: 10, opacity: 0, duration: 0.2 }, "-=0.06")
        .from("[data-mark]", { backgroundColor: "rgba(25,182,164,0)", duration: 0.16 }, "-=0.06")
        .to(paths[1] ?? {}, { strokeDashoffset: 0, duration: 0.16 }, "-=0.04")
        .from("[data-node='art']", { y: 10, opacity: 0, duration: 0.2 }, "-=0.06");
      // total ≈ 0.85 s
    },
    { scope: ref, dependencies: [reduced] },
  );
  return (
    <div ref={ref} className={s.scene} role="img" aria-label="Illustration: a customer question is answered by quoting the Refund & Cancellation Policy version 2, page 1, and the quote is carried into a report with source S1.">
      <svg className={s.links} viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden>
        <path data-link d="M150 118 C 150 170, 260 170, 300 205" fill="none" stroke="var(--teal)" strokeWidth="2" />
        <path data-link d="M330 345 C 360 380, 440 380, 450 405" fill="none" stroke="var(--violet)" strokeWidth="2" />
      </svg>
      <div className={`${s.node} ${s.nodeQ}`} data-node="q">
        <span className="eyebrow">Question · customer</span>
        <p>How long do approved refunds take?</p>
      </div>
      <div className={`${s.node} ${s.nodeSrc}`} data-node="src">
        <span className={s.srcHead}>
          <span className={s.srcRef}>S1</span> Refund &amp; Cancellation Policy <span className="mono">v2 · p.1</span>
        </span>
        <p className={s.srcText}>
          Refund timeline.{" "}
          <mark data-mark className={s.srcMark}>
            Approved refunds are issued within 14 days to the original payment method.
          </mark>{" "}
          Refund requests must include the shipment tracking number.
        </p>
      </div>
      <div className={`${s.node} ${s.nodeArt}`} data-node="art">
        <span className="eyebrow">Deliverable · report v1</span>
        <p>
          Customer refunds: issued within 14 days <sup className={s.sup}>[S1]</sup>
        </p>
        <span className={s.artFoot}>Draft · needs review</span>
      </div>
    </div>
  );
}
