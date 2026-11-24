"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { createClass } from "@/lib/actions/classes";

export function NewClassForm() {
  const [state, action, pending] = useActionState(createClass, undefined);
  const [rosterKind, setRosterKind] = useState<"names" | "numbers">("names");
  const err = state?.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6 rounded-card border border-border bg-surface p-4 shadow-low sm:p-6">
      <Field>
        <Label htmlFor="course">Course</Label>
        <NativeSelect id="course" name="course" defaultValue="APUSH">
          <option value="APUSH">AP U.S. History</option>
          <option value="AP_LANG">AP English Language</option>
        </NativeSelect>
      </Field>
      <Field>
        <Label htmlFor="name">Class name</Label>
        <Input id="name" name="name" placeholder="Period 3" aria-invalid={!!err.name} required maxLength={60} />
        {err.name && <FieldError>{err.name}</FieldError>}
      </Field>
      <Field>
        <Label htmlFor="rosterKind">List students by</Label>
        <NativeSelect
          id="rosterKind"
          name="rosterKind"
          value={rosterKind}
          onChange={(e) => setRosterKind(e.target.value === "numbers" ? "numbers" : "names")}
        >
          <option value="names">Name</option>
          <option value="numbers">Number, with no names stored</option>
        </NativeSelect>
      </Field>
      {rosterKind === "names" ? (
        <Field>
          <Label htmlFor="roster">Roster</Label>
          <Textarea
            id="roster"
            name="roster"
            rows={10}
            placeholder={"Maya Chen\nRivera, Daniel\n..."}
            aria-invalid={!!err.roster}
          />
          <FieldHint>One student per line, as First Last or Last, First. You can add students later.</FieldHint>
          {err.roster && <FieldError>{err.roster}</FieldError>}
        </Field>
      ) : (
        <Field>
          <Label htmlFor="studentCount">Number of students</Label>
          <Input
            id="studentCount"
            name="studentCount"
            type="number"
            min={1}
            max={200}
            defaultValue={30}
            required
            className="w-32"
            aria-invalid={!!err.studentCount}
          />
          <FieldHint>
            Students are listed as Student 1, Student 2 and so on. Packets print the number, not a name. Keep your own list of who
            has which number.
          </FieldHint>
          {err.studentCount && <FieldError>{err.studentCount}</FieldError>}
        </Field>
      )}
      {state?.error && <FieldError>{state.error}</FieldError>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating class" : "Create class"}
        </Button>
      </div>
    </form>
  );
}
