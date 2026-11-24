"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cancelScoring } from "@/lib/actions/review";

export function CancelScoringButton({ assignmentId }: { assignmentId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="tertiary" size="sm" disabled={pending} onClick={() => start(() => cancelScoring(assignmentId))}>
      Stop scoring
    </Button>
  );
}
