"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DocChecklistStatus } from "@/lib/db";

type DashInitiative = { id: number; name: string; pic: string };
type DashApplication = { id: number; name: string; initiatives: DashInitiative[] };
type DashStream = { id: number; name: string; applications: DashApplication[] };

type DocumentType = { id: number; name: string; sort_order: number };

type ChecklistEntry = {
  initiative_id: number;
  document_type_id: number;
  status: DocChecklistStatus;
};

const CYCLE: DocChecklistStatus[] = ["not_started", "in_progress", "done", "not_applicable"];

const STATUS_STYLE: Record<DocChecklistStatus, string> = {
  not_started: "bg-transparent border-dashed",
  in_progress: "bg-blue-300 dark:bg-blue-800/70",
  done: "bg-green-400 dark:bg-green-600/80",
  not_applicable: "bg-slate-200 dark:bg-slate-700",
};

const STATUS_LABEL: Record<DocChecklistStatus, string> = {
  not_started: "Belum mulai",
  in_progress: "In Progress",
  done: "Selesai",
  not_applicable: "N/A",
};

const STATUS_ABBR: Record<DocChecklistStatus, string> = {
  not_started: "",
  in_progress: "…",
  done: "✓",
  not_applicable: "N/A",
};

const POLL_INTERVAL_MS = 8000;

export default function DocumentsPage() {
  const [streams, setStreams] = useState<DashStream[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [entries, setEntries] = useState<Map<string, DocChecklistStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showManager, setShowManager] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashRes, typesRes, entriesRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/document-types", { cache: "no-store" }),
        fetch("/api/documents", { cache: "no-store" }),
      ]);
      if (dashRes.ok) setStreams((await dashRes.json()).streams ?? []);
      if (typesRes.ok) setDocumentTypes((await typesRes.json()).documentTypes ?? []);
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        const map = new Map<string, DocChecklistStatus>();
        for (const e of (data.entries ?? []) as ChecklistEntry[]) {
          map.set(`${e.initiative_id}-${e.document_type_id}`, e.status);
        }
        setEntries(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function cycleCell(initiativeId: number, documentTypeId: number) {
    const key = `${initiativeId}-${documentTypeId}`;
    const current = entries.get(key) ?? "not_started";
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];

    setEntries((prev) => new Map(prev).set(key, next));
    await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initiativeId, documentTypeId, status: next }),
    });
  }

  const q = query.trim().toLowerCase();
  const filteredStreams = streams
    .map((stream) => ({
      ...stream,
      applications: stream.applications
        .map((app) => ({
          ...app,
          initiatives: app.initiatives.filter((init) => {
            if (!q) return true;
            return (
              init.name.toLowerCase().includes(q) ||
              init.pic.toLowerCase().includes(q) ||
              app.name.toLowerCase().includes(q)
            );
          }),
        }))
        .filter((app) => app.initiatives.length > 0),
    }))
    .filter((stream) => stream.applications.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Document Readiness Checklist</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Klik tiap sel untuk ganti status — siklus: Belum mulai → In Progress → Selesai → N/A.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowManager((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Kelola Dokumen
          </button>
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
            href="/actions"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Action Items
          </Link>
          <Link
            href="/timeline"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Timeline
          </Link>
          <Link
            href="/report"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Weekly Report
          </Link>
          <Link
            href="/input"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            + Input Update
          </Link>
        </div>
      </header>

      {showManager && (
        <DocumentTypeManager documentTypes={documentTypes} onChanged={load} />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari initiative, application, atau PIC…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {(Object.keys(STATUS_LABEL) as DocChecklistStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded border border-slate-300 dark:border-slate-600 ${STATUS_STYLE[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat checklist…</p>
      ) : documentTypes.length === 0 ? (
        <p className="text-sm text-slate-500">
          Belum ada jenis dokumen. Tambahkan lewat &quot;Kelola Dokumen&quot;.
        </p>
      ) : filteredStreams.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada initiative yang cocok.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredStreams.map((stream) => (
            <details
              key={stream.id}
              open
              className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <summary className="cursor-pointer px-4 py-3 text-lg font-semibold">
                {stream.name}
              </summary>
              <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-3 py-2">App</th>
                      <th className="px-3 py-2">Initiative</th>
                      {documentTypes.map((dt) => (
                        <th key={dt.id} className="w-20 px-1 py-2 text-center">
                          {dt.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stream.applications.map((app) =>
                      app.initiatives.map((init) => (
                        <tr
                          key={init.id}
                          className="border-b border-slate-100 dark:border-slate-800"
                        >
                          <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                            {app.name}
                          </td>
                          <td className="px-3 py-1.5 font-medium">{init.name}</td>
                          {documentTypes.map((dt) => {
                            const status =
                              entries.get(`${init.id}-${dt.id}`) ?? "not_started";
                            return (
                              <td key={dt.id} className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => cycleCell(init.id, dt.id)}
                                  title={STATUS_LABEL[status]}
                                  className={`h-7 w-14 rounded border border-slate-200 text-xs font-semibold dark:border-slate-700 ${STATUS_STYLE[status]}`}
                                >
                                  {STATUS_ABBR[status]}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}

function DocumentTypeManager({
  documentTypes,
  onChanged,
}: {
  documentTypes: DocumentType[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  async function addType() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  async function move(id: number, direction: "up" | "down") {
    await fetch(`/api/document-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction }),
    });
    onChanged();
  }

  async function archive(id: number) {
    await fetch(`/api/document-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    onChanged();
  }

  async function rename(id: number) {
    if (!editingName.trim()) return;
    await fetch(`/api/document-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    setEditingId(null);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold">Kelola Jenis Dokumen</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Jenis dokumen yang wajib dilacak (mis. Project Charter, PRD, RNI) bisa ditambah,
        diganti nama, diurutkan ulang, atau diarsipkan kapan saja — tidak perlu ubah kode.
      </p>
      <div className="flex flex-col gap-2">
        {documentTypes.map((dt, idx) => (
          <div key={dt.id} className="flex items-center gap-2">
            {editingId === dt.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => rename(dt.id)}
                  className="text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-sm text-slate-500"
                >
                  Batal
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{dt.name}</span>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(dt.id, "up")}
                  className="text-sm disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === documentTypes.length - 1}
                  onClick={() => move(dt.id, "down")}
                  className="text-sm disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(dt.id);
                    setEditingName(dt.name);
                  }}
                  className="text-sm text-slate-500 underline"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => archive(dt.id)}
                  className="text-sm text-red-600 underline dark:text-red-400"
                >
                  Arsipkan
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama dokumen baru (mis. UAT Sign-off)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={addType}
          disabled={submitting || !name.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          Tambah
        </button>
      </div>
    </div>
  );
}
