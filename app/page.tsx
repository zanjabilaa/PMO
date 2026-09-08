"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Rag } from "@/lib/db";
import { parseTrackerWorkbook } from "@/lib/excel-import";

type Update = {
  id: number;
  period_label: string;
  rag: Rag;
  key_highlight: string;
  progress_last_2wk: string;
  plan_next_2wk: string;
  risk_issue: string;
  unlocking_needed: string;
  created_at: string;
};

type DashInitiative = {
  id: number;
  name: string;
  pic: string;
  current_rag: Rag;
  current_phase: string;
  latestUpdate: Update | null;
  previousRag: Rag | null;
  updateCount: number;
  openActionItems: number;
  overdueActionItems: number;
  docsDone: number;
  docsTotal: number;
};

type DashApplication = {
  id: number;
  name: string;
  initiatives: DashInitiative[];
};

type DashStream = {
  id: number;
  name: string;
  sort_order: number;
  applications: DashApplication[];
};

const RAG_STYLE: Record<Rag, string> = {
  green: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-200",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
  red: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200",
};

const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red" };

const RAG_SEVERITY: Record<Rag, number> = { green: 0, amber: 1, red: 2 };

const POLL_INTERVAL_MS = 8000;

// Update cadence is biweekly (14 days); anything past this without a fresh
// update is flagged so it doesn't silently go quiet on the dashboard.
const STALE_DAYS = 21;

function countInitiatives(streams: DashStream[]) {
  return streams.reduce(
    (sum, s) => sum + s.applications.reduce((a, app) => a + app.initiatives.length, 0),
    0
  );
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function isStale(initiative: DashInitiative): boolean {
  return !initiative.latestUpdate || daysSince(initiative.latestUpdate.created_at) > STALE_DAYS;
}

function allInitiatives(streams: DashStream[]): DashInitiative[] {
  return streams.flatMap((s) => s.applications.flatMap((a) => a.initiatives));
}

export default function DashboardPage() {
  const [streams, setStreams] = useState<DashStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [ragFilter, setRagFilter] = useState<Rag | "all">("all");
  const [query, setQuery] = useState("");
  const [showStreamManager, setShowStreamManager] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStreams(data.streams ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const q = query.trim().toLowerCase();

  const filteredStreams = streams
    .map((stream) => ({
      ...stream,
      applications: stream.applications
        .map((app) => ({
          ...app,
          initiatives: app.initiatives.filter((init) => {
            if (ragFilter !== "all" && (init.latestUpdate?.rag ?? "green") !== ragFilter) {
              return false;
            }
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">PMO Assistant — Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {countInitiatives(streams)} initiative dilacak di {streams.length} stream.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowStreamManager((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
          >
            Kelola Stream
          </button>
          <ExportButton streams={filteredStreams} />
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

      {streams.length > 0 && <PortfolioSummary streams={streams} />}

      {showStreamManager && (
        <StreamManager streams={streams} onChanged={load} />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari initiative, application, atau PIC…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800"
        />
        <div className="flex gap-1.5">
          {(["all", "green", "amber", "red"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRagFilter(r)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                r === "all"
                  ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                  : RAG_STYLE[r]
              } ${ragFilter === r ? "ring-2 ring-slate-900 dark:ring-slate-100" : "opacity-60"}`}
            >
              {r === "all" ? "Semua" : RAG_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat dashboard…</p>
      ) : streams.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-600">
          <p>
            Belum ada stream. Isi otomatis dari data tracker Excel, atau mulai dari{" "}
            <Link href="/input" className="underline">
              Input Update
            </Link>
            .
          </p>
          <SeedButton onDone={load} />
        </div>
      ) : filteredStreams.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada initiative yang cocok dengan filter.</p>
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
              <div className="flex flex-col gap-4 border-t border-slate-200 p-4 dark:border-slate-700">
                {stream.applications.map((app) => (
                  <div key={app.id}>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {app.name}
                    </h3>
                    <div className="flex flex-col gap-3">
                      {app.initiatives.map((init) => (
                        <InitiativeCard key={init.id} initiative={init} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}

function RagTrend({ current, previous }: { current: Rag; previous: Rag | null }) {
  if (!previous || previous === current) return null;
  const worse = RAG_SEVERITY[current] > RAG_SEVERITY[previous];
  return (
    <span
      title={`Sebelumnya: ${RAG_LABEL[previous]} → sekarang ${RAG_LABEL[current]}`}
      className={`text-xs font-bold ${worse ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
    >
      {worse ? "▲" : "▼"}
    </span>
  );
}

function InitiativeCard({ initiative }: { initiative: DashInitiative }) {
  const u = initiative.latestUpdate;
  const stale = isStale(initiative);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Update[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function toggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    if (history !== null) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/updates?initiativeId=${initiative.id}`, { cache: "no-store" });
      const data = await res.json();
      setHistory(((data.updates ?? []) as Update[]).slice(1));
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{initiative.name}</span>
          {initiative.pic && (
            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
              — {initiative.pic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {initiative.current_phase ? (
            <>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {initiative.current_phase}
              </span>
              <span
                title="Status tracker (Excel)"
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RAG_STYLE[initiative.current_rag]}`}
              >
                Tracker: {RAG_LABEL[initiative.current_rag]}
              </span>
            </>
          ) : (
            <span
              title="Belum pernah disinkronkan dari Excel tracker"
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500"
            >
              Belum ada data tracker
            </span>
          )}
          {u ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{u.period_label}</span>
              <RagTrend current={u.rag} previous={initiative.previousRag} />
              <span
                title="RAG update biweekly"
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RAG_STYLE[u.rag]}`}
              >
                {RAG_LABEL[u.rag]}
              </span>
            </span>
          ) : (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Belum ada update
            </span>
          )}
          {stale && (
            <span
              title="Tidak ada update baru dalam >21 hari — cek dengan PIC"
              className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-500/20 dark:text-orange-300"
            >
              ⏱ Belum update
            </span>
          )}
          {initiative.updateCount > 0 && (
            <button
              type="button"
              onClick={toggleHistory}
              className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {showHistory ? "Sembunyikan" : `Riwayat (${initiative.updateCount})`}
            </button>
          )}
          {initiative.openActionItems > 0 && (
            <Link
              href="/actions"
              title={`${initiative.openActionItems} action item terbuka, ${initiative.overdueActionItems} overdue`}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                initiative.overdueActionItems > 0
                  ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              ☑ {initiative.openActionItems}
              {initiative.overdueActionItems > 0 ? ` (${initiative.overdueActionItems} overdue)` : ""}
            </Link>
          )}
          {initiative.docsTotal > 0 && (
            <Link
              href="/documents"
              title="Document readiness"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                initiative.docsDone === initiative.docsTotal
                  ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              📄 {initiative.docsDone}/{initiative.docsTotal}
            </Link>
          )}
          <Link
            href={`/input?initiativeId=${initiative.id}`}
            className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Edit
          </Link>
        </div>
      </div>
      {u && (
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Field label="Key Highlight" value={u.key_highlight} />
          <Field label="Progress Last 2 Weeks" value={u.progress_last_2wk} />
          <Field label="Plan Next 2 Weeks" value={u.plan_next_2wk} />
          <Field label="Risk / Issue" value={u.risk_issue} />
          <Field label="Unlocking Needed" value={u.unlocking_needed} className="sm:col-span-2" />
        </dl>
      )}
      {showHistory && (
        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          {loadingHistory ? (
            <p className="text-xs text-slate-400">Memuat riwayat…</p>
          ) : history && history.length > 0 ? (
            history.map((h) => (
              <div key={h.id} className="rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {h.period_label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${RAG_STYLE[h.rag]}`}>
                    {RAG_LABEL[h.rag]}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-400">
                  {h.key_highlight || "—"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">Belum ada update periode sebelumnya.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{value || "—"}</dd>
    </div>
  );
}

function PortfolioSummary({ streams }: { streams: DashStream[] }) {
  const initiatives = allInitiatives(streams);
  const total = initiatives.length;
  const counts: Record<Rag, number> = { green: 0, amber: 0, red: 0 };
  let noUpdate = 0;
  let stale = 0;
  let overdueActions = 0;
  for (const init of initiatives) {
    if (init.latestUpdate) counts[init.latestUpdate.rag]++;
    else noUpdate++;
    if (isStale(init)) stale++;
    overdueActions += init.overdueActionItems;
  }
  const onTrackPct = total > 0 ? Math.round((counts.green / total) * 100) : 0;

  const tiles: { label: string; value: number; className: string; title?: string }[] = [
    {
      label: "Total Initiative",
      value: total,
      className: "text-slate-900 dark:text-slate-100",
    },
    {
      label: "On Track (Green)",
      value: counts.green,
      className: "text-green-700 dark:text-green-400",
      title: `${onTrackPct}% dari total`,
    },
    { label: "Amber", value: counts.amber, className: "text-amber-700 dark:text-amber-400" },
    { label: "Red", value: counts.red, className: "text-red-700 dark:text-red-400" },
    {
      label: "Belum Update >21 Hari",
      value: stale,
      className: "text-orange-700 dark:text-orange-400",
      title: noUpdate > 0 ? `Termasuk ${noUpdate} yang belum pernah diisi sama sekali` : undefined,
    },
    {
      label: "Overdue Action Items",
      value: overdueActions,
      className: "text-red-700 dark:text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          title={t.title}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className={`text-2xl font-bold ${t.className}`}>{t.value}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function ExportButton({ streams }: { streams: DashStream[] }) {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const XLSX = await import("xlsx");
      const rows = streams.flatMap((stream) =>
        stream.applications.flatMap((app) =>
          app.initiatives.map((init) => {
            const u = init.latestUpdate;
            return {
              Stream: stream.name,
              Application: app.name,
              Initiative: init.name,
              PIC: init.pic,
              "Tracker Phase": init.current_phase,
              "Tracker RAG": RAG_LABEL[init.current_rag],
              Periode: u?.period_label ?? "",
              "RAG Update": u ? RAG_LABEL[u.rag] : "Belum ada update",
              "Key Highlight": u?.key_highlight ?? "",
              "Progress Last 2 Weeks": u?.progress_last_2wk ?? "",
              "Plan Next 2 Weeks": u?.plan_next_2wk ?? "",
              "Risk / Issue": u?.risk_issue ?? "",
              "Unlocking Needed": u?.unlocking_needed ?? "",
              "Belum Update >21 Hari": isStale(init) ? "Ya" : "",
            };
          })
        )
      );
      const sheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "PMO Dashboard");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `pmo-dashboard-${today}.xlsx`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={running || streams.length === 0}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-600"
    >
      {running ? "Menyiapkan…" : "Export Excel"}
    </button>
  );
}

function SeedButton({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) throw new Error("Gagal mengisi data.");
      const data = await res.json();
      setResult(
        `${data.streamCount} stream, ${data.appCount} application, ${data.initiativeCount} initiative ditambahkan/diperbarui.`
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengisi data.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {running ? "Mengisi data…" : "Isi data awal dari Excel tracker"}
      </button>
      {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function ImportDeckButton({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/import-deck", { method: "POST" });
      if (!res.ok) throw new Error("Gagal mengisi update dari deck.");
      const data = await res.json();
      setResult(
        `${data.updateCount} update diisi (${data.matched} cocok dengan initiative yang sudah ada, ${data.created} initiative baru dibuat).`
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengisi update dari deck.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {running ? "Mengisi update…" : "Isi update dari deck PMO Biweekly"}
      </button>
      {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function ExcelUploadButton({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setRunning(true);
    setError("");
    setResult("");
    try {
      const buffer = await file.arrayBuffer();
      const streams = await parseTrackerWorkbook(buffer);
      if (streams.length === 0) {
        throw new Error("Tidak ada baris valid yang ditemukan di sheet tracker.");
      }

      const res = await fetch("/api/import-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streams }),
      });
      if (!res.ok) throw new Error("Gagal mengunggah data ke server.");
      const data = await res.json();
      setResult(
        `${data.streamCount} stream, ${data.appCount} application, ${data.initiativeCount} initiative disinkronkan dari file.`
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file Excel.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={running}
        className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {running ? "Memproses file…" : "Upload Excel tracker (.xlsx)"}
      </button>
      {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function StreamManager({
  streams,
  onChanged,
}: {
  streams: DashStream[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  async function addStream() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/streams", {
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
    await fetch(`/api/streams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction }),
    });
    onChanged();
  }

  async function archive(id: number) {
    await fetch(`/api/streams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    onChanged();
  }

  async function rename(id: number) {
    if (!editingName.trim()) return;
    await fetch(`/api/streams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    setEditingId(null);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold">Kelola Stream</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Stream bisa ditambah, diganti nama, diurutkan ulang, atau diarsipkan kapan saja — tidak
        perlu ubah kode.
      </p>
      <div className="flex flex-col gap-2">
        {streams.map((stream, idx) => (
          <div key={stream.id} className="flex items-center gap-2">
            {editingId === stream.id ? (
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
                  onClick={() => rename(stream.id)}
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
                <span className="flex-1 text-sm">{stream.name}</span>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => move(stream.id, "up")}
                  className="text-sm disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === streams.length - 1}
                  onClick={() => move(stream.id, "down")}
                  className="text-sm disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(stream.id);
                    setEditingName(stream.name);
                  }}
                  className="text-sm text-slate-500 underline"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => archive(stream.id)}
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
          placeholder="Nama stream baru (mis. Growth)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={addStream}
          disabled={submitting || !name.trim()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          Tambah
        </button>
      </div>
      <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Upload file tracker Excel terbaru (.xlsx, sheet &quot;2. All Project 2026&quot;)
          kapan saja untuk sinkronkan Stream/Application/Initiative beserta status RAG
          &amp; Phase-nya — tidak perlu input manual satu-satu, dan aman diulang tiap
          tracker di-update.
        </p>
        <ExcelUploadButton onDone={onChanged} />
      </div>
      <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Atau muat contoh data awal (dummy) yang sudah tersimpan di aplikasi — aman
          diklik berkali-kali, tidak akan bikin duplikat.
        </p>
        <SeedButton onDone={onChanged} />
      </div>
      <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Isi Key Highlight/Progress/Plan/Risk/Unlocking dari contoh data deck biweekly
          (dummy) — mensimulasikan proses copy dari deck PowerPoint yang sudah diisi tim.
          Aman diklik berkali-kali, tiap klik menambah entri update baru.
        </p>
        <ImportDeckButton onDone={onChanged} />
      </div>
    </div>
  );
}
