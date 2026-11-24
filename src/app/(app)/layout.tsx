import Link from "next/link";

import { UserMenu } from "@/components/user-menu";
import { APP_NAME } from "@/lib/brand";
import { requireTeacher } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const teacher = await requireTeacher();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-6 px-4">
          <Link href="/classes" className="text-sm font-semibold">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/classes" className="text-muted-foreground hover:text-foreground">
              Classes
            </Link>
          </nav>
          <div className="ml-auto">
            <UserMenu name={teacher.name} email={teacher.email} />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
