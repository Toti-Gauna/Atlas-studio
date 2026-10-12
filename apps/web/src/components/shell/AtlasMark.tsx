/** Atlas mark: an "A" whose crossbar is the evidence line (teal) and a violet artifact node. */
export function AtlasMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="64" height="64" rx="14" fill="var(--ink)" />
      <path d="M16 46 32 16l16 30" fill="none" stroke="#F5F7FA" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 36h20" stroke="#19B6A4" strokeWidth="5" strokeLinecap="round" />
      <circle cx="48" cy="46" r="4" fill="#8278D8" />
    </svg>
  );
}
