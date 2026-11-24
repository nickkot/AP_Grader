"use client";

import { useActionState, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/misc";
import { createAssignment } from "@/lib/actions/assignments";
import type { EssayType } from "@/lib/rubrics";

type TypeOption = {
  value: EssayType;
  label: string;
  defaultTimeLimitMinutes: number;
  defaultAnswerPages: number;
  usesSources: boolean;
};

type Doc = { key: number; citation: string; text: string };

export function AssignmentForm({ classId, essayTypes }: { classId: string; essayTypes: TypeOption[] }) {
  const [state, action, pending] = useActionState(createAssignment, undefined);
  const [typeValue, setTypeValue] = useState<EssayType>(essayTypes[0].value);
  const type = essayTypes.find((t) => t.value === typeValue) ?? essayTypes[0];
  const [docs, setDocs] = useState<Doc[]>([{ key: 1, citation: "", text: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const err = state?.fieldErrors ?? {};

  function move(i: number, dir: -1 | 1) {
    setDocs((d) => {
      const copy = [...d];
      const j = i + dir;
      if (j < 0 || j >= copy.length) return d;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  const sourcesJson = JSON.stringify(
    type.usesSources
      ? docs.filter((d) => d.citation.trim() || d.text.trim()).map((d, i) => ({ number: i + 1, citation: d.citation, text: d.text }))
      : [],
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="sources" value={sourcesJson} />

      <Field>
        <Label htmlFor="essayType">Essay type</Label>
        <NativeSelect id="essayType" name="essayType" value={typeValue} onChange={(e) => setTypeValue(e.target.value as EssayType)}>
          {essayTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
        {err.essayType && <FieldError>{err.essayType}</FieldError>}
      </Field>

      <Field>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" placeholder="Market revolution DBQ" required maxLength={120} aria-invalid={!!err.title} />
        {err.title && <FieldError>{err.title}</FieldError>}
      </Field>

      <Field>
        <Label htmlFor="promptText">Prompt</Label>
        <Textarea id="promptText" name="promptText" rows={4} required aria-invalid={!!err.promptText} />
        <FieldHint>Exactly what students will read on the prompt page.</FieldHint>
        {err.promptText && <FieldError>{err.promptText}</FieldError>}
      </Field>

      {type.usesSources && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">Documents</legend>
          <FieldHint>Numbered in this order on the packet and in scoring.</FieldHint>
          {docs.map((d, i) => (
            <div key={d.key} className="flex flex-col gap-2 rounded-panel border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Document {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Tooltip content="Move up">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Move document ${i + 1} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUpIcon />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Move down">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move document ${i + 1} down`}
                      onClick={() => move(i, 1)}
                      disabled={i === docs.length - 1}
                    >
                      <ArrowDownIcon />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Remove">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove document ${i + 1}`}
                      onClick={() => setDocs((all) => all.filter((x) => x.key !== d.key))}
                      disabled={docs.length === 1}
                    >
                      <Trash2Icon />
                    </Button>
                  </Tooltip>
                </div>
              </div>
              <Input
                aria-label={`Document ${i + 1} citation`}
                placeholder="Source: author, title, year"
                value={d.citation}
                onChange={(e) => setDocs((all) => all.map((x) => (x.key === d.key ? { ...x, citation: e.target.value } : x)))}
              />
              <Textarea
                aria-label={`Document ${i + 1} text`}
                rows={4}
                placeholder="Document text"
                className="essay-text"
                value={d.text}
                onChange={(e) => setDocs((all) => all.map((x) => (x.key === d.key ? { ...x, text: e.target.value } : x)))}
              />
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDocs((all) => [...all, { key: nextKey, citation: "", text: "" }]);
                setNextKey((k) => k + 1);
              }}
            >
              Add document
            </Button>
          </div>
          {err.sources && <FieldError>{err.sources}</FieldError>}
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="timeLimitMinutes">Time limit (minutes)</Label>
          <Input
            key={`t-${type.value}`}
            id="timeLimitMinutes"
            name="timeLimitMinutes"
            type="number"
            min={5}
            max={240}
            defaultValue={type.defaultTimeLimitMinutes}
            required
          />
          {err.timeLimitMinutes && <FieldError>{err.timeLimitMinutes}</FieldError>}
        </Field>
        <Field>
          <Label htmlFor="answerPagesPerStudent">Answer pages per student</Label>
          <Input
            key={`p-${type.value}`}
            id="answerPagesPerStudent"
            name="answerPagesPerStudent"
            type="number"
            min={1}
            max={8}
            defaultValue={type.defaultAnswerPages}
            required
          />
        </Field>
      </div>

      {state?.error && <FieldError>{state.error}</FieldError>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating assignment" : "Create assignment"}
        </Button>
      </div>
    </form>
  );
}
