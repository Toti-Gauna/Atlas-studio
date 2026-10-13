"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, EmptyState, ErrorState, LoadingBlock, TextField } from "@/components/ui";
import { libraryCopy as L } from "@/copy/library";
import s from "./library.module.css";

/** Search over the text of documents you can access. Results only appear after an explicit submit. */
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
    <section aria-label={L.search.label} className={s.search}>
      <form role="search" onSubmit={submit} className={s.searchForm}>
        <div className={s.searchField}>
          <TextField label={L.search.label} type="search" placeholder={L.search.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
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
            <h3 className={s.hitsTitle}>{L.search.count(q.data.length, query)}</h3>
            <ol className={s.hitList}>
              {q.data.map((h) => (
                <li key={h.chunkId} className={s.hit}>
                  <div className={s.hitHead}>
                    <Link href={`/app/document/?id=${h.documentId}&v=${h.version}`} className={s.docLink}>
                      {h.documentTitle}
                    </Link>
                    <span className={s.hitMeta}>
                      v{h.version}
                      {h.page ? ` · ${L.search.page}${h.page}` : ""}
                    </span>
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
