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
import { createClient } from "./actions";

export default function NewClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createClient({ name, slug: slug || undefined });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created ${name}`);
      setOpen(false);
      setName("");
      setSlug("");
      if (res?.clientId) {
        router.push(`/admin/clients/${res.clientId}`);
        router.refresh();
      }
    });
  }

  function onOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) {
      setName("");
      setSlug("");
    }
  }

  // Auto-derive slug as user types name, unless they've edited it manually
  const [slugDirty, setSlugDirty] = useState(false);
  function onNameChange(v: string) {
    setName(v);
    if (!slugDirty) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-+|-+$)/g, ""),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New client
      </Button>
      <DialogContent size="sm" hideClose={pending}>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
            <DialogDescription>
              The slug is auto-derived from the name. You can configure
              domains, stores, and languages after creating.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="nc-name">Name</Label>
              <Input
                id="nc-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Orange Belgium"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="nc-slug">Slug</Label>
              <Input
                id="nc-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugDirty(true);
                }}
                placeholder="orange-belgium"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Lowercase, dash-separated. Used in URLs.
              </p>
            </div>
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
              Create client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
