"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ google, devLogin, next }: { google: boolean; devLogin: boolean; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: next });
    if (res.error) {
      setError("Google sign-in did not finish. Try again.");
      setBusy(false);
    }
  }

  async function devSignIn(form: FormData) {
    setBusy(true);
    setError(null);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim() || email.split("@")[0];
    const signIn = await authClient.signIn.email({ email, password });
    const failed = signIn.error ? Boolean((await authClient.signUp.email({ email, password, name })).error) : false;
    if (failed) {
      setError("Sign-in failed. Check the email and password. Passwords need 8 or more characters.");
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {google ? (
        <Button size="lg" onClick={signInWithGoogle} disabled={busy}>
          Sign in with Google
        </Button>
      ) : (
        !devLogin && <p className="text-sm text-status-error">Google sign-in is not set up for this site yet.</p>
      )}

      {devLogin && (
        <form action={devSignIn} className="flex flex-col gap-4 rounded-panel border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground">Development sign-in</p>
          <Field>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" />
          </Field>
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
          </Field>
          <Button type="submit" variant={google ? "outline" : "default"} disabled={busy}>
            Sign in
          </Button>
        </form>
      )}

      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
