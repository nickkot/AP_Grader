"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, Label, Textarea } from "@/components/ui/input";
import { addStudents } from "@/lib/actions/classes";

export function AddStudentsDialog({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof addStudents>>, form: FormData) => {
    const result = await addStudents(classId, prev, form);
    if (result && !result.fieldErrors && !result.error) setOpen(false);
    return result;
  }, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add students
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add students</DialogTitle>
          <DialogDescription>One student per line, as First Last or Last, First.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="roster" className="sr-only">
              Students
            </Label>
            <Textarea id="roster" name="roster" rows={8} required />
            {state?.fieldErrors?.roster && <FieldError>{state.fieldErrors.roster}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Add students
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
