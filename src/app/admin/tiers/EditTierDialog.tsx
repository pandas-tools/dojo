"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { updateTier } from "./actions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tier: { id: string; name: string; emoji: string; minPct: number };
};

export default function EditTierDialog({ open, onOpenChange, tier }: Props) {
  const router = useRouter();
  const [name, setName] = useState(tier.name);
  const [emoji, setEmoji] = useState(tier.emoji);
  const [pct, setPct] = useState(String(Math.round(tier.minPct * 100)));
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pctNum = Number(pct);
    if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
      toast.error("Threshold must be between 0 and 100");
      return;
    }
    startTransition(async () => {
      const res = await updateTier({
        id: tier.id,
        name,
        emoji,
        minPct: pctNum / 100,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Tier updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm" hideClose={pending}>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit tier</DialogTitle>
            <DialogDescription>
              The lowest tier must have a 0% threshold; each tier needs a
              distinct threshold.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3">
            <div className="w-20">
              <Label htmlFor="et-emoji">Emoji</Label>
              <Input
                id="et-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                required
                maxLength={8}
                className="text-center"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="et-name">Name</Label>
              <Input
                id="et-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                maxLength={40}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="et-pct">Threshold %</Label>
            <Input
              id="et-pct"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !name.trim() || !emoji.trim() || pct === ""}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
