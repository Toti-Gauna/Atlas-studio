"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, UserPlus, X } from "lucide-react";
import type { ArtifactDetail, ArtifactShare, ShareRole } from "@atlas/contracts";
import { canOnArtifact } from "@atlas/domain";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { deliverablesCopy as c } from "@/copy/deliverables";
import { Avatar, Badge, Button, Callout, Card, ErrorState, IconButton, LoadingBlock, SectionHead, Select, useToast } from "@/components/ui";
import { keys, useMembers } from "./queries";
import s from "./deliverables.module.css";

const ROLE_TONE: Record<ShareRole, "neutral" | "violet" | "info"> = { viewer: "neutral", editor: "violet", reviewer: "info" };
const ROLE_OPTIONS: Array<{ value: ShareRole; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
];

export function SharingPanel({ detail }: { detail: ArtifactDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canShare = useCan("artifact.share") && canOnArtifact(detail.myRole, "share");
  const shares = useQuery({ queryKey: keys.shares(detail.id), queryFn: () => api.shares.list(detail.id) });
  const members = useMembers(canShare);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.shares(detail.id) });
    void qc.invalidateQueries({ queryKey: keys.artifact(detail.id) });
  };
  const add = useMutation({
    mutationFn: () => api.shares.create({ artifactId: detail.id, userId, role }),
    onSuccess: (sh) => {
      refresh();
      setUserId("");
      toast({ tone: "success", title: c.sharing.added(sh.userName, sh.role) });
    },
    onError: (e) => toast({ tone: "error", title: c.sharing.failed, body: (e as Error).message }),
  });
  const revoke = useMutation({
    mutationFn: (sh: ArtifactShare) => api.shares.remove(sh.id),
    onSuccess: (_v, sh) => {
      refresh();
      toast({ tone: "success", title: c.sharing.revoked(sh.userName) });
    },
    onError: (e) => toast({ tone: "error", title: c.sharing.failed, body: (e as Error).message }),
  });

  const candidates = (members.data ?? []).filter((m) => m.user.id !== detail.ownerId && m.role !== "customer");

  return (
    <Card as="section" aria-labelledby="share-h">
      <SectionHead id="share-h" title={c.sharing.title} />
      <Callout icon={<Lock size={16} aria-hidden />}>{c.sharing.note}</Callout>
      <div className={s.panelBody}>
        {shares.isPending ? (
          <LoadingBlock rows={2} />
        ) : shares.isError ? (
          <ErrorState error={shares.error} compact onRetry={() => void shares.refetch()} />
        ) : shares.data.length === 0 ? (
          <p className={s.muted}>{c.sharing.empty}</p>
        ) : (
          <ul className={s.plainList}>
            {shares.data.map((sh) => (
              <li key={sh.id} className={s.shareRow}>
                <Avatar name={sh.userName} size={26} />
                <span className={s.grow}>{sh.userName}</span>
                <Badge tone={ROLE_TONE[sh.role]}>{sh.role}</Badge>
                {canShare ? (
                  <IconButton label={`${c.sharing.revoke}: ${sh.userName}`} size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(sh)}>
                    <X size={14} />
                  </IconButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canShare ? (
          <form
            className={s.inlineForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (userId) add.mutate();
            }}
          >
            {members.isError ? (
              <ErrorState error={members.error} compact onRetry={() => void members.refetch()} />
            ) : (
              <>
                <Select
                  label={c.sharing.member}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={members.isPending}
                  options={[{ value: "", label: members.isPending ? "Loading members…" : c.sharing.pickMember }, ...candidates.map((m) => ({ value: m.user.id, label: `${m.user.displayName} (${m.role})` }))]}
                />
                <Select label={c.sharing.role} value={role} onChange={(e) => setRole(e.target.value as ShareRole)} options={ROLE_OPTIONS} />
                <Button type="submit" icon={<UserPlus size={14} aria-hidden />} disabled={!userId} loading={add.isPending}>
                  {c.sharing.add}
                </Button>
              </>
            )}
          </form>
        ) : (
          <p className={s.muted}>{c.sharing.ownerOnly}</p>
        )}
      </div>
    </Card>
  );
}
