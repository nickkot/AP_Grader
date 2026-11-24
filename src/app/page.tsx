import { redirect } from "next/navigation";

import { getTeacher } from "@/lib/session";

export default async function Home() {
  const teacher = await getTeacher();
  redirect(teacher ? "/classes" : "/sign-in");
}
