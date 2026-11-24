"use client";

import { useState, useTransition } from "react";
import { SmartphoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Banner, Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPhoneUploadLink } from "@/lib/actions/uploads";

type Link = Awaited<ReturnType<typeof createPhoneUploadLink>>;

/** On a computer: show a QR code that opens this upload screen on the teacher's phone. */
export function PhoneQr({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function show() {
    setOpen(true);
    setError(null);
    start(async () => {
      try {
        setLink(await createPhoneUploadLink(assignmentId));
      } catch {
        setError("The code could not be made. Check your connection and try again.");
      }
    });
  }

  return (
    <Card className="hidden items-center gap-4 p-6 md:flex">
      <SmartphoneIcon className="size-6 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">Take the photos with your phone</p>
        <p className="text-sm text-muted-foreground">Scan a code with your phone camera. No sign-in on the phone.</p>
      </div>
      <Button onClick={show} disabled={pending}>
        Show code
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan with your phone camera</DialogTitle>
            <DialogDescription>
              The link opens a camera page for this assignment. It works for {link?.hours ?? 2} hours and can only add pages.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-critical">{error}</p>}
          {link ? (
            <>
              {/* The QR code is black on white in both themes so phone cameras can read it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={link.qrSrc} alt="QR code for the phone upload link" className="mx-auto aspect-square w-64 rounded-control" />
              <p className="text-sm text-muted-foreground">
                Pages show up on this computer as they are read. Anyone who scans this code can add pages, so do not share it.
              </p>
              {!link.reachable && (
                <Banner tone="warning">
                  This link points to localhost, which a phone cannot open. Set APP_URL in .env to this computer&apos;s network
                  address, then restart the server.
                </Banner>
              )}
            </>
          ) : (
            !error && <div className="mx-auto aspect-square w-64 rounded-control bg-surface-muted" aria-label="Making the code" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
