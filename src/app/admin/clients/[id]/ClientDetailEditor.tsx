"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateClient } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Client = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
};

export default function ClientDetailEditor({ client }: { client: Client }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(client.name);
  const [slug, setSlug] = useState(client.slug);
  const [isActive, setIsActive] = useState(client.isActive);
  const dirty =
    name !== client.name ||
    slug !== client.slug ||
    isActive !== client.isActive;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateClient({
        id: client.id,
        name: name !== client.name ? name : undefined,
        slug: slug !== client.slug ? slug : undefined,
        isActive: isActive !== client.isActive ? isActive : undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Client updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="client-name">Name</Label>
          <Input
            id="client-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="client-slug">Slug</Label>
          <Input
            id="client-slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2.5 bg-zinc-50">
        <div>
          <Label htmlFor="client-active" className="mb-0 text-sm text-zinc-900">
            Active
          </Label>
          <p className="text-xs text-zinc-500">
            Inactive clients still exist but their employees can&apos;t sign in.
          </p>
        </div>
        <Switch
          id="client-active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
