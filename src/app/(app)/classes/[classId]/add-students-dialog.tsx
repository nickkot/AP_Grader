"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { addStudents } from "@/lib/actions/classes";

export function AddStudentsDialog({
  classId,
  primary = false,
  nextNumber = null,
}: {
  classId: string;
  primary?: boolean;
  /** Set in a numbered class: the number the first new student gets. */
  nextNumber?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof addStudents>>, form: FormData) => {
    const result = await addStudents(classId, prev, form);
    if (result && !result.fieldErrors && !result.error) setOpen(false);
    return result;
  }, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={primary ? "default" : "outline"} size={primary ? "default" : "sm"}>
          Add students
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add students</DialogTitle>
          <DialogDescription>
            {nextNumber === null
              ? "One student per line, as First Last or Last, First."
              : `Students in this class are listed by number. New students start at Student ${nextNumber}.`}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          {nextNumber === null ? (
            <Field>
              <Label htmlFor="roster" className="sr-only">
                Students
              </Label>
              <Textarea id="roster" name="roster" rows={8} required />
              {state?.fieldErrors?.roster && <FieldError>{state.fieldErrors.roster}</FieldError>}
            </Field>
          ) : (
            <Field>
              <Label htmlFor="count">Number of students to add</Label>
              <Input id="count" name="count" type="number" min={1} max={200} defaultValue={1} required className="w-32" />
              {state?.fieldErrors?.count && <FieldError>{state.fieldErrors.count}</FieldError>}
            </Field>
          )}
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
