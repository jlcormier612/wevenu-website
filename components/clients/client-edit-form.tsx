"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateClientInfoAction } from "@/app/(app)/clients/[id]/actions";
import { ClientFormFields } from "@/components/clients/client-form";
import { createInitialClientInput } from "@/lib/clients/constants";
import type { Client, ClientErrors, ClientInput } from "@/lib/clients/types";

export function ClientEditForm({ client }: { client: Client }) {
  const router = useRouter();
  const [input, setInput] = React.useState<ClientInput>(() => createInitialClientInput(client));
  const [errors, setErrors] = React.useState<ClientErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => {
    setInput((p) => ({ ...p, [key]: value }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateClientInfoAction(client.id, input);
      if (result.ok) {
        toast.success("Client updated.");
        router.push(`/clients/${client.id}`);
        router.refresh();
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <ClientFormFields
      input={input} errors={errors} set={set}
      onSubmit={handleSubmit} pending={pending}
      submitLabel="Save changes"
    />
  );
}
