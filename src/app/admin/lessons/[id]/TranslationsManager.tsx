"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  ChevronUp,
  ChevronDown,
  Loader2,
  Plus,
  X,
  Image as ImageIcon,
} from "lucide-react";
import {
  addTranslation,
  updateTranslation,
  deleteTranslation,
  copyMuxFromEnglish,
  clearMux,
  resyncMuxUpload,
  updateImageLesson,
  clearImage,
  copyImageFromEnglish,
  updateCarouselLesson,
  clearCarousel,
  copyCarouselFromEnglish,
} from "./translations-actions";
import { toast } from "sonner";
import type { CarouselSlide } from "@/lib/db/schema";
import { cn } from "@/lib/cn";

type ContentType = "video" | "image" | "carousel";

type Translation = {
  id: string;
  language: string;
  title: string;
  description: string | null;
  notesMarkdown: string | null;
  // Video
  muxPlaybackId: string | null;
  muxUploadId: string | null;
  muxErrorMessage: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  // Image
  imageUrl: string | null;
  imageAlt: string | null;
  // Carousel
  carouselSlides: CarouselSlide[] | null;
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  nl: "Nederlands",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
};

const ADDABLE = ["fr", "nl", "de", "es", "it", "pt"];

function englishHasMedia(t: Translation | undefined, ct: ContentType): boolean {
  if (!t) return false;
  if (ct === "video") return !!t.muxPlaybackId;
  if (ct === "image") return !!t.imageUrl;
  return (t.carouselSlides?.length ?? 0) > 0;
}

async function uploadImageToServer(
  file: File,
): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append("file", file);
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
  return (await res.json()) as { url: string; key: string };
}

export default function TranslationsManager({
  lessonId,
  contentType,
  translations,
}: {
  lessonId: string;
  contentType: ContentType;
  translations: Translation[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [newLang, setNewLang] = useState<string>(
    ADDABLE.find((l) => !translations.some((t) => t.language === l)) ?? "fr",
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const englishTranslation = translations.find((t) => t.language === "en");
  const englishReady = englishHasMedia(englishTranslation, contentType);
  const availableLangs = ADDABLE.filter(
    (l) => !translations.some((t) => t.language === l),
  );

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addTranslation({
        lessonId,
        language: newLang,
        title: newTitle,
        description: newDesc,
        notesMarkdown: newNotes,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setNewTitle("");
      setNewDesc("");
      setNewNotes("");
      router.refresh();
    });
  }

  const sorted = [...translations].sort((a, b) => {
    if (a.language === "en") return -1;
    if (b.language === "en") return 1;
    return a.language.localeCompare(b.language);
  });

  return (
    <div className="space-y-4">
      {sorted.map((t) => (
        <TranslationRow
          key={t.id}
          lessonId={lessonId}
          contentType={contentType}
          translation={t}
          englishReady={englishReady}
          startTransition={startTransition}
          pending={pending}
          setError={setError}
        />
      ))}

      {availableLangs.length > 0 && (
        <form
          onSubmit={onAdd}
          className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-zinc-700">Add translation</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Language
              </label>
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {availableLangs.map((l) => (
                  <option key={l} value={l}>
                    {LANG_LABELS[l]} ({l})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Title
              </label>
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={`Welcome to Pandas Vision AI (in ${LANG_LABELS[newLang] ?? newLang})`}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Description
              </label>
              <input
                required
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short teaser shown on the video overlay — ends with … as the tap-to-expand hint."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Notes (markdown)
              </label>
              <textarea
                required
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={4}
                placeholder="Full notes revealed when the employee taps the description."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                pending ||
                !newTitle.trim() ||
                !newDesc.trim() ||
                !newNotes.trim()
              }
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
            >
              {pending ? "Adding…" : "Add translation"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function TranslationRow({
  lessonId,
  contentType,
  translation: t,
  englishReady,
  startTransition,
  pending,
  setError,
}: {
  lessonId: string;
  contentType: ContentType;
  translation: Translation;
  englishReady: boolean;
  startTransition: (fn: () => void) => void;
  pending: boolean;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [description, setDescription] = useState(t.description ?? "");
  const [notes, setNotes] = useState(t.notesMarkdown ?? "");
  const isEnglish = t.language === "en";

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateTranslation({
        translationId: t.id,
        lessonId,
        title,
        description,
        notesMarkdown: notes,
      });
      if (res?.error) setError(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete the ${LANG_LABELS[t.language] ?? t.language} translation?`))
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTranslation({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono uppercase text-zinc-700">
              {t.language}
            </span>
            <span className="text-xs text-zinc-500">
              {LANG_LABELS[t.language] ?? t.language}
            </span>
            {isEnglish && (
              <span className="text-xs text-zinc-500">
                · system-wide fallback
              </span>
            )}
          </div>
          {!editing ? (
            <>
              <h3 className="font-medium text-zinc-900">{t.title}</h3>
              {t.description && (
                <p className="text-sm text-zinc-600 mt-1">{t.description}</p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description — short teaser shown on the video overlay."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <textarea
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (markdown) — full body revealed when the description is tapped."
                rows={4}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-1 items-end">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-zinc-700 hover:underline"
              >
                Edit
              </button>
              {!isEnglish && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={pending}
                  className="text-xs text-red-700 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={
                  pending ||
                  !title.trim() ||
                  !description.trim() ||
                  !notes.trim()
                }
                className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(t.title);
                  setDescription(t.description ?? "");
                  setNotes(t.notesMarkdown ?? "");
                }}
                className="text-xs text-zinc-600 hover:underline"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {contentType === "video" && (
        <VideoMedia
          lessonId={lessonId}
          translation={t}
          englishReady={englishReady}
          isEnglish={isEnglish}
          pending={pending}
          startTransition={startTransition}
          setError={setError}
        />
      )}
      {contentType === "image" && (
        <ImageMedia
          lessonId={lessonId}
          translation={t}
          englishReady={englishReady}
          isEnglish={isEnglish}
          pending={pending}
          startTransition={startTransition}
          setError={setError}
        />
      )}
      {contentType === "carousel" && (
        <CarouselMedia
          lessonId={lessonId}
          translation={t}
          englishReady={englishReady}
          isEnglish={isEnglish}
          pending={pending}
          startTransition={startTransition}
          setError={setError}
        />
      )}
    </div>
  );
}

// ============================== VIDEO ======================================

function VideoMedia({
  lessonId,
  translation: t,
  englishReady,
  isEnglish,
  pending,
  startTransition,
  setError,
}: {
  lessonId: string;
  translation: Translation;
  englishReady: boolean;
  isEnglish: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();

  function onCopyEn() {
    setError(null);
    startTransition(async () => {
      const res = await copyMuxFromEnglish({
        translationId: t.id,
        lessonId,
      });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onClearVideo() {
    if (
      !confirm(
        "Clear the video for this translation? You'll need to re-upload or copy from English.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await clearMux({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onResync() {
    setError(null);
    startTransition(async () => {
      const res = await resyncMuxUpload({ translationId: t.id, lessonId });
      if (res?.error) {
        setError(res.error);
        return;
      }
      switch (res?.status) {
        case "ready":
          toast.success("Synced — video is ready");
          break;
        case "preparing":
          toast.info("Mux is still processing — try again in a minute");
          break;
        case "errored":
          toast.error(`Upload errored: ${res.error ?? "Mux reported a failure"}`);
          break;
        case "unknown":
          toast.error(
            `Couldn't find the upload on Mux${res.error ? ` — ${res.error}` : ""}`,
          );
          break;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm">
      {t.muxErrorMessage ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-red-700 font-medium">✗ Errored</span>
            <span className="text-xs text-red-700 break-words">
              {t.muxErrorMessage}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={onResync}
              disabled={pending}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
            >
              Resync with Mux
            </button>
            <button
              type="button"
              onClick={onClearVideo}
              disabled={pending}
              className="text-xs text-red-700 hover:underline disabled:opacity-50"
            >
              Clear & re-upload
            </button>
          </div>
        </div>
      ) : t.muxPlaybackId ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-emerald-700 font-medium">✓ Ready</span>
            <code className="font-mono text-xs text-zinc-600 truncate max-w-xs">
              {t.muxPlaybackId}
            </code>
            {t.durationSeconds !== null && (
              <span className="text-xs text-zinc-500">
                {t.durationSeconds < 60
                  ? `${t.durationSeconds}s`
                  : `${Math.round(t.durationSeconds / 60)} min`}
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onResync}
                disabled={pending}
                title="Re-read playback id, duration, and aspect ratio from Mux. Use if metadata looks stale."
                className="text-xs text-zinc-500 hover:text-zinc-700 hover:underline disabled:opacity-50"
              >
                Resync metadata
              </button>
              <button
                type="button"
                onClick={onClearVideo}
                disabled={pending}
                className="text-xs text-red-700 hover:underline disabled:opacity-50"
              >
                Clear video
              </button>
            </div>
          </div>
          {t.thumbnailUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={t.thumbnailUrl}
              alt="Thumbnail"
              className="max-w-xs rounded-md border border-zinc-200"
            />
          )}
        </div>
      ) : t.muxUploadId ? (
        <div className="space-y-2">
          <p className="text-amber-700">
            ⏳ Upload in progress / Mux is processing. Refresh in a minute.
          </p>
          <button
            type="button"
            onClick={onResync}
            disabled={pending}
            className="text-xs text-zinc-700 hover:underline disabled:opacity-50"
          >
            Resync now if it&apos;s been stuck
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-zinc-600 text-xs">No video uploaded yet.</p>
          <div className="flex gap-2 flex-wrap">
            <VideoUploadButton
              lessonId={lessonId}
              translationId={t.id}
              language={t.language}
            />
            {!isEnglish && englishReady && (
              <button
                type="button"
                onClick={onCopyEn}
                disabled={pending}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
              >
                Share English video
              </button>
            )}
          </div>
          {!isEnglish && !englishReady && (
            <p className="text-xs text-zinc-500">
              Upload the English video first if you want to share it with this
              translation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VideoUploadButton({
  lessonId,
  translationId,
  language,
}: {
  lessonId: string;
  translationId: string;
  language: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    setProgress(0);
    try {
      const urlRes = await fetch("/api/admin/mux/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, translationId, language }),
      });
      if (!urlRes.ok) {
        throw new Error(`Upload URL failed: ${await urlRes.text()}`);
      }
      const { url } = (await urlRes.json()) as { url: string };
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Mux upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });
      setProgress(100);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="inline-block rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors cursor-pointer">
        {pending
          ? progress !== null && progress < 100
            ? `Uploading ${progress}%`
            : "Processing…"
          : "Upload video"}
        <input
          type="file"
          accept="video/*"
          onChange={onPick}
          disabled={pending}
          className="hidden"
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// ============================== IMAGE ======================================

function ImageMedia({
  lessonId,
  translation: t,
  englishReady,
  isEnglish,
  pending,
  startTransition,
  setError,
}: {
  lessonId: string;
  translation: Translation;
  englishReady: boolean;
  isEnglish: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const [alt, setAlt] = useState(t.imageAlt ?? "");
  const [uploading, setUploading] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const persistedAlt = t.imageAlt ?? "";
  const altDirty = alt.trim() !== persistedAlt;

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setLocalError(null);
      setUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") setThumb(reader.result);
      };
      reader.readAsDataURL(file);
      (async () => {
        try {
          const result = await uploadImageToServer(file);
          const nextAlt = alt.trim() || persistedAlt;
          const res = await updateImageLesson({
            translationId: t.id,
            lessonId,
            imageUrl: result.url,
            imageAlt: nextAlt,
          });
          if (res?.error) {
            setLocalError(res.error);
            setThumb(null);
          } else {
            router.refresh();
          }
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : String(err));
          setThumb(null);
        } finally {
          setUploading(false);
        }
      })();
    },
    [alt, persistedAlt, lessonId, t.id, router],
  );

  const dropzone = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    maxSize: 25 * 1024 * 1024,
    disabled: uploading || pending,
  });

  function onSaveAlt() {
    const trimmed = alt.trim();
    if (!trimmed) {
      setLocalError("Alt text is required");
      return;
    }
    if (!t.imageUrl) {
      setLocalError("Upload an image before saving alt text");
      return;
    }
    setLocalError(null);
    setError(null);
    startTransition(async () => {
      const res = await updateImageLesson({
        translationId: t.id,
        lessonId,
        imageUrl: t.imageUrl!,
        imageAlt: trimmed,
      });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onClear() {
    if (!confirm("Clear the image for this translation? You'll need to re-upload."))
      return;
    setLocalError(null);
    setError(null);
    setThumb(null);
    setAlt("");
    startTransition(async () => {
      const res = await clearImage({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onCopyEn() {
    setLocalError(null);
    setError(null);
    startTransition(async () => {
      const res = await copyImageFromEnglish({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const hasImage = !!t.imageUrl || !!thumb;

  return (
    <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm space-y-3">
      {hasImage ? (
        <>
          <div className="relative rounded-md overflow-hidden border border-zinc-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.imageUrl ?? thumb ?? ""}
              alt={alt || "Lesson image"}
              className="w-full max-h-64 object-contain bg-white"
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-700" />
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1.5">
              <ReplaceImageButton dropzone={dropzone} disabled={uploading || pending} />
              <button
                type="button"
                onClick={onClear}
                disabled={uploading || pending}
                className="rounded-md bg-white/90 backdrop-blur px-2 py-1 text-xs font-medium text-red-700 border border-zinc-200 hover:bg-white disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Alt text (required)
            </label>
            <div className="flex gap-2">
              <input
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Describe the image for screen readers and low-vision users"
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <button
                type="button"
                onClick={onSaveAlt}
                disabled={!altDirty || pending || uploading}
                className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div
            {...dropzone.getRootProps({
              className: cn(
                "rounded-md border-2 border-dashed transition-colors p-6",
                "flex flex-col items-center justify-center text-center cursor-pointer",
                dropzone.isDragActive
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-zinc-300 bg-white hover:border-zinc-400",
              ),
            })}
          >
            <input {...dropzone.getInputProps()} />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 mb-2">
              <ImageIcon className="h-4 w-4 text-zinc-700" />
            </div>
            <p className="text-sm font-medium text-zinc-900">
              {dropzone.isDragActive
                ? "Drop the image here"
                : "Drag an image, or click to choose"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              JPG, PNG, WebP, AVIF — up to 25MB.
            </p>
          </div>
          {!isEnglish && englishReady && (
            <button
              type="button"
              onClick={onCopyEn}
              disabled={uploading || pending}
              className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
            >
              Share English image
            </button>
          )}
          {!isEnglish && !englishReady && (
            <p className="text-xs text-zinc-500">
              Upload the English image first if you want to share it with this
              translation.
            </p>
          )}
        </div>
      )}
      {localError && (
        <p className="text-xs text-red-700">{localError}</p>
      )}
    </div>
  );
}

function ReplaceImageButton({
  dropzone,
  disabled,
}: {
  dropzone: ReturnType<typeof useDropzone>;
  disabled: boolean;
}) {
  return (
    <label
      {...dropzone.getRootProps({
        className: cn(
          "rounded-md bg-white/90 backdrop-blur px-2 py-1 text-xs font-medium text-zinc-700 border border-zinc-200 cursor-pointer hover:bg-white",
          disabled && "opacity-50 cursor-not-allowed",
        ),
      })}
    >
      Replace
      <input {...dropzone.getInputProps()} />
    </label>
  );
}

// ============================== CAROUSEL ===================================

type EditableSlide = CarouselSlide & {
  clientId: string;
  thumbnailDataUrl?: string;
  uploading?: boolean;
};

function CarouselMedia({
  lessonId,
  translation: t,
  englishReady,
  isEnglish,
  pending,
  startTransition,
  setError,
}: {
  lessonId: string;
  translation: Translation;
  englishReady: boolean;
  isEnglish: boolean;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  setError: (e: string | null) => void;
}) {
  const router = useRouter();
  const persisted: EditableSlide[] = (t.carouselSlides ?? []).map((s, i) => ({
    ...s,
    clientId: `persisted-${i}-${s.url}`,
  }));
  const [slides, setSlides] = useState<EditableSlide[]>(persisted);
  const [localError, setLocalError] = useState<string | null>(null);

  const persistedSig = JSON.stringify(
    (t.carouselSlides ?? []).map((s) => ({
      url: s.url,
      alt: s.alt,
      caption: s.caption,
    })),
  );
  const localSig = JSON.stringify(
    slides
      .filter((s) => !s.uploading && s.url)
      .map((s) => ({ url: s.url, alt: s.alt, caption: s.caption })),
  );
  const dirty = localSig !== persistedSig;
  const anyUploading = slides.some((s) => s.uploading);

  const onDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setLocalError(null);
    const placeholders: EditableSlide[] = files.map((f, i) => ({
      clientId: `new-${Date.now()}-${i}-${f.name}`,
      url: "",
      alt: "",
      uploading: true,
      thumbnailDataUrl: "",
    }));
    Promise.all(
      files.map(
        (f) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(typeof reader.result === "string" ? reader.result : "");
            reader.onerror = () => resolve("");
            reader.readAsDataURL(f);
          }),
      ),
    ).then((dataUrls) => {
      setSlides((prev) => {
        const next = [...prev];
        placeholders.forEach((p, i) => {
          const idx = next.findIndex((s) => s.clientId === p.clientId);
          if (idx >= 0) {
            next[idx] = { ...next[idx]!, thumbnailDataUrl: dataUrls[i] ?? "" };
          }
        });
        return next;
      });
    });
    setSlides((prev) => [...prev, ...placeholders]);
    (async () => {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const p = placeholders[i]!;
        try {
          const result = await uploadImageToServer(f);
          setSlides((prev) =>
            prev.map((s) =>
              s.clientId === p.clientId
                ? { ...s, url: result.url, uploading: false }
                : s,
            ),
          );
        } catch (err) {
          setSlides((prev) => prev.filter((s) => s.clientId !== p.clientId));
          setLocalError(
            err instanceof Error
              ? `Slide ${i + 1} (${f.name}): ${err.message}`
              : String(err),
          );
        }
      }
    })();
  }, []);

  const dropzone = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
    maxSize: 25 * 1024 * 1024,
    disabled: pending,
  });

  function updateSlide(clientId: string, patch: Partial<EditableSlide>) {
    setSlides((prev) =>
      prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)),
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

  function onSave() {
    const ready = slides.filter((s) => !s.uploading && s.url);
    if (ready.length < 1) {
      setLocalError("Add at least one slide before saving");
      return;
    }
    const missingAlt = ready.find((s) => !s.alt.trim());
    if (missingAlt) {
      setLocalError("Every slide needs alt text");
      return;
    }
    setLocalError(null);
    setError(null);
    const payload = ready.map((s) => ({
      url: s.url,
      alt: s.alt.trim(),
      caption: s.caption?.trim() || undefined,
    }));
    startTransition(async () => {
      const res = await updateCarouselLesson({
        translationId: t.id,
        lessonId,
        slides: payload,
      });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onResetLocal() {
    setSlides(persisted);
    setLocalError(null);
  }

  function onClear() {
    if (
      !confirm(
        "Clear all slides for this translation? You'll need to re-upload them.",
      )
    )
      return;
    setLocalError(null);
    setError(null);
    setSlides([]);
    startTransition(async () => {
      const res = await clearCarousel({ translationId: t.id, lessonId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function onCopyEn() {
    setLocalError(null);
    setError(null);
    startTransition(async () => {
      const res = await copyCarouselFromEnglish({
        translationId: t.id,
        lessonId,
      });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const isEmpty = slides.length === 0;

  return (
    <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm space-y-3">
      {!isEmpty && (
        <div className="space-y-2">
          {slides.map((slide, i) => (
            <div
              key={slide.clientId}
              className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-2.5"
            >
              <div className="relative shrink-0 h-16 w-16 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200">
                {(slide.url || slide.thumbnailDataUrl) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={slide.url || slide.thumbnailDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                {slide.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-700" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-xs text-zinc-500">
                  Slide {i + 1}
                  {slide.uploading && " · uploading…"}
                </div>
                <input
                  value={slide.alt}
                  onChange={(e) =>
                    updateSlide(slide.clientId, { alt: e.target.value })
                  }
                  placeholder="Alt text — short description of this slide"
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <input
                  value={slide.caption ?? ""}
                  onChange={(e) =>
                    updateSlide(slide.clientId, {
                      caption: e.target.value || undefined,
                    })
                  }
                  placeholder="Caption (optional)"
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveSlide(slide.clientId, "up")}
                  disabled={i === 0 || pending}
                  aria-label="Move up"
                  className="rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(slide.clientId, "down")}
                  disabled={i === slides.length - 1 || pending}
                  aria-label="Move down"
                  className="rounded p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeSlide(slide.clientId)}
                disabled={pending}
                aria-label={`Remove slide ${i + 1}`}
                className="shrink-0 rounded p-1 text-zinc-400 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        {...dropzone.getRootProps({
          className: cn(
            "rounded-md border-2 border-dashed transition-colors p-4",
            "flex flex-col items-center justify-center text-center cursor-pointer",
            dropzone.isDragActive
              ? "border-emerald-500 bg-emerald-50/50"
              : "border-zinc-300 bg-white hover:border-zinc-400",
          ),
        })}
      >
        <input {...dropzone.getInputProps()} />
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-50 border border-zinc-200 mb-2">
          <Plus className="h-4 w-4 text-zinc-700" />
        </div>
        <p className="text-xs font-medium text-zinc-900">
          {dropzone.isDragActive
            ? "Drop images to add slides"
            : isEmpty
              ? "Drag images here, or click to add slides"
              : "Add more slides"}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          You can drop several at once. JPG, PNG, WebP, AVIF — up to 25MB each.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || pending || anyUploading}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {dirty && !pending && (
          <button
            type="button"
            onClick={onResetLocal}
            disabled={pending}
            className="text-xs text-zinc-600 hover:underline disabled:opacity-50"
          >
            Discard changes
          </button>
        )}
        {!isEmpty && (
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="ml-auto text-xs text-red-700 hover:underline disabled:opacity-50"
          >
            Clear all
          </button>
        )}
        {isEmpty && !isEnglish && englishReady && (
          <button
            type="button"
            onClick={onCopyEn}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
          >
            Share English carousel
          </button>
        )}
      </div>

      {isEmpty && !isEnglish && !englishReady && (
        <p className="text-xs text-zinc-500">
          Upload the English carousel first if you want to share it with this
          translation.
        </p>
      )}
      {localError && <p className="text-xs text-red-700">{localError}</p>}
    </div>
  );
}
