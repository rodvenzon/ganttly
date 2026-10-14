/** The Ganttly wordmark: a small stacked-bars mark and the name. */
export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1D2129" />
        <rect x="7" y="8" width="12" height="4" rx="2" fill="#8CB1BE" />
        <rect x="11" y="14" width="14" height="4" rx="2" fill="#DDE6FF" />
        <rect x="16" y="20" width="9" height="4" rx="2" fill="#EFC9B5" />
      </svg>
      <span className="text-xl font-semibold tracking-tight text-brand-ink">
        Ganttly
      </span>
    </span>
  );
}
