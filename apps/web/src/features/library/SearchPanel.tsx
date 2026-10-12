"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Button, EmptyState, ErrorState, LoadingBlock, TextField } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

/** Full-text search over indexed chunks. Results only appear after an explicit submit. */
export function SearchPanel({ projectId }: { projectId?: string }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const q = useQuery({
    queryKey: ["doc-search", query, projectId ?? null],
    queryFn: () => api.documents.search(query, projectId),
    enabled: query.length > 0,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(text.trim());
  };
  const clear = () => {
    setText("");
    setQuery("");
  };
  return (
    <section aria-labelledby="doc-search-h" className={s.search}>
      <h2 id="doc-search-h" className="sr-only">
        {L.search.label}
      </h2>
      <form role="search" onSubmit={submit} className={s.searchForm}>
        <div className={s.searchField}>
          <TextField label={L.search.label} hideLabel type="search" placeholder={L.search.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button type="submit" variant="ink" icon={<Search size={14} />} disabled={!text.trim()}>
          {L.search.submit}
        </Button>
        {query ? (
          <Button variant="ghost" icon={<X size={14} />} onClick={clear}>
            {L.search.clear}
          </Button>
        ) : null}
      </form>
      <div aria-live="polite">
        {!query ? null : q.isPending ? (
          <LoadingBlock rows={2} />
        ) : q.isError ? (
          <ErrorState error={q.error} compact onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState title={L.search.none(query)} body={L.search.noneBody} />
        ) : (
          <div className={s.hits}>
            <div className={s.hitsHead}>
              <h3 className={s.hitsTitle}>{L.search.count(q.data.length, query)}</h3>
              <span className={s.subtle}>{L.search.method}</span>
            </div>
            <ol className={s.hitList}>
              {q.data.map((h) => (
                <li key={h.chunkId} className={s.hit}>
                  <div className={s.hitHead}>
                    <Link href={`/app/document/?id=${h.documentId}&v=${h.version}`} className={s.docLink}>
                      {h.documentTitle}
                    </Link>
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
                      v{h.version}
                      {h.page ? ` · ${L.search.page}${h.page}` : ""}
                    </span>
                    <Badge mono title={L.search.coverageHint}>
                      {L.search.coverage} {h.score.toFixed(2)}
                    </Badge>
                  </div>
                  <p className={s.snippet}>{h.snippet}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
