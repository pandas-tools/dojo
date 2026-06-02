"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { addAdmin, removeAdmin } from "./actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

type AdminRow = {
  id: string;
  email: string;
  createdAt: string;
  self: boolean;
  fromEnv: boolean;
};

export default function MembersClient({ admins }: { admins: AdminRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addAdmin({ email });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added ${email}`);
      setEmail("");
      router.refresh();
    });
  }

  function onRemove(userId: string, userEmail: string) {
    if (!confirm(`Remove ${userEmail} as admin?`)) return;
    setBusyId(userId);
    startTransition(async () => {
      const res = await removeAdmin({ userId });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Removed ${userEmail}`);
      }
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Add admin</CardTitle>
            <CardDescription>
              They&apos;ll get admin access on their next magic-link sign-in.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={onAdd}
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <div>
              <Label htmlFor="add-admin-email">Email</Label>
              <Input
                id="add-admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="newadmin@pandas.io"
              />
            </div>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add admin
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Current admins</CardTitle>
            <CardDescription>
              Bootstrap admins are seeded by the ADMIN_ALLOWLIST env var on the
              host. Removing them here is effective until they sign in again —
              edit the env var to fully revoke.
            </CardDescription>
          </div>
        </CardHeader>
        {admins.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No admins yet"
            description="Add the first admin via the form above."
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {admins.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {a.email}
                    </p>
                    {a.self && <Badge variant="neutral">you</Badge>}
                    {a.fromEnv && <Badge variant="warning">bootstrap</Badge>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    added {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={a.self || pending}
                  onClick={() => onRemove(a.id, a.email)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {busyId === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
