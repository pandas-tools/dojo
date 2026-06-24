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
import { createTier } from "./actions";

export default function NewTierDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [pct, setPct] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setEmoji("");
    setPct("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pctNum = Number(pct);
    if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
      toast.error("Threshold must be between 0 and 100");
      return;
    }
    startTransition(async () => {
      const res = await createTier({
        name,
        emoji,
        minPct: pctNum / 100,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created "${name.trim()}"`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  function onOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New tier
      </Button>
      <DialogContent size="sm" hideClose={pending}>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New tier</DialogTitle>
            <DialogDescription>
              A rung on the browse ladder. The lowest tier must have a 0%
              threshold; each tier needs a distinct threshold.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3">
            <div className="w-20">
              <Label htmlFor="nt-emoji">Emoji</Label>
              <Input
                id="nt-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🌱"
                required
                maxLength={8}
                className="text-center"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="nt-name">Name</Label>
              <Input
                id="nt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apprentice"
                required
                autoFocus
                maxLength={40}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="nt-pct">Threshold %</Label>
            <Input
              id="nt-pct"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="0"
              required
            />
            <p className="mt-1 text-xs text-zinc-500">
              Percent of assigned lessons completed to reach this tier.
            </p>
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
            <Button
              type="submit"
              disabled={pending || !name.trim() || !emoji.trim() || pct === ""}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create tier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
