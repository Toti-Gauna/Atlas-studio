"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import type { DocumentDetail } from "@atlas/contracts";
import { api } from "@/lib/api";
import { Button, IconButton, Modal, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

/** Admin-only actions behind a "⋯" menu; the server re-checks document.admin. Delete always confirms. */
export function DocumentActions({ doc, onReindexed }: { doc: DocumentDetail; onReindexed: (version: number) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const errBody = (e: unknown) => (e instanceof Error ? e.message : undefined);

  const reindex = useMutation({
    mutationFn: () => api.documents.reindex(doc.id),
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["document", doc.id] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ tone: "success", title: L.detail.reindexed(d.publishedVersion ?? 0) });
      if (d.publishedVersion) onReindexed(d.publishedVersion);
    },
    onError: (e) => toast({ tone: "error", title: L.detail.reindexFailed, body: errBody(e) }),
  });
  const remove = useMutation({
    mutationFn: () => api.documents.remove(doc.id),
    onSuccess: () => {
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      qc.removeQueries({ queryKey: ["document", doc.id] });
      toast({ tone: "success", title: L.detail.deleted, body: doc.title });
      router.push("/app/library/");
    },
    onError: (e) => toast({ tone: "error", title: L.detail.deleteFailed, body: errBody(e) }),
  });

  // Close on outside click; focus the first item when the menu opens.
  useEffect(() => {
    if (!menuOpen) return;
    itemsRef.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const closeMenu = (refocus = true) => {
    setMenuOpen(false);
    if (refocus) wrapRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
  };
  const onMenuKey = (e: KeyboardEvent) => {
    const items = itemsRef.current.filter((x): x is HTMLButtonElement => Boolean(x));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Tab") {
      setMenuOpen(false);
    }
  };

  return (
    <div className={s.menuWrap} ref={wrapRef}>
      <IconButton
        label={L.detail.moreActions}
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "doc-actions-menu" : undefined}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {reindex.isPending ? <span className={s.menuSpinner} aria-hidden /> : <MoreHorizontal size={16} />}
      </IconButton>
      {menuOpen ? (
        <div id="doc-actions-menu" role="menu" aria-label={L.detail.moreActions} className={s.menu} onKeyDown={onMenuKey}>
          <button
            ref={(el) => {
              itemsRef.current[0] = el;
            }}
            type="button"
            role="menuitem"
            className={s.menuItem}
            disabled={reindex.isPending}
            onClick={() => {
              closeMenu();
              reindex.mutate();
            }}
          >
            <RefreshCw size={14} aria-hidden />
            {L.detail.reindex}
          </button>
          <button
            ref={(el) => {
              itemsRef.current[1] = el;
            }}
            type="button"
            role="menuitem"
            className={`${s.menuItem} ${s.menuDanger}`}
            onClick={() => {
              closeMenu(false);
              setConfirmOpen(true);
            }}
          >
            <Trash2 size={14} aria-hidden />
            {L.detail.delete}
          </button>
        </div>
      ) : null}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={L.detail.deleteTitle}
        description={doc.title}
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>{copy.actions.cancel}</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              {L.detail.delete}
            </Button>
          </>
        }
      >
        <p>{L.detail.deleteBody}</p>
      </Modal>
    </div>
  );
}
