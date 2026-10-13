"use client";
import Link from "next/link";
import { ArrowRight, BarChart3, Bot, FileCheck2, Quote, ShieldCheck, Workflow } from "lucide-react";
import { copy } from "@/copy/en";
import { landing } from "@/copy/landing";
import { AtlasMark } from "@/components/shell/AtlasMark";
import { LinkButton, ModeBadge } from "@/components/ui";
import { asset } from "@/lib/config";
import { HeroScene } from "./HeroScene";
import s from "./landing.module.css";

const PILLARS = [
  { icon: Quote, ...landing.pillars[0] },
  { icon: Bot, ...landing.pillars[1] },
  { icon: FileCheck2, ...landing.pillars[2] },
];
const CONTROL = [
  { icon: BarChart3, ...landing.control[0] },
  { icon: ShieldCheck, ...landing.control[1] },
  { icon: Workflow, ...landing.control[2] },
];

export function Landing() {
  return (
    <div className={s.page}>
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <div className={s.notice} role="note">
        {copy.demo.tag} · {copy.demo.banner}
      </div>
      <header className={s.nav}>
        <Link href="/" className={s.brand} aria-label={`${copy.brand.product} home`}>
          <AtlasMark size={30} />
          <span>{copy.brand.product}</span>
        </Link>
        <nav aria-label="Sections" className={s.navLinks}>
          <a href="#how">How it works</a>
          <a href="#product">Product</a>
          <a href="#control">Control</a>
          <a href="#status">What’s real</a>
        </nav>
        <LinkButton href="/app/" variant="ink" size="sm">
          {landing.ctaPrimary}
        </LinkButton>
      </header>

      <main id="content">
        <section className={s.hero}>
          <div className={s.heroCopy}>
            <span className="eyebrow">{landing.eyebrow}</span>
            <h1 className={s.h1}>{landing.title}</h1>
            <p className={s.lead}>{landing.lead}</p>
            <div className={s.ctas}>
              <LinkButton href="/app/" variant="primary" size="lg" icon={<ArrowRight size={16} />}>
                {landing.ctaPrimary}
              </LinkButton>
              <LinkButton href="/app/showcase/" variant="secondary" size="lg">
                {landing.ctaTour}
              </LinkButton>
            </div>
            <p className={s.fine}>{copy.demo.startHint}</p>
          </div>
          <HeroScene />
        </section>

        <section id="how" className={s.section} aria-labelledby="how-h">
          <h2 id="how-h" className={s.h2}>
            {landing.howTitle}
          </h2>
          <ol className={s.pillars}>
            {PILLARS.map((p, i) => (
              <li key={p.title} className={s.pillar}>
                <span className={s.num}>0{i + 1}</span>
                <p.icon size={22} aria-hidden />
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="product" className={s.section} aria-labelledby="product-h">
          <h2 id="product-h" className={s.h2}>
            {landing.productTitle}
          </h2>
          <figure className={s.product}>
            {/* Real capture of the demo (scripts: e2e/capture-landing.mjs). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/landing/product-evidence.png")} alt={landing.productAlt} width={1440} height={900} loading="lazy" className={s.productShot} />
            <figcaption className={s.productSteps}>
              {landing.productSteps.map((st, i) => (
                <div key={st.title} className={s.productStep}>
                  <span className={s.num}>0{i + 1}</span>
                  <h3>{st.title}</h3>
                  <p>{st.body}</p>
                </div>
              ))}
            </figcaption>
          </figure>
        </section>

        <section id="control" className={s.section} aria-labelledby="control-h">
          <h2 id="control-h" className={s.h2}>
            {landing.controlTitle}
          </h2>
          <div className={s.pillars}>
            {CONTROL.map((c) => (
              <div key={c.title} className={s.pillar}>
                <c.icon size={22} aria-hidden />
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="status" className={s.section} aria-labelledby="status-h">
          <h2 id="status-h" className={s.h2}>
            {landing.statusTitle}
          </h2>
          <div className={s.status}>
            {landing.status.map((row) => (
              <div key={row.item} className={s.statusRow}>
                <span>{row.item}</span>
                <span>
                  <ModeBadge mode={row.mode} />
                </span>
                <span className={s.statusNote}>{row.note}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <span>
          {copy.brand.product} · {copy.brand.agency} demo · {copy.disclaimers.demoData}
        </span>
        <span>No real customers, testimonials or metrics are shown.</span>
      </footer>
    </div>
  );
}
