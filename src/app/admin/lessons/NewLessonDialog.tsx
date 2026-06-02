"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  Film,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { prepareLessonUpload, createLessonFromUpload } from "./actions";

type Step = "intro" | "uploading" | "configure";

// Lessons must carry media. The text-only escape hatch was removed
// 2026-06-02 when Dimi locked the three content-type model
// (video | image | carousel). Until Dex's image/carousel schema lands,
// the dialog is video-only and the configure step is only reachable
// after a successful Mux upload.
type LessonType = "training" | "announcement" | "update";

const ALL_LANGS = [
  { code: "fr", label: "Français" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
] as const;

export interface NewLessonDialogProps {
  clients: { id: string; name: string }[];
}

export function NewLessonDialog({ clients }: NewLessonDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Configure state
  const [internalName, setInternalName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<LessonType>("training");
  const [extraLangs, setExtraLangs] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishMode, setPublishMode] = useState<"draft" | "publish">("draft");

  function reset() {
    setStep("intro");
    setFile(null);
    setUploadId(null);
    setUploadProgress(0);
    setUploadError(null);
    setInternalName("");
    setTitle("");
    setDescription("");
    setNotes("");
    setType("training");
    setExtraLangs([]);
    setClientIds([]);
    setSaving(false);
    setPublishMode("draft");
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  }

  function onOpenChange(next: boolean) {
    if (!next && saving) return;
    setOpen(next);
    if (!next) {
      // Defer reset so the close animation doesn't show a flash of reset state
      window.setTimeout(reset, 200);
    }
  }

  // Refs to dodge stale-closure pitfalls inside uploadFile
  const uploadErrorRef = useRef<string | null>(null);
  const internalNameRef = useRef<string>("");
  const titleRef = useRef<string>("");
  useEffect(() => {
    uploadErrorRef.current = uploadError;
  }, [uploadError]);
  useEffect(() => {
    internalNameRef.current = internalName;
  }, [internalName]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const uploadFile = useCallback(async (chosen: File) => {
    setFile(chosen);
    setStep("uploading");
    setUploadProgress(0);
    setUploadError(null);

    const prep = await prepareLessonUpload({ language: "en" });
    if ("error" in prep) {
      setUploadError(prep.error ?? "Upload failed");
      setStep("intro");
      return;
    }
    setUploadId(prep.uploadId);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", prep.url);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Mux upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => {
          xhrRef.current = null;
          reject(new Error("Network error during upload"));
        };
        xhr.send(chosen);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(message);
      return;
    }

    if (uploadErrorRef.current) return;

    setStep("configure");
    // Auto-fill internalName + title from filename if empty
    const base = chosen.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "");
    if (!internalNameRef.current) setInternalName(base);
    if (!titleRef.current) {
      const titleGuess = chosen.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      setTitle(titleGuess);
    }
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const chosen = accepted[0];
      if (!chosen) return;
      void uploadFile(chosen);
    },
    [uploadFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    maxSize: 5 * 1024 * 1024 * 1024, // 5 GB — Mux handles real limits server-side
    disabled: step !== "intro",
  });

  async function onSave(publish: boolean) {
    setSaving(true);
    setPublishMode(publish ? "publish" : "draft");
    const res = await createLessonFromUpload({
      uploadId: uploadId ?? undefined,
      internalName,
      title,
      description: description.trim() || undefined,
      notesMarkdown: notes.trim() || undefined,
      type,
      additionalLanguages: extraLangs,
      clientIds,
      publish,
    });
    if ("error" in res) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    toast.success(publish ? "Lesson published" : "Lesson saved as draft");
    setOpen(false);
    setSaving(false);
    window.setTimeout(() => {
      router.push(`/admin/lessons/${res.lessonId}`);
      router.refresh();
    }, 50);
  }

  const canSave = useMemo(
    () => internalName.trim().length > 0 && title.trim().length > 0 && !saving,
    [internalName, title, saving],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New lesson
      </Button>
      <DialogContent size="lg" hideClose={saving}>
        {step === "intro" && (
          <>
            <DialogHeader>
              <DialogTitle>New lesson</DialogTitle>
              <DialogDescription>
                Start with a video — drop it below and we&apos;ll process it
                while you fill in the rest.
              </DialogDescription>
            </DialogHeader>

            <div
              {...getRootProps({
                className: cn(
                  "rounded-lg border-2 border-dashed transition-colors p-12",
                  "flex flex-col items-center justify-center text-center cursor-pointer",
                  isDragActive
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/50",
                ),
              })}
            >
              <input {...getInputProps()} />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-zinc-200 mb-3">
                <Upload className="h-5 w-5 text-zinc-700" />
              </div>
              <p className="text-sm font-medium text-zinc-900">
                {isDragActive
                  ? "Drop the video here"
                  : "Drag a video file here, or click to choose"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                MP4, MOV, WebM and most formats. Mux handles the processing.
              </p>
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </>
        )}

        {step === "uploading" && (
          <>
            <DialogHeader>
              <DialogTitle>Uploading video</DialogTitle>
              <DialogDescription>{file?.name}</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-zinc-200">
                  {uploadProgress < 100 ? (
                    <Loader2 className="h-4 w-4 text-zinc-700 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">
                    {uploadProgress < 100
                      ? "Uploading to Mux…"
                      : "Upload complete — Mux is processing"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    You can configure the lesson while it processes; the video
                    becomes playable shortly.
                  </p>
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                  role="progressbar"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{uploadProgress}%</span>
                {file && <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>}
              </div>
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </>
        )}

        {step === "configure" && (
          <>
            <DialogHeader>
              <DialogTitle>Configure lesson</DialogTitle>
              <DialogDescription>
                Video is uploading in the background. Fill in the details and
                save.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="nl-internal">Internal name</Label>
                <Input
                  id="nl-internal"
                  value={internalName}
                  onChange={(e) => setInternalName(e.target.value)}
                  placeholder="vision-ai-retail"
                  required
                />
                <p className="text-xs text-zinc-500 mt-1">
                  For your reference. Not shown to employees.
                </p>
              </div>
              <div>
                <Label htmlFor="nl-title">Title (English)</Label>
                <Input
                  id="nl-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Vision AI for retail"
                  required
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Shown to employees. Translate later.
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="nl-description">Description (optional)</Label>
                <Input
                  id="nl-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A 2-minute walkthrough of the device assessment flow."
                />
              </div>

              <div>
                <Label htmlFor="nl-type">Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as LessonType)}
                >
                  <SelectTrigger id="nl-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Additional language placeholders</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_LANGS.map((l) => {
                    const checked = extraLangs.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() =>
                          setExtraLangs((prev) =>
                            checked
                              ? prev.filter((c) => c !== l.code)
                              : [...prev, l.code],
                          )
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                          checked
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400",
                        )}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Empty rows you&apos;ll fill in later.
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label>Assign to clients</Label>
                {clients.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No clients yet. You can assign this lesson after creating
                    one.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {clients.map((c) => {
                      const checked = clientIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setClientIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== c.id)
                                : [...prev, c.id],
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                            checked
                              ? "bg-zinc-900 text-white border-zinc-900"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400",
                          )}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="nl-notes">
                  Notes / transcript (optional, markdown)
                </Label>
                <Textarea
                  id="nl-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key takeaways, transcript, or links employees should remember."
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
              <Film className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-500" />
              <span>
                Video attached. Mux is processing — the lesson detail page will
                show &ldquo;Ready&rdquo; once it&apos;s playable.
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onSave(false)}
                disabled={!canSave}
              >
                {saving && publishMode === "draft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save as draft
              </Button>
              <Button
                type="button"
                onClick={() => onSave(true)}
                disabled={!canSave}
              >
                {saving && publishMode === "publish" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Save & publish
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
