import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/brand/wordmark";
import { ClientLoginForm } from "@/app/client/login/login-form";

export const metadata: Metadata = { title: "Sign In — Wevenu" };

export default function ClientLoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center"><Wordmark /></div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your planning workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientLoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
