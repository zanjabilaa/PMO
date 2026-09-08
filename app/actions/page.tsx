"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ActionItemStatus } from "@/lib/db";

type ActionItem = {
  id: number;
  initiative_id: number;
  description: string;
  owner: string;
  due_date: string | null;
  status: ActionItemStatus;
  source: string;
  created_at: string;
};

type DashInitiative = { id: number; name: string };
type DashApplication = { id: number; name: string; initiatives: DashInitiative[] };
type DashStream = { id: number; name: string; applications: DashApplication[] };

type InitiativeOption = { id: number; label: string };

const STATUS_LABEL: Record<ActionItemStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_STYLE: Record<ActionItemStatus, string> = {
  open: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  in_progress: "bg-blue-200 text-blue-900 dark:bg-blue-500/30 dark:text-blue-200",
  done: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-200",
};

const STATUS_CYCLE: ActionItemStatus[] = ["open", "in_progress", "done"];

const POLL_INTERVAL_MS = 8000;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(item: ActionItem): boolean {
  return item.status !== "done" && !!item.due_date && item.due_date < today();
}

export default function ActionItemsPage() {
  const [streams, setStreams] = useState<DashStream[]>([]);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ActionItemStatus | "overdue" | "all">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const [dashRes, itemsRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/action-items", { cache: "no-store" }),
      ]);
      if (dashRes.ok) setStreams((await dashRes.json()).streams ?? []);
      if (itemsRes.ok) setItems((await itemsRes.json()).items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const initiativeOptions: InitiativeOption[] = useMemo(
    () =>
      streams.flatMap((s) =>
        s.applications.flatMap((a) =>
          a.initiatives.map((i) => ({ id: i.id, label: `${i.name} — ${a.name} (${s.name})` }))
        )
      ),
    [streams]
  );

  const initiativeLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const opt of initiativeOptions) map.set(opt.id, opt.label);
    return map;
  }, [initiativeOptions]);

  async function cycleStatus(item: ActionItem) {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length];
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: next } : it)));
    await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function removeItem(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/action-items/${id}`, { method: "DELETE" });
  }

  const q = query.trim().toLowerCase();
  const filteredItems = items
    .filter((it) => {
      if (statusFilter === "overdue") return isOverdue(it);
      if (statusFilter !== "all") return it.status === statusFilter;
      return true;
    })
    .filter((it) => {
      if (!q) return true;
      const label = initiativeLabelById.get(it.initiative_id) ?? "";
      return (
        it.description.toLowerCase().includes(q) ||
        it.owner.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q)
      );
    });

  const overdueCount = items.filter(isOverdue).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Action Item Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {items.length} action item · {overdueCount} overdue
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Ke Dashboard
          </Link>
          <Link
            href="/risks"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Risk Register
          </Link>
          <Link
            href="/documents"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Documents
          </Link>
          <Link
            href="/timeline"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Timeline
          </Link>
          <Link
            href="/input"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            + Input Update
          </Link>
        </div>
      </header>

      <AddActionItemForm initiativeOptions={initiativeOptions} onAdded={load} />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari action item, owner, atau initiative…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "open", "in_progress", "done", "overdue"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                s === "overdue"
                  ? "bg-orange-200 text-orange-900 dark:bg-orange-500/30 dark:text-orange-200"
                  : s === "all"
                    ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                    : STATUS_STYLE[s]
              } ${statusFilter === s ? "ring-2 ring-slate-900 dark:ring-slate-100" : "opacity-60"}`}
            >
              {s === "all" ? "Semua" : s === "overdue" ? "Overdue" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat action items…</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada action item yang cocok.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-3 py-2">Initiative</th>
                <th className="px-3 py-2">Action Item</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-100 align-top dark:border-slate-800"
                >
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {initiativeLabelById.get(item.initiative_id) ?? `#${item.initiative_id}`}
                  </td>
                  <td className="max-w-xs whitespace-pre-wrap px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2">{item.owner || "—"}</td>
                  <td
                    className={`px-3 py-2 ${isOverdue(item) ? "font-semibold text-red-600 dark:text-red-400" : ""}`}
                  >
                    {item.due_date ?? "—"}
                    {isOverdue(item) && <span className="ml-1">⚠</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {item.source || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => cycleStatus(item)}
                      title="Klik untuk ganti status"
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-red-600 underline dark:text-red-400"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function AddActionItemForm({
  initiativeOptions,
  onAdded,
}: {
  initiativeOptions: InitiativeOption[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [initiativeId, setInitiativeId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!initiativeId || !description.trim()) {
      setError("Pilih initiative dan isi deskripsi action item.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiativeId,
          description: description.trim(),
          owner: owner.trim(),
          dueDate: dueDate || null,
          source: source.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan action item.");
      }
      setDescription("");
      setOwner("");
      setDueDate("");
      setSource("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan action item.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
      >
        + Tambah Action Item
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tambah Action Item</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">
          Tutup
        </button>
      </div>
      <select
        value={initiativeId ?? ""}
        onChange={(e) => setInitiativeId(Number(e.target.value) || null)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="" disabled>
          Pilih initiative
        </option>
        {initiativeOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Deskripsi action item (mis. hasil dari meeting notes)"
        rows={2}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner / PIC"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (mis. Meeting 5 Sep)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {submitting ? "Menyimpan…" : "Simpan"}
      </button>
    </div>
  );
}
