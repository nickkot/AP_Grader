import Link from "next/link";

import { StudentNav } from "@/components/student-nav";
import { UserMenu } from "@/components/user-menu";
import { APP_NAME } from "@/lib/brand";
import { requireStudent } from "@/lib/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = await requireStudent();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-4 sm:gap-6 sm:px-8">
          <Link href="/practice" className="font-bold">
            {APP_NAME}
          </Link>
          <StudentNav />
          <div className="ml-auto">
            <UserMenu name={student.name} email={student.email} />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
