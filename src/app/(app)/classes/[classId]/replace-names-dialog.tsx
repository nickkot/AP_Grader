"use client";

import { useState, useTransition } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/input";
import { numberKey, replaceNamesWithNumbers } from "@/lib/actions/classes";

type KeyRow = { id: string; number: number; firstName: string; lastName: string; removed: boolean };

function csvCell(value: string | number) {
  const s = String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadKey(className: string, rows: KeyRow[]) {
  const lines = [["Number", "Last name", "First name", "On roster"], ...rows.map((r) => [r.number, r.lastName, r.firstName, r.removed ? "Removed" : "Yes"])];
  const csv = lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${className} number key.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Replace every name in a class with a number. The teacher downloads the key first:
 * once names are replaced, the key is the only record of who is who.
 */
export function ReplaceNamesDialog({ classId, className, studentCount }: { classId: string; className: string; studentCount: number }) {
  const [open, setOpen] = useState(false);
  const [keyRows, setKeyRows] = useState<KeyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setKeyRows(null);
      setError(null);
    }
  }

  function getKey() {
    setError(null);
    start(async () => {
      const result = await numberKey(classId);
      if ("error" in result) return setError(result.error ?? null);
      setKeyRows([...result.rows]);
      downloadKey(className, [...result.rows]);
    });
  }

  function replace() {
    if (!keyRows) return;
    setError(null);
    start(async () => {
      const result = await replaceNamesWithNumbers(
        classId,
        keyRows.map((r) => r.id),
      );
      if ("error" in result) {
        setKeyRows(null);
        return setError(result.error ?? null);
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Replace names with numbers
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace names with numbers</DialogTitle>
          <DialogDescription>
            Each student becomes Student 1, Student 2 and so on. The names are deleted from this app for good.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-base">
          <li>Download the key. It is the only record of which number is which student.</li>
          <li>Keep it outside this app, with your gradebook.</li>
          <li>Print new packets. They show numbers, not names.</li>
        </ol>
        <p className="text-sm text-muted-foreground">Photos you already uploaded still show the names printed on those sheets.</p>
        {error && <FieldError>{error}</FieldError>}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={getKey} disabled={pending}>
            <DownloadIcon aria-hidden />
            {keyRows ? "Download the key again" : "Download the key"}
          </Button>
          <Button variant="destructive" onClick={replace} disabled={pending || !keyRows}>
            Replace {studentCount} {studentCount === 1 ? "name" : "names"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
