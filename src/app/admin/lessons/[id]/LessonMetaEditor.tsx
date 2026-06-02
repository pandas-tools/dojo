"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLesson } from "../actions";

type LessonType = "training" | "announcement" | "update";

type Props = {
  lessonId: string;
  initialInternalName: string;
  initialType: LessonType;
};

const TYPES: { value: LessonType; label: string }[] = [
  { value: "training", label: "Training" },
  { value: "announcement", label: "Announcement" },
  { value: "update", label: "Update" },
];

export default function LessonMetaEditor({
  lessonId,
  initialInternalName,
  initialType,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [internalName, setInternalName] = useState(initialInternalName);
  const [type, setType] = useState<LessonType>(initialType);

  const dirty =
    internalName.trim() !== initialInternalName || type !== initialType;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateLesson({
        lessonId,
        internalName: internalName.trim(),
        type,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="flex-1">
        <span className="block text-xs font-medium text-zinc-700 mb-1">
          Internal name
        </span>
        <input
          value={internalName}
          onChange={(e) => setInternalName(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-zinc-700 mb-1">
          Type
        </span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as LessonType)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!dirty || pending || !internalName.trim()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {error && (
        <p className="text-sm text-red-700 sm:ml-3">{error}</p>
      )}
    </form>
  );
}
