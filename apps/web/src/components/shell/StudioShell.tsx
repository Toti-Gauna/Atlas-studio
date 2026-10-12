"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { copy } from "@/copy/en";
import { DATA_MODE } from "@/lib/config";
import { BP, useMediaQuery } from "@/lib/useMediaQuery";
import { gsap, MOTION, useReducedMotion } from "@/lib/motion";
import { isApiError } from "@/lib/api";
import { PanelProvider, usePanel } from "@/lib/state/panel";
import { useSession, useStartDemo } from "@/lib/state/session";
import { Button, Card, ErrorState, IconButton, LoadingBlock, Sheet, cx } from "@/components/ui";
import { EvidencePanel } from "@/features/evidence/EvidencePanel";
import { CanvasPanel } from "@/features/artifacts/CanvasPanel";
import { RunPanel } from "@/features/runs/RunPanel";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { PreviewControls } from "./PreviewControls";
import { AtlasMark } from "./AtlasMark";
import s from "./shell.module.css";

function DemoBanner({ onPreview }: { onPreview: () => void }) {
  return (
    <div className={s.banner} role="note">
      <span className={s.bannerDot} aria-hidden />
      <span className={s.bannerStrong}>{copy.demo.banner}</span>
      <span className={s.bannerDetail}>· {DATA_MODE === "fixture" ? copy.demo.previewTransport : copy.demo.apiTransport}</span>
      {DATA_MODE === "fixture" ? (
        <button type="button" className={s.bannerBtn} onClick={onPreview}>
          Preview states
        </button>
      ) : null}
    </div>
  );
}

function SessionGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const start = useStartDemo();
  if (session.isPending) {
    return (
      <div className={s.page}>
        <LoadingBlock rows={4} />
      </div>
    );
  }
  if (session.isError && !(isApiError(session.error) && session.error.code === "UNAUTHENTICATED")) {
    return (
      <div className={s.page}>
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) {
    return (
      <div className={s.gate}>
        <Card className={s.gateCard}>
          <AtlasMark size={40} />
          <h1 style={{ fontSize: 24, marginTop: 16 }}>{copy.states.authTitle}</h1>
          <p style={{ color: "var(--text-2)", marginTop: 8 }}>{copy.states.authBody}</p>
          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" loading={start.isPending} onClick={() => start.mutate(undefined)}>
              {copy.demo.start}
            </Button>
          </div>
          <p style={{ color: "var(--text-3)", fontSize: 13, marginTop: 12 }}>{copy.demo.startHint}</p>
          {start.isError ? <p role="alert" style={{ color: "var(--danger)", marginTop: 8 }}>{(start.error as Error).message}</p> : null}
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

function PanelContent() {
  const { panel } = usePanel();
  if (!panel) return null;
  if (panel.kind === "evidence") return <EvidencePanel state={panel} />;
  if (panel.kind === "canvas") return <CanvasPanel artifactId={panel.artifactId} />;
  return <RunPanel runId={panel.runId} />;
}

const PANEL_TITLE = { evidence: "Evidence", canvas: "Canvas", run: "Run trace" } as const;

function RightPanel({ asSheet }: { asSheet: boolean }) {
  const { panel, close } = usePanel();
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (!panel || reduced || asSheet || !ref.current) return;
      gsap.fromTo(ref.current, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: MOTION.drawer, ease: MOTION.ease, clearProps: "transform,opacity" });
    },
    { dependencies: [panel?.kind, asSheet], scope: ref },
  );
  if (!panel) return null;
  const head = (
    <div className={s.panelHead}>
      <span className={s.panelTitle}>{PANEL_TITLE[panel.kind]}</span>
      <IconButton label="Close panel" size="sm" onClick={close} style={{ marginLeft: "auto" }}>
        <X size={16} />
      </IconButton>
    </div>
  );
  if (asSheet) {
    return (
      <Sheet open onClose={close} label={PANEL_TITLE[panel.kind]}>
        {head}
        <div className={s.panelBody}>
          <PanelContent />
        </div>
      </Sheet>
    );
  }
  return (
    <aside ref={ref} className={cx(s.panel, panel.kind === "canvas" && s.panelWide)} aria-label={PANEL_TITLE[panel.kind]}>
      {head}
      <div className={s.panelBody}>
        <PanelContent />
      </div>
    </aside>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const belowDesktop = useMediaQuery(BP.belowDesktop);
  const mobile = useMediaQuery(BP.mobile);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [preview, setPreview] = useState(false);
  const pathname = usePathname();
  const { close } = usePanel();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Panels belong to a page; navigating away closes them.
  useEffect(() => {
    close();
    setMobileNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const rail = belowDesktop || collapsed;
  return (
    <div className={cx(s.shell, rail && s.shellCollapsed)}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <DemoBanner onPreview={() => setPreview(true)} />
      {!mobile ? <Sidebar rail={rail} onToggle={belowDesktop ? undefined : () => setCollapsed((c) => !c)} /> : null}
      <div className={s.mainCol}>
        <Topbar onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} onPreview={() => setPreview(true)} />
        <main id="main" className={s.main} tabIndex={-1}>
          <SessionGate>{children}</SessionGate>
        </main>
      </div>
      <RightPanel asSheet={belowDesktop} />
      <Sheet open={mobileNav} onClose={() => setMobileNav(false)} side="left" label="Navigation">
        <Sidebar rail={false} onNavigate={() => setMobileNav(false)} />
      </Sheet>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {DATA_MODE === "fixture" ? <PreviewControls open={preview} onClose={() => setPreview(false)} /> : null}
    </div>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <PanelProvider>
      <ShellInner>{children}</ShellInner>
    </PanelProvider>
  );
}

/** Standard page container inside the shell. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={cx(s.page, wide && s.pageWide)}>{children}</div>;
}
