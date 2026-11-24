"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { joinClass, type JoinState } from "@/lib/actions/join";

export function JoinForm({ initialCode }: { initialCode: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinClass, { step: "code" });

  if (state?.step === "claim") {
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={state.code} />
        <p className="text-base">
          You are joining <span className="font-bold">{state.className}</span>.
        </p>
        {state.rosterKind === "numbers" ? (
          <Field>
            <Label htmlFor="number">Your student number</Label>
            <Input id="number" name="number" type="number" inputMode="numeric" min={1} max={500} required className="w-32" autoFocus />
            <FieldHint>Your teacher gave you this number.</FieldHint>
          </Field>
        ) : (
          <>
            <Field>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={80} autoFocus />
            </Field>
            <Field>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" autoComplete="family-name" maxLength={80} />
              <FieldHint>Spell your name the way your teacher has it on the class list.</FieldHint>
            </Field>
          </>
        )}
        {state.error && <FieldError>{state.error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Joining" : "Join class"}
          </Button>
          <a href="/join" className="text-sm font-bold text-primary underline-offset-4 hover:underline">
            Use a different code
          </a>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="code">Class code</Label>
        <Input
          id="code"
          name="code"
          defaultValue={initialCode}
          required
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-40 font-mono tracking-widest uppercase"
          autoFocus
        />
        <FieldHint>Six letters and numbers, from your teacher.</FieldHint>
      </Field>
      {state?.error && <FieldError>{state.error}</FieldError>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Checking" : "Find my class"}
        </Button>
      </div>
    </form>
  );
}
