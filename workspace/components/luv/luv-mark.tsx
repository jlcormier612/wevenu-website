/** Subtle Luv mark — dusty rose heart, not a chat bubble. */
export function LuvMark({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ color: "var(--dusty-rose)", fill: "var(--dusty-rose)" }}
    >
      <path d="M12 21s-6.7-4.35-9.33-7.6C.8 11.2.5 8.4 2.1 6.6 3.5 5 5.8 4.7 7.5 6c.6.45 1.1 1 1.5 1.65.4-.65.9-1.2 1.5-1.65 1.7-1.3 4-1 5.4.6 1.6 1.8 1.3 4.6-.57 6.8C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}
