"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceRole } from "@atlas/contracts";
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
import { readPref } from "@/lib/state/prefs";
import { Button, Card, ErrorState, IconButton, Sheet, cx } from "@/components/ui";
import { EvidencePanel } from "@/features/evidence/EvidencePanel";
import { CanvasPanel } from "@/features/artifacts/CanvasPanel";
import { RunPanel } from "@/features/runs/RunPanel";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { PreviewControls } from "./PreviewControls";
import { DemoBar } from "./DemoBar";
import { AtlasMark } from "./AtlasMark";
import s from "./shell.module.css";

/** Session boundary: the shell only renders once a session exists, so nobody sees a half-built app. */
function SessionBoundary({ children }: { children: ReactNode }) {
  const session = useSession();
  const start = useStartDemo();
  const unauthenticated = session.isError && isApiError(session.error) && session.error.code === "UNAUTHENTICATED";
  // FIXTURE preview: one door. Entering /app creates the demo workspace with the role this tab last used.
  const autoStart = DATA_MODE === "fixture" && unauthenticated && start.isIdle;
  const started = useRef(false);
  const { mutate } = start;
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    mutate((readPref("session", "demoRole") as WorkspaceRole | null) ?? undefined);
  }, [autoStart, mutate]);

  if (session.data) return <>{children}</>;
  if (session.isError && !unauthenticated) {
    return (
      <div className={s.gate}>
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (session.isPending || (DATA_MODE === "fixture" && !start.isError)) {
    return (
      <div className={s.gate} aria-busy="true">
        <div className={s.gateLoading}>
          <AtlasMark size={40} />
          <p>{copy.demo.starting}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={s.gate}>
      <Card className={s.gateCard}>
        <AtlasMark size={40} />
        <h1 className={s.gateTitle}>{copy.states.authTitle}</h1>
        <p className={s.gateBody}>{copy.states.authBody}</p>
        <div className={s.gateActions}>
          <Button variant="primary" loading={start.isPending} onClick={() => start.mutate(undefined)}>
            {copy.demo.start}
          </Button>
        </div>
        <p className={s.gateHint}>{copy.demo.startHint}</p>
        {start.isError ? <p role="alert" className={s.gateError}>{(start.error as Error).message}</p> : null}
      </Card>
    </div>
  );
}

function PanelContent() {
  const { panel } = usePanel();
  if (!panel) return null;
  if (panel.kind === "evidence") return <EvidencePanel state={panel} />;
  if (panel.kind === "canvas") return <CanvasPanel artifactId={panel.artifactId} />;
  return <RunPanel runId={panel.runId} />;
}

const PANEL_TITLE = { evidence: "Evidence", canvas: "Deliverable", run: "Run trace" } as const;

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

  // The mobile navigation sheet closes on route change (panels are keyed to the path in PanelProvider).
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setMobileNav(false);
  }

  const rail = belowDesktop || collapsed;
  return (
    <div className={cx(s.shell, rail && s.shellCollapsed)}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <DemoBar onPreview={() => setPreview(true)} />
      {!mobile ? <Sidebar rail={rail} onToggle={belowDesktop ? undefined : () => setCollapsed((c) => !c)} onExpand={() => setMobileNav(true)} /> : null}
      <div className={s.mainCol}>
        <Topbar onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} />
        <main id="main" className={s.main} tabIndex={-1}>
          {children}
        </main>
      </div>
      <RightPanel asSheet={belowDesktop} />
      <Sheet open={mobileNav} onClose={() => setMobileNav(false)} side="left" label="Navigation">
        <Sidebar rail={false} variant="sheet" onNavigate={() => setMobileNav(false)} />
      </Sheet>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {DATA_MODE === "fixture" ? <PreviewControls open={preview} onClose={() => setPreview(false)} /> : null}
    </div>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <SessionBoundary>
      <PanelProvider>
        <ShellInner>{children}</ShellInner>
      </PanelProvider>
    </SessionBoundary>
  );
}

/** Standard page container inside the shell. */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={cx(s.page, wide && s.pageWide)}>{children}</div>;
}
