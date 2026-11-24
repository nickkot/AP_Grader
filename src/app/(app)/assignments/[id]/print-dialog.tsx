"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldHint, Input, Label, NativeSelect } from "@/components/ui/input";

export function PrintDialog({
  assignmentId,
  studentCount,
  defaultPages,
  primary,
}: {
  assignmentId: string;
  studentCount: number;
  defaultPages: number;
  primary: boolean;
}) {
  const [order, setOrder] = useState("alphabetical");
  const [pages, setPages] = useState(defaultPages);
  const [spares, setSpares] = useState(3);
  const [paper, setPaper] = useState("LETTER");
  const [duplex, setDuplex] = useState("0");
  const [more, setMore] = useState(false);

  const params = new URLSearchParams({ order, pages: String(pages), spares: String(spares), paper, duplex });
  const href = `/api/assignments/${assignmentId}/packet?${params}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={primary ? "default" : "outline"}>Print packets</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print packets</DialogTitle>
          <DialogDescription>
            One PDF with the prompt, the documents and {studentCount} sets of answer sheets. Each page has a QR code
            that matches it to the student when you upload photos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label htmlFor="pages">Pages per student</Label>
            <Input id="pages" type="number" min={1} max={8} value={pages} onChange={(e) => setPages(Number(e.target.value) || 1)} />
          </Field>
          <Field>
            <Label htmlFor="spares">Spare sets</Label>
            <Input id="spares" type="number" min={0} max={20} value={spares} onChange={(e) => setSpares(Number(e.target.value) || 0)} />
          </Field>
        </div>
        <FieldHint>Spare sets have a blank name line for absent or new students.</FieldHint>
        {more ? (
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="order">Order</Label>
              <NativeSelect id="order" value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="alphabetical">Alphabetical</option>
                <option value="roster">Roster order</option>
              </NativeSelect>
            </Field>
            <Field>
              <Label htmlFor="paper">Paper</Label>
              <NativeSelect id="paper" value={paper} onChange={(e) => setPaper(e.target.value)}>
                <option value="LETTER">Letter</option>
                <option value="A4">A4</option>
              </NativeSelect>
            </Field>
            <Field>
              <Label htmlFor="duplex">Sides</Label>
              <NativeSelect id="duplex" value={duplex} onChange={(e) => setDuplex(e.target.value)}>
                <option value="0">Single-sided</option>
                <option value="1">Double-sided</option>
              </NativeSelect>
            </Field>
          </div>
        ) : (
          <div>
            <Button variant="link" size="sm" type="button" onClick={() => setMore(true)}>
              More options
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button asChild>
            <a href={href} download>
              Download packet
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
