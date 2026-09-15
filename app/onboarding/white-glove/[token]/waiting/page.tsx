export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function WhiteGloveWaitingPage({ params }: PageProps) {
  await params;
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <h1 className="font-heading text-3xl font-medium tracking-tight">
        We&apos;re getting your venue ready
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        We&apos;ve received your information. We&apos;ll use it to build your Hello to Cheers
        workspace.
      </p>
      <h2 className="mt-8 text-lg font-medium">You don&apos;t need to do anything right now.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        We&apos;ll let you know if we need a decision from you.
      </p>
    </main>
  );
}
