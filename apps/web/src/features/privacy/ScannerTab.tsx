"use client";
import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { ScanSearch } from "lucide-react";
import type { Finding } from "@atlas/contracts";
import { api } from "@/lib/api";
import { privacyCopy as c } from "@/copy/privacy";
import { Badge, Button, Callout, Card, ErrorState, TextArea } from "@/components/ui";
import { SEVERITY_TONE } from "./tones";
import s from "./privacy.module.css";

const MAX = 50_000;

/** Splits the original text into plain and <mark> segments by finding ranges (text nodes only, no HTML injection). */
function highlight(text: string, findings: Finding[]): ReactNode[] {
  const sorted = [...findings].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((f, i) => {
    const start = Math.max(f.start, cursor);
    const end = Math.min(f.end, text.length);
    if (end <= start) return;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark key={i} className={s[`sev_${f.severity}`]} title={`${f.label} · ${c.severity[f.severity]}`}>
        {text.slice(start, end)}
        <span className="sr-only"> ({f.label})</span>
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function ScannerTab() {
  const [text, setText] = useState("");
  const scan = useMutation({ mutationFn: (t: string) => api.privacy.scan(t) });
  const scanned = scan.variables ?? "";
  const tooLong = text.length > MAX;

  return (
    <div className={s.scanner}>
      <Card>
        <h2 className={s.h2}>{c.scanner.title}</h2>
        <p className={s.muted} style={{ marginBottom: 12 }}>{c.scanner.body}</p>
        <form
          className={s.stack}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !tooLong) scan.mutate(text);
          }}
        >
          <TextArea
            label={c.scanner.field}
            value={text}
            rows={8}
            placeholder={c.scanner.placeholder}
            onChange={(e) => setText(e.target.value)}
            error={tooLong ? c.scanner.tooLong : null}
            hint={`${text.length.toLocaleString("en-US")} / ${MAX.toLocaleString("en-US")}`}
          />
          <div className={s.actions}>
            <Button type="submit" variant="primary" icon={<ScanSearch size={14} aria-hidden />} loading={scan.isPending} disabled={!text.trim() || tooLong}>
              {c.scanner.run}
            </Button>
            <Button variant="ghost" onClick={() => setText(c.scanner.sampleText)}>{c.scanner.sample}</Button>
          </div>
        </form>
      </Card>

      <div aria-live="polite" className={s.stack}>
        {scan.isError ? <ErrorState error={scan.error} compact onRetry={() => scan.mutate(scanned)} /> : null}
        {scan.data ? (
          <>
            <Card>
              <div className={s.reviewHead}>
                <h2 className={s.h2}>{scan.data.findings.length ? c.scanner.found(scan.data.findings.length) : c.scanner.none}</h2>
                <Badge tone="violet">
                  {c.scanner.suggested}: {c.classification[scan.data.suggestedClassification]}
                </Badge>
              </div>
              {scan.data.findings.length ? (
                <ul className={s.findings}>
                  {scan.data.findings.map((f, i) => (
                    <li key={i}>
                      <Badge tone={SEVERITY_TONE[f.severity]}>{c.severity[f.severity]}</Badge> <strong>{f.label}</strong> <span className="mono">{f.preview}</span>
                      <div className={s.muted}>{f.explanation} · chars {f.start}–{f.end}</div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
            <div className={s.twoCol}>
              <Card>
                <h3 className={s.h3}>{c.scanner.highlighted}</h3>
                <pre className={s.textOut}>{highlight(scanned, scan.data.findings)}</pre>
              </Card>
              <Card>
                <h3 className={s.h3}>{c.scanner.redacted}</h3>
                <pre className={s.textOut}>{scan.data.redactedText}</pre>
              </Card>
            </div>
            <Callout tone="warn">
              <strong>{c.scanner.limitations}</strong>
              <ul className={s.limits}>
                {scan.data.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </Callout>
          </>
        ) : null}
      </div>
    </div>
  );
}
