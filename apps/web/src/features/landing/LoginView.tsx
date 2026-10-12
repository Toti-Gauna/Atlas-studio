"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { copy } from "@/copy/en";
import { useStartDemo } from "@/lib/state/session";
import { AtlasMark } from "@/components/shell/AtlasMark";
import { Button, Callout, Card, TextField } from "@/components/ui";

/**
 * Two doors: an isolated demo workspace (visitors) and owner/staff login.
 * Owner credentials live only in the API server environment.
 */
export function LoginView() {
  const router = useRouter();
  const start = useStartDemo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({ mutationFn: () => api.auth.login(email, password), onSuccess: () => router.push("/app/") });
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, background: "var(--bg)" }}>
      <div style={{ width: "min(440px, 100%)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <AtlasMark size={36} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 750, fontSize: 20 }}>{copy.brand.product}</span>
        </div>
        <Card>
          <h1 style={{ fontSize: 22 }}>Try the demo</h1>
          <p style={{ color: "var(--text-2)", marginTop: 6 }}>{copy.demo.startHint}</p>
          <Button variant="primary" block style={{ marginTop: 16 }} loading={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: () => router.push("/app/") })}>
            {copy.demo.start}
          </Button>
        </Card>
        <Card>
          <h2 style={{ fontSize: 18 }}>Workspace login</h2>
          <form
            style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate();
            }}
          >
            <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            {login.isError ? <Callout tone="warn">{(login.error as Error).message}</Callout> : null}
            <Button type="submit" variant="secondary" loading={login.isPending}>
              Sign in
            </Button>
          </form>
        </Card>
        <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>{copy.disclaimers.demoData}</p>
      </div>
    </main>
  );
}
