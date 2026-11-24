"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CameraIcon, RotateCwIcon } from "lucide-react";

import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { batchProgress, finishPdf, presignPdf, presignPhoto, registerPhoto, startUploadBatch } from "@/lib/actions/uploads";
import { pluralize } from "@/lib/utils";

type Shot = { id: number; blob: Blob; preview: string; state: "uploading" | "done" | "failed"; error?: string };
type Progress = Awaited<ReturnType<typeof batchProgress>>;

const MAX_SIDE = 2400;
const UPLOAD_CONCURRENCY = 3;

/** Convert any image to a JPEG no larger than MAX_SIDE on its long side. */
async function toJpeg(source: Blob | HTMLVideoElement): Promise<Blob> {
  let width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
    draw = (ctx, w, h) => ctx.drawImage(source, 0, 0, w, h);
  } else {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    width = bitmap.width;
    height = bitmap.height;
    draw = (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  draw(ctx, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read the photo."))), "image/jpeg", 0.85),
  );
}

export function Capture({ assignmentId }: { assignmentId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const batchRef = useRef<Promise<string> | null>(null);
  const queueRef = useRef<Shot[]>([]);
  const activeRef = useRef(0);
  const nextId = useRef(1);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const getBatch = useCallback(() => {
    if (!batchRef.current) {
      batchRef.current = startUploadBatch(assignmentId, "photos").then((r) => {
        setBatchId(r.batchId);
        return r.batchId;
      });
    }
    return batchRef.current;
  }, [assignmentId]);

  const update = (id: number, patch: Partial<Shot>) => setShots((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const uploadOne = useCallback(
    async (shot: Shot) => {
      try {
        const batch = await getBatch();
        const signed = await presignPhoto(assignmentId, "image/jpeg");
        if ("error" in signed) throw new Error(signed.error);
        const put = await fetch(signed.url, { method: "PUT", body: shot.blob, headers: { "Content-Type": "image/jpeg" } });
        if (!put.ok) throw new Error("Upload failed. Check your connection.");
        const reg = await registerPhoto({
          assignmentId,
          batchId: batch,
          pageId: signed.pageId,
          key: signed.key,
          contentType: "image/jpeg",
          sizeBytes: shot.blob.size,
        });
        if ("error" in reg) throw new Error(reg.error);
        update(shot.id, { state: "done" });
      } catch (err) {
        update(shot.id, { state: "failed", error: err instanceof Error ? err.message : "Upload failed." });
      }
    },
    [assignmentId, getBatch],
  );

  // Upload a few photos at a time. The function reads itself through a ref so it can
  // keep the queue moving after each upload finishes.
  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    while (activeRef.current < UPLOAD_CONCURRENCY && queueRef.current.length) {
      const shot = queueRef.current.shift()!;
      activeRef.current++;
      void uploadOne(shot).finally(() => {
        activeRef.current--;
        pumpRef.current();
      });
    }
  }, [uploadOne]);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const addBlob = useCallback(
    (blob: Blob) => {
      const shot: Shot = { id: nextId.current++, blob, preview: URL.createObjectURL(blob), state: "uploading" };
      setShots((all) => [shot, ...all]);
      queueRef.current.push(shot);
      pump();
    },
    [pump],
  );

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("The camera is not available. Allow camera access, or choose photos instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    addBlob(await toJpeg(video));
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        addBlob(await toJpeg(file));
      } catch {
        const id = nextId.current++;
        setShots((all) => [{ id, blob: file, preview: "", state: "failed", error: `${file.name} is not a photo this browser can open.` }, ...all]);
      }
    }
  }

  async function onPdf(file: File | undefined) {
    if (!file) return;
    setPdfState("Uploading PDF");
    try {
      const { batchId: pdfBatch } = await startUploadBatch(assignmentId, "pdf");
      const signed = await presignPdf(assignmentId, pdfBatch, file.size);
      if ("error" in signed) throw new Error(signed.error);
      const put = await fetch(signed.url, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again.");
      const done = await finishPdf(assignmentId, pdfBatch);
      if ("error" in done) throw new Error(done.error);
      setBatchId(pdfBatch);
      setPdfState("PDF uploaded. Splitting it into pages.");
    } catch (err) {
      setPdfState(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  useEffect(() => () => stopCamera(), []);

  // Keyboard: space or Enter takes a photo while the camera is on.
  useEffect(() => {
    if (!cameraOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        void takePhoto();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!batchId) return;
    let stop = false;
    const tick = async () => {
      try {
        const p = await batchProgress(assignmentId, batchId);
        if (!stop) setProgress(p);
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = setInterval(tick, 2500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [assignmentId, batchId]);

  const uploading = shots.filter((s) => s.state === "uploading").length;
  const failed = shots.filter((s) => s.state === "failed");

  return (
    <div className="flex flex-col gap-4">
      {cameraOn ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-black">
          <video ref={videoRef} playsInline muted className="min-h-0 flex-1 object-contain" />
          {flash && <div className="pointer-events-none absolute inset-0 bg-white/40" />}
          <div className="flex items-center justify-between gap-4 bg-black px-6 pt-4 pb-[max(env(safe-area-inset-bottom),24px)] text-white">
            <span className="w-24 text-sm tabular-nums">
              {shots.length} {shots.length === 1 ? "page" : "pages"}
              {uploading > 0 && <span className="block text-xs text-white/70">{uploading} uploading</span>}
            </span>
            <button
              type="button"
              onClick={takePhoto}
              aria-label="Take photo"
              className="size-18 rounded-full border-4 border-white bg-white/90 active:bg-white"
            />
            <Button variant="outline" className="w-24 border-white/40 bg-transparent text-white hover:bg-white/10" onClick={stopCamera}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={startCamera}>
            <CameraIcon aria-hidden />
            Open camera
          </Button>
          {cameraError && <p className="text-sm text-status-error">{cameraError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <label>
                Choose photos
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
              </label>
            </Button>
            <Button asChild variant="outline">
              <label>
                Upload a copier PDF
                <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => onPdf(e.target.files?.[0])} />
              </label>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Lay each page flat in good light with the QR code in view. Take one photo per page.
          </p>
          {pdfState && <p className="text-sm">{pdfState}</p>}
        </div>
      )}

      {progress && progress.total > 0 && (
        <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-4 py-3 text-sm">
          <p>
            {progress.done} of {progress.total} pages read
            {progress.unmatched > 0 && <span>. {pluralize(progress.unmatched, "page")} need matching</span>}
            {progress.failed > 0 && <span>. {pluralize(progress.failed, "page")} could not be read</span>}
          </p>
          <Progress value={(progress.done / progress.total) * 100} aria-label="Pages read" />
          {progress.working === 0 && uploading === 0 && (
            <div className="flex gap-2">
              {progress.unmatched > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/assignments/${assignmentId}/match`}>Match pages</Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link href={`/assignments/${assignmentId}`}>Back to the class</Link>
              </Button>
            </div>
          )}
        </div>
      )}
      {progress?.batchError && <p className="text-sm text-status-error">{progress.batchError}</p>}

      {failed.length > 0 && (
        <div className="flex flex-col gap-2">
          {failed.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <StatusDot tone="error" />
              <span className="flex-1">{s.error}</span>
              {s.preview && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    update(s.id, { state: "uploading", error: undefined });
                    queueRef.current.push(s);
                    pump();
                  }}
                >
                  <RotateCwIcon aria-hidden />
                  Retry
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {shots.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Photos taken">
          {shots.map((s) =>
            s.preview ? (
              <li key={s.id} className="relative overflow-hidden rounded-control border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="" className="aspect-[3/4] w-full object-cover" />
                <span className="absolute right-1 bottom-1 rounded-full bg-surface p-0.5">
                  <StatusDot tone={s.state === "done" ? "ok" : s.state === "failed" ? "error" : "progress"} />
                </span>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}
