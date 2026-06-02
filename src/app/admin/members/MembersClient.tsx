"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdmin, removeAdmin } from "./actions";

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
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addAdmin({ email });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEmail("");
      router.refresh();
    });
  }

  function onRemove(userId: string) {
    if (
      !confirm(
        "Remove this admin? They will lose access on their next sign-in.",
      )
    )
      return;
    setBusyId(userId);
    setError(null);
    startTransition(async () => {
      const res = await removeAdmin({ userId });
      if (res?.error) setError(res.error);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">Add admin</h2>
        <form
          onSubmit={onAdd}
          className="flex flex-col gap-2 sm:flex-row sm:items-end rounded-md border border-zinc-200 bg-white p-4"
        >
          <label className="flex-1">
            <span className="block text-xs font-medium text-zinc-700 mb-1">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="newadmin@pandas.io"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
          >
            {pending ? "Adding…" : "Add admin"}
          </button>
        </form>
        {error && (
          <p className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">
          Current admins
        </h2>
        <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
          {admins.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No admins yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {admins.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {a.email}
                      {a.self && (
                        <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                          you
                        </span>
                      )}
                      {a.fromEnv && (
                        <span className="ml-2 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs text-amber-800">
                          bootstrap (env)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      added {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={a.self || pending}
                    onClick={() => onRemove(a.id)}
                    className="text-sm text-red-700 hover:underline disabled:text-zinc-300 disabled:cursor-not-allowed"
                  >
                    {busyId === a.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Bootstrap admins (those listed in the ADMIN_ALLOWLIST environment
          variable) will be re-created on their next sign-in even after
          removal here. To fully remove a bootstrap admin, also edit the env
          var on the host.
        </p>
      </section>
    </div>
  );
}
