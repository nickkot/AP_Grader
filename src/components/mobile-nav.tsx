"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { SidebarNav, type NavCourse } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent, SheetTitle } from "@/components/ui/dialog";

export function MobileNav({ courses }: { courses: NavCourse[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </DialogTrigger>
      <SheetContent className="right-auto left-0 max-w-xs border-r border-l-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SidebarNav courses={courses} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Dialog>
  );
}
