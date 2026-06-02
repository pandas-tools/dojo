"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteLesson } from "../actions";

export default function DeleteLessonButton({
  lessonId,
  lessonName,
}: {
  lessonId: string;
  lessonName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const canDelete = confirmText.trim() === lessonName && !pending;

  function onDelete() {
    startTransition(async () => {
      const res = await deleteLesson(lessonId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Lesson "${lessonName}" deleted`);
      setOpen(false);
      router.push("/admin/lessons");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete lesson
      </Button>
      <DialogContent size="sm" hideClose={pending}>
        <DialogHeader>
          <DialogTitle>Delete this lesson?</DialogTitle>
          <DialogDescription>
            This permanently removes the lesson, its translations, its
            assignments, and any completions tied to it. Cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="confirm-delete">
            Type{" "}
            <span className="font-mono text-zinc-900">{lessonName}</span> to
            confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={lessonName}
            autoComplete="off"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete}
            onClick={onDelete}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
