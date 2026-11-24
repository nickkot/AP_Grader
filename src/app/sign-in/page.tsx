import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import { googleSignInEnabled } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import { getTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/sign-in">) {
  if (await getTeacher()) redirect("/classes");
  const params = await props.searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/classes";

  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-24 sm:pt-32">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold text-muted-foreground">{APP_NAME}</p>
        <h1 className="mt-1 text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your school Google account.</p>
        <div className="mt-6">
          <SignInForm google={googleSignInEnabled()} devLogin={env().ENABLE_DEV_LOGIN} next={next} />
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Student essays stay private to your account. They are never used to train AI models.
        </p>
      </div>
    </main>
  );
}
