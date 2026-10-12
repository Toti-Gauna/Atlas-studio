/**
 * Local retrieval + extractive responder (no generative model).
 *
 * - Chunks are produced per page so every citation carries page + version.
 * - Search is BM25 over chunks the caller is already authorized to read
 *   (authorization filtering happens BEFORE scoring, in the caller).
 * - The responder only quotes sentences from retrieved chunks. When the best
 *   score is below threshold or no sentence covers the query, it abstains.
 * - Document text is data, never instructions: sentences that look like
 *   instructions to the assistant are excluded from answers.
 */

export interface PageText {
  page: number | null;
  text: string;
}

export interface ChunkInput {
  id: string;
  documentId: string;
  versionId: string;
  version: number;
  documentTitle: string;
  page: number | null;
  text: string;
}

export const STOPWORDS = new Set(
  "a an and are as at be by can do does did for from has have how i if in is it its of on or our should that the their this to was we what when where which who why will with you your about after before into than then there these those under within without per may must not no any all many much long often until get need tell me please us they them take takes taken".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Light, deterministic stemmer (Porter-inspired subset). It only needs to be
 * consistent between queries and documents: "cancelled", "cancelling" and
 * "cancellations" → "cancel"; "late"/"later" → "lat"; "approve"/"approved" → "approv".
 */
export function stem(t: string): string {
  let s = t;
  const tryStrip = (suffix: string, minLen: number): boolean => {
    if (s.length > minLen && s.endsWith(suffix)) {
      s = s.slice(0, -suffix.length);
      return true;
    }
    return false;
  };
  if (tryStrip("ations", 7) || tryStrip("ation", 6) || tryStrip("ions", 6) || tryStrip("ion", 6) || tryStrip("ings", 6) || tryStrip("ing", 5)) {
    // stripped a derivational/progressive suffix
  } else if (s.length > 4 && s.endsWith("ies")) {
    s = `${s.slice(0, -3)}y`;
  } else if (tryStrip("ed", 4) || tryStrip("ers", 5) || tryStrip("er", 4)) {
    // stripped past tense / agentive
  } else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us")) {
    s = s.slice(0, -1);
  }
  if (s.length > 3 && /([bdfglmnprt])\1$/.test(s)) s = s.slice(0, -1);
  if (s.length >= 4 && s.endsWith("e")) s = s.slice(0, -1);
  return s;
}

/** Splits page text into paragraph-sized chunks (≈ maxChars), keeping offsets. */
export function chunkPages(pages: PageText[], maxChars = 700): Array<{ page: number | null; text: string; start: number; end: number }> {
  const out: Array<{ page: number | null; text: string; start: number; end: number }> = [];
  for (const p of pages) {
    const paragraphs = p.text.split(/\n\s*\n/);
    let cursor = 0;
    let buf = "";
    let bufStart = 0;
    for (const para of paragraphs) {
      const idx = p.text.indexOf(para, cursor);
      cursor = idx + para.length;
      if (buf && buf.length + para.length > maxChars) {
        out.push({ page: p.page, text: buf.trim(), start: bufStart, end: bufStart + buf.length });
        buf = "";
      }
      if (!buf) bufStart = idx;
      buf = buf ? `${buf}\n\n${para}` : para;
    }
    if (buf.trim()) out.push({ page: p.page, text: buf.trim(), start: bufStart, end: bufStart + buf.length });
  }
  return out;
}

export interface ScoredChunk {
  chunk: ChunkInput;
  score: number;
  matchedTerms: string[];
  /** IDF-weighted share of query terms present in the chunk (0–1); corpus-size independent. */
  coverage: number;
}

export function bm25Search(query: string, chunks: ChunkInput[], k1 = 1.4, b = 0.75): ScoredChunk[] {
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0 || chunks.length === 0) return [];
  const docs = chunks.map((c) => tokenize(`${c.documentTitle} ${c.text}`));
  const avgLen = docs.reduce((a, d) => a + d.length, 0) / docs.length;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const results: ScoredChunk[] = [];
  const idfOf = (q: string) => Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
  const totalIdf = qTerms.reduce((acc, q) => acc + idfOf(q), 0);
  docs.forEach((d, i) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    let matchedIdf = 0;
    const matched: string[] = [];
    for (const q of qTerms) {
      const f = tf.get(q);
      if (!f) continue;
      matched.push(q);
      const idf = idfOf(q);
      matchedIdf += idf;
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgLen)));
    }
    if (score > 0) results.push({ chunk: chunks[i]!, score, matchedTerms: matched, coverage: totalIdf > 0 ? matchedIdf / totalIdf : 0 });
  });
  return results.sort((a, b2) => b2.score - a.score);
}

const INJECTION_PATTERNS = [
  /ignore (all|any|previous|prior) (instructions|rules)/i,
  /disregard (the|all|previous) (instructions|policy|rules)/i,
  /you are now/i,
  /reveal (the|your) (system prompt|password|api key|secret)/i,
  /grant (me|yourself|the user) (admin|access|permission)/i,
  /act as (an? )?(admin|administrator|developer)/i,
];

export function looksLikeInjection(sentence: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(sentence));
}

function splitSentences(text: string): Array<{ text: string; start: number }> {
  const out: Array<{ text: string; start: number }> = [];
  const re = /[^.!?\n]+(?:[.!?]+|$)/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const trimmed = raw.trim();
    if (trimmed.length < 12) continue;
    out.push({ text: trimmed, start: (m.index ?? 0) + raw.indexOf(trimmed) });
  }
  return out;
}

export interface ExtractiveCitation {
  chunk: ChunkInput;
  quote: string;
  quoteStart: number;
  quoteEnd: number;
  score: number;
}

export interface ExtractiveAnswer {
  decision: "answered" | "abstained";
  answer: string;
  citations: ExtractiveCitation[];
  topScore: number | null;
  threshold: number;
  candidates: number;
  abstentionReason: string | null;
  excludedInjections: number;
}

/** Minimum IDF-weighted query coverage of the best chunk to answer instead of abstaining. */
export const DEFAULT_THRESHOLD = 0.6;

/**
 * Builds an answer exclusively from quoted sentences. No paraphrase, no
 * generated claims. Abstains when evidence is weak.
 */
export function extractiveAnswer(query: string, authorizedChunks: ChunkInput[], opts: { threshold?: number; maxQuotes?: number } = {}): ExtractiveAnswer {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const maxQuotes = opts.maxQuotes ?? 2;
  const hits = bm25Search(query, authorizedChunks).slice(0, 5);
  const qTerms = new Set(tokenize(query));
  const top = hits.length ? Math.max(...hits.map((h) => h.coverage)) : null;
  let excludedInjections = 0;
  if (!hits.length || top === null || top < threshold) {
    return {
      decision: "abstained",
      answer: "",
      citations: [],
      topScore: top,
      threshold,
      candidates: hits.length,
      abstentionReason: hits.length ? "Best matching passage is below the evidence threshold." : "No authorized document mentions these terms.",
      excludedInjections,
    };
  }
  const picked: ExtractiveCitation[] = [];
  for (const hit of hits) {
    if (hit.coverage < threshold * 0.75) continue;
    const sentences = splitSentences(hit.chunk.text)
      .map((s) => {
        if (looksLikeInjection(s.text)) {
          excludedInjections++;
          return null;
        }
        const terms = new Set(tokenize(s.text));
        let overlap = 0;
        for (const q of qTerms) if (terms.has(q)) overlap++;
        return { ...s, overlap };
      })
      .filter((s): s is { text: string; start: number; overlap: number } => s !== null && s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || a.start - b.start);
    const best = sentences[0];
    if (best && best.overlap / Math.max(1, qTerms.size) >= 0.34) {
      picked.push({ chunk: hit.chunk, quote: best.text, quoteStart: best.start, quoteEnd: best.start + best.text.length, score: hit.score });
    }
    if (picked.length >= maxQuotes) break;
  }
  if (picked.length === 0) {
    return {
      decision: "abstained",
      answer: "",
      citations: [],
      topScore: top,
      threshold,
      candidates: hits.length,
      abstentionReason: "Passages matched some terms, but no sentence directly addresses the question.",
      excludedInjections,
    };
  }
  const answer = picked.map((p, i) => `“${p.quote}” [S${i + 1}]`).join("\n\n");
  return { decision: "answered", answer, citations: picked, topScore: top, threshold, candidates: hits.length, abstentionReason: null, excludedInjections };
}
