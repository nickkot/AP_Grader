import type { Metadata } from "next";

import { JoinForm } from "@/app/join/join-form";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { googleSignInEnabled } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import { normalizeJoinCode } from "@/lib/join";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join your class" };

export default async function JoinPage(props: PageProps<"/join">) {
  const params = await props.searchParams;
  const code = typeof params.code === "string" ? normalizeJoinCode(params.code).slice(0, 6) : "";
  const me = await getSessionUser();

  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-16 sm:pt-28">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-low sm:p-8">
        <p className="text-base font-bold text-primary">{APP_NAME}</p>
        <h1 className="mt-2 text-2xl font-bold">Join your class</h1>
        {me ? (
          <div className="mt-6">
            <JoinForm initialCode={code} />
          </div>
        ) : (
          <>
            <p className="mt-2 text-base text-muted-foreground">Sign in with your school Google account. Then enter the class code from your teacher.</p>
            <div className="mt-6">
              <SignInForm google={googleSignInEnabled()} devLogin={env().ENABLE_DEV_LOGIN} next={code ? `/join?code=${code}` : "/join"} />
            </div>
          </>
        )}
        <p className="mt-8 text-sm text-muted-foreground">
          Your teacher can see the practice essays you write after you join. Your essays are never used to train AI models.
        </p>
      </div>
    </main>
  );
}
