"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateLesson } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LessonType = "training" | "announcement" | "update";

type Props = {
  lessonId: string;
  initialInternalName: string;
  initialType: LessonType;
};

export default function LessonMetaEditor({
  lessonId,
  initialInternalName,
  initialType,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [internalName, setInternalName] = useState(initialInternalName);
  const [type, setType] = useState<LessonType>(initialType);

  const dirty =
    internalName.trim() !== initialInternalName || type !== initialType;

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateLesson({
        lessonId,
        internalName: internalName.trim(),
        type,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Lesson metadata saved");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={save}
      className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
    >
      <div>
        <Label htmlFor="meta-name">Internal name</Label>
        <Input
          id="meta-name"
          value={internalName}
          onChange={(e) => setInternalName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="meta-type">Type</Label>
        <Select
          value={type}
          onValueChange={(v) => setType(v as LessonType)}
        >
          <SelectTrigger id="meta-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="training">Training</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
            <SelectItem value="update">Update</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        type="submit"
        disabled={!dirty || pending || !internalName.trim()}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save
      </Button>
    </form>
  );
}
