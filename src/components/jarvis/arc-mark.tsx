export function ArcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.45" />
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeDasharray="3 7"
      />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M60 18 V28 M60 92 V102 M18 60 H28 M92 60 H102"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="60" cy="60" r="7" fill="currentColor" />
    </svg>
  );
}
