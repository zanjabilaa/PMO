"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Rag } from "@/lib/db";

type Update = {
  period_label: string;
  rag: Rag;
  key_highlight: string;
  progress_last_2wk: string;
  risk_issue: string;
  created_at: string;
};

type DashInitiative = { id: number; name: string; pic: string; latestUpdate: Update | null };
type DashApplication = { id: number; name: string; initiatives: DashInitiative[] };
type DashStream = { id: number; name: string; applications: DashApplication[] };

const RAG_STYLE: Record<Rag, string> = {
  green: "bg-green-200 text-green-900 dark:bg-green-500/30 dark:text-green-200",
  amber: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200",
  red: "bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-200",
};
const RAG_LABEL: Record<Rag, string> = { green: "Green", amber: "Amber", red: "Red" };

const POLL_INTERVAL_MS = 8000;
const PRESETS = [
  { label: "7 hari", days: 7 },
  { label: "14 hari", days: 14 },
  { label: "30 hari", days: 30 },
];

type ReportRow = { streamName: string; initiative: DashInitiative };

function cutoffTimestamp(days: number): number {
  return Date.now() - days * 86_400_000;
}

function buildReportText(rows: ReportRow[]): string {
  const byStream = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const list = byStream.get(row.streamName) ?? [];
    list.push(row);
    byStream.set(row.streamName, list);
  }

  const lines: string[] = [];
  for (const [streamName, streamRows] of byStream) {
    lines.push(streamName.toUpperCase());
    for (const row of streamRows) {
      const u = row.initiative.latestUpdate!;
      lines.push(
        `- ${row.initiative.name}${row.initiative.pic ? ` (${row.initiative.pic})` : ""} [${RAG_LABEL[u.rag]}]`
      );
      lines.push(`  Highlight: ${u.key_highlight || "—"}`);
      lines.push(`  Progress: ${u.progress_last_2wk || "—"}`);
      lines.push(`  Risk: ${u.risk_issue || "—"}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export default function WeeklyReportPage() {
  const [streams, setStreams] = useState<DashStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [copied, setCopied] = useState(false);

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

  const cutoff = cutoffTimestamp(days);
  const rows: ReportRow[] = streams.flatMap((stream) =>
    stream.applications.flatMap((app) =>
      app.initiatives
        .filter((init) => init.latestUpdate && new Date(init.latestUpdate.created_at).getTime() >= cutoff)
        .map((initiative) => ({ streamName: stream.name, initiative }))
    )
  );

  const reportText = buildReportText(rows);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const sheetRows = rows.map(({ streamName, initiative }) => {
      const u = initiative.latestUpdate!;
      return {
        Stream: streamName,
        Initiative: initiative.name,
        PIC: initiative.pic,
        RAG: RAG_LABEL[u.rag],
        Periode: u.period_label,
        "Key Highlight": u.key_highlight,
        "Progress Last 2 Weeks": u.progress_last_2wk,
        "Risk / Issue": u.risk_issue,
      };
    });
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Weekly Report");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `pmo-weekly-report-${today}.xlsx`);
  }

  const byStream = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const list = byStream.get(row.streamName) ?? [];
    list.push(row);
    byStream.set(row.streamName, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Weekly Report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {rows.length} initiative dengan update dalam {days} hari terakhir — siap di-copy
            untuk bahan report biweekly.
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="text-sm font-medium">Rentang update:</span>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                days === p.days
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={copyReport}
            disabled={rows.length === 0}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {copied ? "Tersalin!" : "Copy sebagai Teks"}
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={rows.length === 0}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-600"
          >
            Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          Tidak ada initiative yang punya update dalam {days} hari terakhir.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(byStream.entries()).map(([streamName, streamRows]) => (
            <div
              key={streamName}
              className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold dark:border-slate-700">
                {streamName}
              </h2>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {streamRows.map(({ initiative }) => {
                  const u = initiative.latestUpdate!;
                  return (
                    <div key={initiative.id} className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{initiative.name}</span>
                        {initiative.pic && (
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            — {initiative.pic}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RAG_STYLE[u.rag]}`}
                        >
                          {RAG_LABEL[u.rag]}
                        </span>
                        <span className="text-xs text-slate-400">{u.period_label}</span>
                      </div>
                      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Highlight
                          </dt>
                          <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                            {u.key_highlight || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Progress
                          </dt>
                          <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                            {u.progress_last_2wk || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Risk
                          </dt>
                          <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                            {u.risk_issue || "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
