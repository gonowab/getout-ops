"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="E-post" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus className="h-9" />
      </Field>
      <Field label="Lösenord" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-9" />
      </Field>
      {state && !state.ok ? (
        <p role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="h-9" disabled={pending}>
        {pending ? "Loggar in…" : "Logga in"}
      </Button>
    </form>
  );
}
