"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addStore,
  deleteStore,
  importStoresCsv,
  updateStore,
} from "./stores-actions";

type StoreRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  externalId: string | null;
  isActive: boolean;
};

const CELL_INPUT =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

export default function StoresManager({
  clientId,
  stores,
}: {
  clientId: string;
  stores: StoreRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual add form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [externalId, setExternalId] = useState("");

  // CSV form
  const [csv, setCsv] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    name: "",
    address: "",
    city: "",
    countryCode: "",
    externalId: "",
    isActive: true,
  });

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await addStore({
        clientId,
        name,
        address: address || undefined,
        city: city || undefined,
        countryCode: country || undefined,
        externalId: externalId || undefined,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setName("");
      setAddress("");
      setCity("");
      setCountry("");
      setExternalId("");
      setSuccess("Store added.");
      router.refresh();
    });
  }

  function onImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await importStoresCsv({ clientId, csv });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const parts: string[] = [`Imported ${res.inserted}`];
      if (res.skipped > 0) parts.push(`skipped ${res.skipped} (external_id already exists)`);
      if (res.errors.length > 0)
        parts.push(`${res.errors.length} row error${res.errors.length === 1 ? "" : "s"}`);
      setSuccess(parts.join(" · "));
      if (res.errors.length > 0) {
        setError(res.errors.slice(0, 5).join("\n"));
      }
      if (res.inserted > 0) {
        setCsv("");
        router.refresh();
      }
    });
  }

  function startEdit(s: StoreRow) {
    setError(null);
    setSuccess(null);
    setEditingId(s.id);
    setEdit({
      name: s.name,
      address: s.address ?? "",
      city: s.city ?? "",
      countryCode: s.countryCode ?? "",
      externalId: s.externalId ?? "",
      isActive: s.isActive,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function onSaveEdit(storeId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await updateStore({
        storeId,
        clientId,
        name: edit.name,
        address: edit.address,
        city: edit.city,
        countryCode: edit.countryCode,
        externalId: edit.externalId,
        isActive: edit.isActive,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setEditingId(null);
      setSuccess("Store updated.");
      router.refresh();
    });
  }

  function onDelete(storeId: string, storeName: string) {
    if (!confirm(`Delete store "${storeName}"? Employees assigned to it will be unlinked.`)) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await deleteStore({ clientId, storeId });
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "manual"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          Add manually
        </button>
        <button
          type="button"
          onClick={() => setTab("csv")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "csv"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          Import CSV
        </button>
      </div>

      {tab === "manual" ? (
        <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-6 rounded-md border border-zinc-200 bg-white p-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Orange Antwerp Central"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Meir 78"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Antwerp"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Country (ISO)
            </label>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="BE"
              maxLength={2}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm uppercase focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              External ID
            </label>
            <input
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="A001"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="sm:col-span-6 flex justify-end">
            <button
              type="submit"
              disabled={pending || !name}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
            >
              {pending ? "Adding…" : "Add store"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onImport} className="space-y-3 rounded-md border border-zinc-200 bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Paste CSV
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              Header row is optional. Recognized columns:{" "}
              <code className="font-mono">name</code> (required),{" "}
              <code className="font-mono">address</code>,{" "}
              <code className="font-mono">city</code>,{" "}
              <code className="font-mono">country_code</code>,{" "}
              <code className="font-mono">external_id</code>. Rows with an{" "}
              <code className="font-mono">external_id</code> already present
              for this client are skipped — re-running is safe.
            </p>
            <textarea
              required
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              placeholder={`name,address,city,country_code,external_id\nOrange Antwerp Central,Meir 78,Antwerp,BE,A001\nOrange Brussels Midi,Rue du Midi 12,Brussels,BE,A002`}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || !csv}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
            >
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
      )}

      {success && (
        <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}
      {error && (
        <pre className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {error}
        </pre>
      )}

      <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
        {stores.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">No stores yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">External ID</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) =>
                editingId === s.id ? (
                  <tr key={s.id} className="border-t border-zinc-200 bg-zinc-50/60">
                    <td className="px-3 py-2 align-top">
                      <input
                        value={edit.name}
                        onChange={(e) =>
                          setEdit((v) => ({ ...v, name: e.target.value }))
                        }
                        placeholder="Name"
                        className={CELL_INPUT}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={edit.address}
                        onChange={(e) =>
                          setEdit((v) => ({ ...v, address: e.target.value }))
                        }
                        placeholder="Address"
                        className={CELL_INPUT}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={edit.city}
                        onChange={(e) =>
                          setEdit((v) => ({ ...v, city: e.target.value }))
                        }
                        placeholder="City"
                        className={CELL_INPUT}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={edit.countryCode}
                        onChange={(e) =>
                          setEdit((v) => ({ ...v, countryCode: e.target.value }))
                        }
                        placeholder="BE"
                        maxLength={2}
                        className={`${CELL_INPUT} uppercase`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={edit.externalId}
                        onChange={(e) =>
                          setEdit((v) => ({ ...v, externalId: e.target.value }))
                        }
                        placeholder="A001"
                        className={CELL_INPUT}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={edit.isActive}
                        onChange={(e) =>
                          setEdit((v) => ({ ...v, isActive: e.target.checked }))
                        }
                        aria-label="Active"
                        className="h-4 w-4 accent-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSaveEdit(s.id)}
                        disabled={pending || !edit.name.trim()}
                        className="text-xs font-medium text-zinc-900 hover:underline disabled:opacity-50"
                      >
                        {pending ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={pending}
                        className="ml-3 text-xs text-zinc-500 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className="border-t border-zinc-200">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-zinc-600">{s.address ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-600">{s.city ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-xs">
                      {s.countryCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-xs">
                      {s.externalId ?? "—"}
                    </td>
                    <td className="px-3 py-2">{s.isActive ? "✓" : "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        disabled={pending}
                        className="text-xs text-zinc-700 hover:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(s.id, s.name)}
                        disabled={pending}
                        className="ml-3 text-xs text-red-700 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
