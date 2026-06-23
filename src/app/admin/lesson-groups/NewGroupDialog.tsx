"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
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
import { createGroup } from "./actions";

export default function NewGroupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createGroup({ name });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created "${name.trim()}"`);
      setOpen(false);
      setName("");
      router.push(`/admin/lesson-groups/${res.groupId}`);
      router.refresh();
    });
  }

  function onOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) setName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New group
      </Button>
      <DialogContent size="sm" hideClose={pending}>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>
              A named editorial section, e.g. &ldquo;Managing the store&rdquo;.
              Assign lessons and order them after creating.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="ng-name">Name</Label>
            <Input
              id="ng-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Managing the store"
              required
              autoFocus
              maxLength={80}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
