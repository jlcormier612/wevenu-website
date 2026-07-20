/**
 * Remounts on client navigations so every page enter uses the same fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="marketing-page-enter">{children}</div>;
}
