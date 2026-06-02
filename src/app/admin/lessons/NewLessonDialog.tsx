"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  Film,
  Image as ImageIcon,
  Images,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  X,
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
import {
  prepareLessonUpload,
  createLessonFromUpload,
  createImageLesson,
  createCarouselLesson,
} from "./actions";

type ContentType = "video" | "image" | "carousel";
type LessonType = "training" | "announcement" | "update";
type Step = "type-picker" | "media" | "uploading" | "configure";

type CarouselSlide = {
  /** Stable client-side id for list ops (drag/reorder/delete). Not sent to server. */
  clientId: string;
  /** ImageKit URL once upload completes. */
  url: string;
  alt: string;
  thumbnailDataUrl: string;
  /** True while ImageKit is uploading; false once URL is set. */
  uploading: boolean;
};

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
  const [step, setStep] = useState<Step>("type-picker");
  const [contentType, setContentType] = useState<ContentType | null>(null);

  // Video upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Image upload state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imageThumbDataUrl, setImageThumbDataUrl] = useState<string | null>(
    null,
  );
  const [imageUploading, setImageUploading] = useState(false);

  // Carousel state
  const [slides, setSlides] = useState<CarouselSlide[]>([]);

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
    setStep("type-picker");
    setContentType(null);
    setFile(null);
    setUploadId(null);
    setUploadProgress(0);
    setUploadError(null);
    setImageUrl(null);
    setImageAlt("");
    setImageThumbDataUrl(null);
    setImageUploading(false);
    setSlides([]);
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
      window.setTimeout(reset, 200);
    }
  }

  // Refs to dodge stale-closure pitfalls inside async callbacks
  const uploadErrorRef = useRef<string | null>(null);
  const internalNameRef = useRef("");
  const titleRef = useRef("");
  useEffect(() => {
    uploadErrorRef.current = uploadError;
  }, [uploadError]);
  useEffect(() => {
    internalNameRef.current = internalName;
  }, [internalName]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  // -- VIDEO upload -------------------------------------------------------

  const uploadVideoFile = useCallback(async (chosen: File) => {
    setFile(chosen);
    setStep("uploading");
    setUploadProgress(0);
    setUploadError(null);

    const prep = await prepareLessonUpload({ language: "en" });
    if ("error" in prep) {
      setUploadError(prep.error ?? "Upload failed");
      setStep("media");
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
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
      return;
    }

    if (uploadErrorRef.current) return;

    setStep("configure");
    autofillNames(chosen.name);
  }, []);

  // -- IMAGE upload (ImageKit via server route) ---------------------------

  async function uploadImageToImageKit(chosen: File): Promise<{
    url: string;
    fileId: string;
  } | null> {
    const formData = new FormData();
    formData.append("file", chosen);
    const res = await fetch("/api/admin/lessons/upload-image", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `Image upload failed (${res.status})`);
    }
    return (await res.json()) as { ok: true; url: string; fileId: string };
  }

  const onImageDrop = useCallback((files: File[]) => {
    const chosen = files[0];
    if (!chosen) return;
    setUploadError(null);
    setImageUploading(true);
    // Generate a thumbnail data-URL for instant preview
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageThumbDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(chosen);

    (async () => {
      try {
        const result = await uploadImageToImageKit(chosen);
        if (result) {
          setImageUrl(result.url);
          autofillNames(chosen.name);
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
        setImageThumbDataUrl(null);
      } finally {
        setImageUploading(false);
      }
    })();
  }, []);

  // -- CAROUSEL upload (multiple images, sequential) ----------------------

  const onCarouselDrop = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setUploadError(null);

      // Spawn placeholder slides immediately with data-URL thumbs, then
      // upload each in sequence and patch the URL when done.
      const placeholders: CarouselSlide[] = files.map((f) => ({
        clientId: `${Date.now()}-${Math.round(performance.now() * 1000)}-${f.name}`,
        url: "",
        alt: "",
        thumbnailDataUrl: "",
        uploading: true,
      }));

      // Read data-URLs in parallel (preview only, doesn't hit the network)
      Promise.all(
        files.map(
          (f, idx) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                resolve(
                  typeof reader.result === "string" ? reader.result : "",
                );
              };
              reader.onerror = () => resolve("");
              reader.readAsDataURL(f);
              placeholders[idx]!.thumbnailDataUrl = "";
            }),
        ),
      ).then((dataUrls) => {
        setSlides((prev) => {
          const next = [...prev];
          placeholders.forEach((p, i) => {
            next.push({ ...p, thumbnailDataUrl: dataUrls[i] ?? "" });
          });
          return next;
        });
      });

      // Add placeholders immediately so the UI shows uploading state.
      setSlides((prev) => [...prev, ...placeholders]);

      // Upload sequentially to keep ImageKit happy and surface errors early
      (async () => {
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          const placeholder = placeholders[i]!;
          try {
            const result = await uploadImageToImageKit(f);
            if (result) {
              setSlides((prev) =>
                prev.map((s) =>
                  s.clientId === placeholder.clientId
                    ? { ...s, url: result.url, uploading: false }
                    : s,
                ),
              );
            }
          } catch (err) {
            // Remove the failed placeholder + surface error
            setSlides((prev) =>
              prev.filter((s) => s.clientId !== placeholder.clientId),
            );
            setUploadError(
              err instanceof Error
                ? `Slide ${i + 1} (${f.name}): ${err.message}`
                : String(err),
            );
          }
        }
      })();
    },
    [],
  );

  function updateSlideAlt(clientId: string, alt: string) {
    setSlides((prev) =>
      prev.map((s) => (s.clientId === clientId ? { ...s, alt } : s)),
    );
  }

  function removeSlide(clientId: string) {
    setSlides((prev) => prev.filter((s) => s.clientId !== clientId));
  }

  function moveSlide(clientId: string, direction: "up" | "down") {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.clientId === clientId);
      if (idx < 0) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap]!, next[idx]!];
      return next;
    });
  }

  // -- shared helpers -----------------------------------------------------

  function autofillNames(rawName: string) {
    const base = rawName
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "");
    if (!internalNameRef.current) setInternalName(base);
    if (!titleRef.current) {
      const titleGuess = rawName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      setTitle(titleGuess);
    }
  }

  function pickType(t: ContentType) {
    setContentType(t);
    setStep("media");
  }

  // -- DROPZONES (memoized per content type) ------------------------------

  const videoDropzone = useDropzone({
    onDrop: (files) => {
      const f = files[0];
      if (f) void uploadVideoFile(f);
    },
    accept: { "video/*": [] },
    multiple: false,
    maxSize: 5 * 1024 * 1024 * 1024,
    disabled: contentType !== "video" || step !== "media",
  });

  const imageDropzone = useDropzone({
    onDrop: onImageDrop,
    accept: { "image/*": [] },
    multiple: false,
    maxSize: 25 * 1024 * 1024,
    disabled: contentType !== "image" || step !== "media",
  });

  const carouselDropzone = useDropzone({
    onDrop: onCarouselDrop,
    accept: { "image/*": [] },
    multiple: true,
    maxSize: 25 * 1024 * 1024,
    disabled: contentType !== "carousel" || step !== "media",
  });

  // -- SAVE ---------------------------------------------------------------

  async function onSave(publish: boolean) {
    if (!contentType) return;
    setSaving(true);
    setPublishMode(publish ? "publish" : "draft");

    const shared = {
      internalName,
      title,
      description: description.trim() || undefined,
      notesMarkdown: notes.trim() || undefined,
      type,
      additionalLanguages: extraLangs,
      clientIds,
      publish,
    };

    let result:
      | { ok: true; lessonId: string }
      | { error: string }
      | null = null;

    if (contentType === "video") {
      result = await createLessonFromUpload({
        ...shared,
        uploadId: uploadId ?? undefined,
      });
    } else if (contentType === "image") {
      result = await createImageLesson({
        ...shared,
        imageUrl: imageUrl ?? "",
        imageAlt: imageAlt.trim(),
      });
    } else {
      result = await createCarouselLesson({
        ...shared,
        slides: slides.map((s) => ({
          url: s.url,
          alt: s.alt.trim(),
        })),
      });
    }

    if (!result || "error" in result) {
      toast.error(result?.error ?? "Save failed");
      setSaving(false);
      return;
    }
    toast.success(publish ? "Lesson published" : "Lesson saved as draft");
    setOpen(false);
    setSaving(false);
    window.setTimeout(() => {
      if (result && "ok" in result) {
        router.push(`/admin/lessons/${result.lessonId}`);
      }
      router.refresh();
    }, 50);
  }

  // -- DERIVED ------------------------------------------------------------

  const canProceedFromMedia = useMemo(() => {
    if (contentType === "video") return !!uploadId;
    if (contentType === "image")
      return !!imageUrl && imageAlt.trim().length > 0 && !imageUploading;
    if (contentType === "carousel")
      return (
        slides.length >= 2 &&
        slides.every((s) => s.url && s.alt.trim().length > 0 && !s.uploading)
      );
    return false;
  }, [contentType, uploadId, imageUrl, imageAlt, imageUploading, slides]);

  const canSave = useMemo(
    () =>
      internalName.trim().length > 0 &&
      title.trim().length > 0 &&
      !saving &&
      // Final content validity guard
      ((contentType === "video" && !!uploadId) ||
        (contentType === "image" &&
          !!imageUrl &&
          imageAlt.trim().length > 0) ||
        (contentType === "carousel" &&
          slides.length >= 2 &&
          slides.every((s) => s.url && s.alt.trim().length > 0))),
    [
      internalName,
      title,
      saving,
      contentType,
      uploadId,
      imageUrl,
      imageAlt,
      slides,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New lesson
      </Button>
      <DialogContent size="lg" hideClose={saving}>
        {step === "type-picker" && (
          <>
            <DialogHeader>
              <DialogTitle>New lesson</DialogTitle>
              <DialogDescription>
                What kind of content is this lesson?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-3">
              <TypeTile
                icon={<Film className="h-5 w-5" />}
                title="Video"
                description="A short Mux-hosted clip. Completion counts at 90% watched."
                onClick={() => pickType("video")}
              />
              <TypeTile
                icon={<ImageIcon className="h-5 w-5" />}
                title="Single image"
                description="One designed image-card. Completion counts after 5 seconds of dwell."
                onClick={() => pickType("image")}
              />
              <TypeTile
                icon={<Images className="h-5 w-5" />}
                title="Carousel"
                description="2+ slides employees swipe through. Completion = all slides viewed."
                onClick={() => pickType("carousel")}
              />
            </div>
          </>
        )}

        {step === "media" && contentType === "video" && (
          <>
            <DialogHeader>
              <DialogTitle>Upload video</DialogTitle>
              <DialogDescription>
                Drop the file below. Mux handles processing — you can configure
                the rest while it uploads.
              </DialogDescription>
            </DialogHeader>
            <div
              {...videoDropzone.getRootProps({
                className: cn(
                  "rounded-lg border-2 border-dashed transition-colors p-12",
                  "flex flex-col items-center justify-center text-center cursor-pointer",
                  videoDropzone.isDragActive
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/50",
                ),
              })}
            >
              <input {...videoDropzone.getInputProps()} />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-zinc-200 mb-3">
                <Upload className="h-5 w-5 text-zinc-700" />
              </div>
              <p className="text-sm font-medium text-zinc-900">
                {videoDropzone.isDragActive
                  ? "Drop the video here"
                  : "Drag a video file here, or click to choose"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                MP4, MOV, WebM and most formats.
              </p>
            </div>
            {uploadError && <ErrorBanner message={uploadError} />}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("type-picker")}
              >
                Back
              </Button>
            </DialogFooter>
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
                    You can configure the lesson while it processes.
                  </p>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{uploadProgress}%</span>
                {file && <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>}
              </div>
            </div>
            {uploadError && <ErrorBanner message={uploadError} />}
          </>
        )}

        {step === "media" && contentType === "image" && (
          <>
            <DialogHeader>
              <DialogTitle>Upload image</DialogTitle>
              <DialogDescription>
                One designed image-card. Drop it below and add alt text for
                accessibility.
              </DialogDescription>
            </DialogHeader>

            {imageThumbDataUrl ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl ?? imageThumbDataUrl}
                    alt={imageAlt || "Lesson image"}
                    className="w-full max-h-80 object-contain bg-white"
                  />
                  {imageUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-700" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(null);
                      setImageAlt("");
                      setImageThumbDataUrl(null);
                    }}
                    disabled={imageUploading}
                    className="absolute top-2 right-2 rounded-md bg-white/90 backdrop-blur px-2 py-1 text-xs font-medium text-zinc-700 border border-zinc-200 hover:bg-white disabled:opacity-50"
                  >
                    Replace
                  </button>
                </div>
                <div>
                  <Label htmlFor="image-alt">Alt text (required)</Label>
                  <Input
                    id="image-alt"
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    placeholder="Describe the image for screen readers and low-vision users"
                  />
                </div>
              </div>
            ) : (
              <div
                {...imageDropzone.getRootProps({
                  className: cn(
                    "rounded-lg border-2 border-dashed transition-colors p-10",
                    "flex flex-col items-center justify-center text-center cursor-pointer",
                    imageDropzone.isDragActive
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/50",
                  ),
                })}
              >
                <input {...imageDropzone.getInputProps()} />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-zinc-200 mb-3">
                  <ImageIcon className="h-5 w-5 text-zinc-700" />
                </div>
                <p className="text-sm font-medium text-zinc-900">
                  {imageDropzone.isDragActive
                    ? "Drop the image here"
                    : "Drag an image, or click to choose"}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  JPG, PNG, WebP, AVIF — up to 25MB.
                </p>
              </div>
            )}

            {uploadError && <ErrorBanner message={uploadError} />}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("type-picker")}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!canProceedFromMedia}
                onClick={() => setStep("configure")}
              >
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "media" && contentType === "carousel" && (
          <>
            <DialogHeader>
              <DialogTitle>Upload carousel</DialogTitle>
              <DialogDescription>
                At least 2 slides. Employees swipe through in order — drag the
                arrows to reorder, fill in alt text for each.
              </DialogDescription>
            </DialogHeader>

            <div
              {...carouselDropzone.getRootProps({
                className: cn(
                  "rounded-lg border-2 border-dashed transition-colors p-6",
                  "flex flex-col items-center justify-center text-center cursor-pointer",
                  carouselDropzone.isDragActive
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100/50",
                ),
              })}
            >
              <input {...carouselDropzone.getInputProps()} />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-zinc-200 mb-2">
                <Plus className="h-4 w-4 text-zinc-700" />
              </div>
              <p className="text-sm font-medium text-zinc-900">
                {carouselDropzone.isDragActive
                  ? "Drop images to add slides"
                  : "Drag images here, or click to add slides"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                You can drop several at once. JPG, PNG, WebP, AVIF — up to 25MB
                each.
              </p>
            </div>

            {slides.length > 0 && (
              <div className="space-y-2">
                {slides.map((slide, i) => (
                  <div
                    key={slide.clientId}
                    className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-2.5"
                  >
                    <div className="relative shrink-0 h-16 w-16 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200">
                      {slide.thumbnailDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={slide.url || slide.thumbnailDataUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      {slide.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500 mb-1">
                        Slide {i + 1}
                        {slide.uploading && " · uploading…"}
                      </div>
                      <Input
                        value={slide.alt}
                        onChange={(e) =>
                          updateSlideAlt(slide.clientId, e.target.value)
                        }
                        placeholder="Alt text — short description of this slide"
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveSlide(slide.clientId, "up")}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlide(slide.clientId, "down")}
                        disabled={i === slides.length - 1}
                        aria-label="Move down"
                        className="rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSlide(slide.clientId)}
                      aria-label={`Remove slide ${i + 1}`}
                      className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {slides.length === 1 && (
              <p className="text-xs text-amber-700 -mt-1">
                Add at least one more slide. A single image should use the
                Single image content type instead.
              </p>
            )}

            {uploadError && <ErrorBanner message={uploadError} />}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("type-picker")}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!canProceedFromMedia}
                onClick={() => setStep("configure")}
              >
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "configure" && (
          <>
            <DialogHeader>
              <DialogTitle>Configure lesson</DialogTitle>
              <DialogDescription>
                Set the title, the description, and who can see it.
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

            {contentType === "video" && uploadId && (
              <div className="flex items-start gap-2 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                <Film className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-500" />
                <span>
                  Video attached. Mux is processing — the lesson detail page
                  will show &ldquo;Ready&rdquo; once it&apos;s playable.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("media")}
                disabled={saving}
              >
                Back
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

function TypeTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 text-left",
        "hover:border-zinc-900 hover:shadow-sm transition-all",
        "flex flex-col gap-2",
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
        {icon}
      </span>
      <span className="text-sm font-semibold text-zinc-900">{title}</span>
      <span className="text-xs text-zinc-500 leading-snug">{description}</span>
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
