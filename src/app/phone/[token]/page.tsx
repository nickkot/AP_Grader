import type { Metadata } from "next";

import { Capture } from "@/app/(app)/assignments/[id]/upload/capture";
import { APP_NAME } from "@/lib/brand";
import { findPhoneLink } from "@/lib/phone-links";

export const metadata: Metadata = { title: "Upload photos" };

/**
 * Opened on the teacher's phone from the QR code on the upload screen. No sign-in:
 * the token in the link lets this page add pages to one assignment, nothing else.
 * It shows the assignment and class name only, never students or scores.
 */
export default async function PhoneUploadPage(props: PageProps<"/phone/[token]">) {
  const { token } = await props.params;
  const link = await findPhoneLink(token);

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6">
      <p className="text-base font-bold text-primary">{APP_NAME}</p>
      {link ? (
        <>
          <div>
            <h1 className="text-xl font-bold break-words">Upload photos</h1>
            <p className="mt-1 text-base text-muted-foreground">
              {link.assignmentTitle} · {link.className}
            </p>
          </div>
          <Capture target={{ kind: "phone", token }} />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">This link has expired</h1>
          <p className="text-base text-muted-foreground">
            Phone links work for 2 hours. On your computer, open the assignment, choose Upload photos, then scan the new code.
          </p>
        </div>
      )}
    </main>
  );
}
