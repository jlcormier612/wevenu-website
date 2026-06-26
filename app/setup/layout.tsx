import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Wordmark } from "@/components/brand/wordmark";

/**
 * Visual shell for the Venue Setup experience: a calm, full-height, centered
 * canvas with the brand mark — no workspace navigation, since the workspace
 * does not exist until the venue does.
 */
export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-8">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 pb-16">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
