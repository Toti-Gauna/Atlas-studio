"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button, Callout, Modal, Select, TextArea, TextField, useToast } from "@/components/ui";
import { copy } from "@/copy/en";
import { projectsCopy as P } from "@/copy/projects";

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const C = P.create;
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents.list, enabled: open });
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [agentId, setAgentId] = useState("");
  const [touched, setTouched] = useState(false);

  const create = useMutation({
    mutationFn: () => api.projects.create({ name: name.trim(), objective: objective.trim(), defaultAgentId: agentId || null }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ tone: "success", title: C.created, body: p.name });
      setName("");
      setObjective("");
      setAgentId("");
      setTouched(false);
      onClose();
      router.push(`/app/project/?id=${p.id}`);
    },
  });

  const nameError = touched && !name.trim() ? C.nameRequired : isApiError(create.error) && create.error.details?.field === "name" ? create.error.message : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    create.mutate();
  };
  const agentOptions = [
    { value: "", label: agents.isPending ? C.agentsLoading : C.noAgent },
    ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={C.title}
      description={C.description}
      footer={
        <>
          <Button onClick={onClose}>{copy.actions.cancel}</Button>
          <Button type="submit" form="new-project-form" variant="primary" loading={create.isPending}>
            {C.submit}
          </Button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <TextField label={C.name} value={name} maxLength={80} required placeholder={C.namePlaceholder} error={nameError} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextArea label={C.objective} value={objective} maxLength={400} rows={3} hint={`${C.objectiveHint} (${objective.length}/400)`} onChange={(e) => setObjective(e.target.value)} />
        <Select label={C.agent} value={agentId} onChange={(e) => setAgentId(e.target.value)} options={agentOptions} hint={agents.isError ? (agents.error instanceof Error ? agents.error.message : undefined) : undefined} />
        <div aria-live="assertive">
          {create.isError && !nameError ? <Callout tone="danger">{create.error instanceof Error ? create.error.message : copy.states.errorBody}</Callout> : null}
        </div>
      </form>
    </Modal>
  );
}
