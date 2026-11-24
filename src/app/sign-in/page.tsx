import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import { googleSignInEnabled } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const params = await props.searchParams;
  // Only same-site paths: "//host" would send the browser to another site.
  const next = typeof params.next === "string" && /^\/(?!\/)/.test(params.next) ? params.next : "/classes";
  const signedIn = await getSessionUser();
  if (signedIn) redirect(signedIn.kind === "student" && next === "/classes" ? "/practice" : next);

  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-16 sm:pt-28">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-low sm:p-8">
        <p className="text-base font-bold text-primary">{APP_NAME}</p>
        <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-base text-muted-foreground">Use your school Google account.</p>
        <div className="mt-6">
          <SignInForm google={googleSignInEnabled()} devLogin={env().ENABLE_DEV_LOGIN} next={next} />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Student essays stay private to your account. They are never used to train AI models.
        </p>
      </div>
    </main>
  );
}
