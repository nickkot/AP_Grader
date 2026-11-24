import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";

export default async function Home() {
  const u = await getSessionUser();
  redirect(!u ? "/sign-in" : u.kind === "student" ? "/practice" : "/classes");
}
