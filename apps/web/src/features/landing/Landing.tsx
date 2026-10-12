"use client";
import Link from "next/link";
import { ArrowRight, BarChart3, Bot, FileCheck2, Quote, ShieldCheck, Workflow } from "lucide-react";
import { AGENT_PROFILES } from "@atlas/domain";
import { copy } from "@/copy/en";
import { landing } from "@/copy/landing";
import { AtlasMark } from "@/components/shell/AtlasMark";
import { AgentGlyph, LinkButton, ModeBadge } from "@/components/ui";
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
          <a href="#agents">Agents</a>
          <a href="#control">Control</a>
          <a href="#status">Status</a>
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

        <section id="agents" className={s.section} aria-labelledby="agents-h">
          <h2 id="agents-h" className={s.h2}>
            {landing.agentsTitle}
          </h2>
          <p className={s.sectionLead}>{landing.agentsLead}</p>
          <ul className={s.agents}>
            {AGENT_PROFILES.map((a) => (
              <li key={a.slug} className={s.agent}>
                <AgentGlyph profile={a.profile} size={36} />
                <div>
                  <h3>{a.name}</h3>
                  <p>{a.config.description}</p>
                  <span className={s.tools}>{a.config.allowedTools.length} allowed tools · {a.guardrails.at(-1)}</span>
                </div>
              </li>
            ))}
          </ul>
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
